import type { AppState, SyncProviderType } from '../types'
import type { SyncProvider, MediaStoreAccessor, PullResult } from './privateSyncProvider'
import { SyncError } from './privateSyncProvider'
import { mergeStates } from './privateSyncMerge'
import { loadCachedVaultKey } from './recoveryCode'
import {
  encryptSyncEnvelope,
  decryptSyncEnvelope,
  parseEncryptedSyncEnvelope,
} from './syncEncryption'

const TOKEN_KEY = 'rm-sync-gdrive-token'
const FILE_ID_KEY = 'rm-sync-gdrive-fileid'
const SYNC_FILE_NAME = 'remember-me-sync.json'
const MEDIA_FOLDER_NAME = 'remember-me-media'
const APP_VERSION = '2.0.1'

type MediaManifestEntry = { type: 'image' | 'audio' | 'video'; syncedAt: string; driveFileId: string }

interface StoredToken {
  accessToken: string
  expiresAt: number
}

// ── IndexedDB token store ──────────────────────────────────────────────────

const TOKEN_IDB = 'rm-sync-auth'
const TOKEN_STORE = 'tokens'

async function openTokenDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(TOKEN_IDB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(TOKEN_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function loadToken(): Promise<StoredToken | null> {
  try {
    const db = await openTokenDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(TOKEN_STORE, 'readonly')
      const req = tx.objectStore(TOKEN_STORE).get(TOKEN_KEY)
      req.onsuccess = () => resolve((req.result as StoredToken | undefined) ?? null)
      req.onerror = () => reject(req.error)
    })
  } catch { return null }
}

async function saveToken(t: StoredToken): Promise<void> {
  const db = await openTokenDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(TOKEN_STORE, 'readwrite')
    tx.objectStore(TOKEN_STORE).put(t, TOKEN_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function clearToken(): Promise<void> {
  try {
    const db = await openTokenDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(TOKEN_STORE, 'readwrite')
      tx.objectStore(TOKEN_STORE).delete(TOKEN_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch { /* best-effort */ }
}

async function loadFileId(): Promise<string | null> {
  try {
    const db = await openTokenDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(TOKEN_STORE, 'readonly')
      const req = tx.objectStore(TOKEN_STORE).get(FILE_ID_KEY)
      req.onsuccess = () => resolve((req.result as string | undefined) ?? null)
      req.onerror = () => reject(req.error)
    })
  } catch { return null }
}

async function saveFileId(id: string): Promise<void> {
  const db = await openTokenDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(TOKEN_STORE, 'readwrite')
    tx.objectStore(TOKEN_STORE).put(id, FILE_ID_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function clearFileId(): Promise<void> {
  try {
    const db = await openTokenDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(TOKEN_STORE, 'readwrite')
      tx.objectStore(TOKEN_STORE).delete(FILE_ID_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch { /* best-effort */ }
}

// Internal sentinel: PATCH on a fileId that no longer exists in Drive (file
// was deleted manually, trashed, or removed via deactivate(deleteRemote)).
// Caught only inside push() so it can drop the stale cache and create a fresh
// envelope file. Never escapes the module.
class StaleDriveFileError extends Error {
  constructor() {
    super('Drive file no longer exists')
    this.name = 'StaleDriveFileError'
  }
}

// ── OAuth state key ────────────────────────────────────────────────────────
//
// Saved to sessionStorage before the Supabase OAuth redirect so that on
// return the view can detect it and resume the setup flow.
const OAUTH_STATE_KEY = 'rm-gdrive-oauth-pending'

// Maximum time to wait for an onAuthStateChange event with provider_token.
// Longer than the original 8s to tolerate slow mobile networks / cold service
// workers on iOS Safari, where the redirect return can stall a few seconds
// before the auth listener fires.
const PROVIDER_TOKEN_WAIT_MS = 20_000

// Lightweight, opt-in logger for the OAuth resume flow. Enabled when the build
// is in DEV (`import.meta.env.DEV`) or when the user sets
// `localStorage.rm-debug-oauth = '1'` so we can capture flow timing in
// production without shipping noisy logs by default.
function oauthLog(message: string, data?: Record<string, unknown>): void {
  try {
    const dev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true
    const flag = typeof localStorage !== 'undefined' && localStorage.getItem('rm-debug-oauth') === '1'
    if (!dev && !flag) return
    // eslint-disable-next-line no-console
    console.log(`[oauth] ${message}`, data ?? '')
  } catch {
    /* logging must never throw */
  }
}

// Parse `provider_token` directly from the URL hash. After a Supabase implicit
// OAuth redirect, the hash carries:
//   #access_token=…&expires_in=3600&provider_token=…&refresh_token=…&token_type=bearer
// Reading the hash here, before `getSyncSupabaseClient()` triggers
// `detectSessionInUrl`, removes the race where the Supabase client consumes
// the hash before our `onAuthStateChange` listener can attach.
export function parseProviderTokenFromHash(hash: string): {
  providerToken: string | null
  expiresIn: number | null
} {
  if (!hash || hash.length < 2) return { providerToken: null, expiresIn: null }
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const params = new URLSearchParams(raw)
  const providerToken = params.get('provider_token')
  const expiresInRaw = params.get('expires_in')
  const expiresIn = expiresInRaw ? Number.parseInt(expiresInRaw, 10) : null
  return {
    providerToken,
    expiresIn: Number.isFinite(expiresIn) && expiresIn !== null && expiresIn > 0 ? expiresIn : null,
  }
}

// Strip an OAuth response (#access_token / #provider_token / #refresh_token …)
// from window.location once we've copied out what we need. Without this, the
// bearer token survives in window.history, in document.referer of subsequent
// outbound requests, and in any analytics SDK that reads location.href.
export function clearOAuthHash(): void {
  if (typeof window === 'undefined') return
  if (!window.location.hash) return
  try {
    window.history.replaceState(
      window.history.state,
      '',
      window.location.pathname + window.location.search,
    )
  } catch {
    /* replaceState can fail in sandboxed iframes — best-effort */
  }
}

// ── Drive API helpers ──────────────────────────────────────────────────────

async function getValidToken(): Promise<string> {
  const stored = await loadToken()
  if (stored && stored.expiresAt > Date.now() + 60_000) {
    return stored.accessToken
  }
  throw new SyncError('Kein gültiger Google-Token – bitte erneut anmelden', 'auth')
}

async function driveGet(path: string, token: string): Promise<Response> {
  const res = await fetch(`https://www.googleapis.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) throw new SyncError('Google-Authentifizierung abgelaufen', 'auth')
  return res
}

async function driveUpload(
  method: 'POST' | 'PATCH',
  fileId: string | null,
  metadata: Record<string, unknown>,
  body: Blob | string,
  mimeType: string,
  token: string,
): Promise<string> {
  const boundary = `rm-boundary-${Date.now()}`
  const metaPart = `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(metadata)}\r\n`
  const bodyBlob = typeof body === 'string' ? new Blob([body], { type: mimeType }) : body
  const closing = `\r\n--${boundary}--`
  const fullBody = new Blob([
    metaPart,
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    bodyBlob,
    closing,
  ])
  const url = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: fullBody,
  })
  if (res.status === 401) throw new SyncError('Google-Authentifizierung abgelaufen', 'auth')
  if (res.status === 404 && method === 'PATCH') throw new StaleDriveFileError()
  if (!res.ok) throw new SyncError(`Drive-Upload fehlgeschlagen: ${res.status}`, 'network')
  const data = await res.json() as { id: string }
  return data.id
}

async function findSyncFile(token: string): Promise<string | null> {
  const res = await driveGet(
    `/drive/v3/files?q=name='${SYNC_FILE_NAME}' and trashed=false&spaces=drive&fields=files(id)`,
    token,
  )
  const data = await res.json() as { files: { id: string }[] }
  return data.files[0]?.id ?? null
}

async function findOrCreateMediaFolder(token: string): Promise<string> {
  const searchRes = await driveGet(
    `/drive/v3/files?q=name='${MEDIA_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder'&spaces=drive&fields=files(id)`,
    token,
  )
  const searchData = await searchRes.json() as { files: { id: string }[] }
  if (searchData.files[0]?.id) return searchData.files[0].id

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: MEDIA_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  })
  const folder = await createRes.json() as { id: string }
  return folder.id
}

// ── Provider implementation ────────────────────────────────────────────────

export class GoogleDriveProvider implements SyncProvider {
  readonly type: SyncProviderType = 'google-drive'

  private _authenticated = false
  private _syncId: string | null

  /**
   * @param syncId Stable per-install UUID used as PBKDF2 salt for the vault
   *               key. Persisted in AppState.privateSync.userId. The setup
   *               wizard generates one on first setup and recovers it from
   *               the existing sync file on a second device.
   */
  constructor(syncId?: string) {
    this._syncId = syncId ?? null
    loadToken().then(t => {
      this._authenticated = !!t && t.expiresAt > Date.now()
    })
  }

  private async _requireVaultKey(): Promise<{ key: CryptoKey; syncId: string }> {
    if (!this._syncId) throw new SyncError('syncId fehlt – Setup nicht abgeschlossen', 'auth')
    const key = await loadCachedVaultKey(this._syncId)
    if (!key) throw new SyncError('Kein Vault-Key – Recovery Code fehlt', 'decrypt')
    return { key, syncId: this._syncId }
  }

  isAuthenticated(): boolean {
    return this._authenticated
  }

  async signIn(): Promise<void> {
    const { getSyncSupabaseClient } = await import('./privateSyncClient')
    const supabase = getSyncSupabaseClient()
    sessionStorage.setItem(OAUTH_STATE_KEY, '1')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/drive.file',
        redirectTo: `${window.location.origin}/sync`,
      },
    })
    if (error) {
      sessionStorage.removeItem(OAUTH_STATE_KEY)
      throw new SyncError(`Google OAuth Fehler: ${error.message}`, 'auth')
    }
    // The browser navigates to Google OAuth; this promise intentionally never resolves.
    return new Promise(() => {})
  }

  async resumeFromOAuth(): Promise<boolean> {
    if (!sessionStorage.getItem(OAUTH_STATE_KEY)) {
      oauthLog('resume: no pending flag, skip')
      return false
    }
    const startedAt = Date.now()
    oauthLog('resume: start', {
      hashPresent: typeof window !== 'undefined' && !!window.location.hash,
      hashLength: typeof window !== 'undefined' ? window.location.hash.length : 0,
    })

    // Strategy 1: read provider_token directly from the URL hash before any
    // other code (e.g. the Supabase client's `detectSessionInUrl`) consumes
    // it. This avoids the race where the auth listener attaches after the
    // SIGNED_IN event has already fired.
    const hashParsed = typeof window !== 'undefined'
      ? parseProviderTokenFromHash(window.location.hash)
      : { providerToken: null, expiresIn: null }
    oauthLog('resume: hash parse', {
      hasProviderToken: !!hashParsed.providerToken,
      expiresIn: hashParsed.expiresIn,
    })

    // Strip the bearer token from the URL as soon as we've copied it out.
    // Only safe to clear here when our own parse already succeeded; in the
    // fallback path Supabase still needs to read the hash itself, so leave
    // it alone until that path completes (Supabase clears it via its own
    // detectSessionInUrl machinery, and we run a defensive second clear at
    // the success exit below).
    if (hashParsed.providerToken) {
      clearOAuthHash()
    }

    let providerToken: string | null = hashParsed.providerToken
    let expiresInSec: number | null = hashParsed.expiresIn

    const { getSyncSupabaseClient } = await import('./privateSyncClient')
    const supabase = getSyncSupabaseClient()

    // Strategy 2 (fallback): if the hash was already consumed (e.g. React
    // StrictMode double-mount, or any other code that initialised the
    // Supabase client first), wait on `onAuthStateChange` for an event whose
    // session still carries provider_token.
    if (!providerToken) {
      oauthLog('resume: falling back to onAuthStateChange', {
        timeoutMs: PROVIDER_TOKEN_WAIT_MS,
      })
      providerToken = await new Promise<string | null>(resolve => {
        let done = false
        let sub: { unsubscribe(): void } = { unsubscribe: () => {} }
        const finish = (token: string | null, reason: string) => {
          if (done) return
          done = true
          clearTimeout(timer)
          sub.unsubscribe()
          oauthLog('resume: listener finish', {
            reason,
            hasToken: !!token,
            elapsedMs: Date.now() - startedAt,
          })
          resolve(token)
        }
        const timer = setTimeout(() => finish(null, 'timeout'), PROVIDER_TOKEN_WAIT_MS)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          sub = subscription
          oauthLog('resume: auth event', {
            event,
            hasSession: !!session,
            hasProviderToken: !!session?.provider_token,
          })
          if (session?.provider_token) {
            finish(session.provider_token, `event:${event}`)
          } else if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
            finish(null, `event:${event}-no-token`)
          }
        })
        sub = subscription
      })
    }

    if (!providerToken) {
      oauthLog('resume: failed, clearing pending flag', {
        elapsedMs: Date.now() - startedAt,
      })
      sessionStorage.removeItem(OAUTH_STATE_KEY)
      // Even on failure, scrub any remaining OAuth fragment from the URL so
      // the user is not left with #access_token=… in the address bar.
      clearOAuthHash()
      return false
    }

    // Compute expiry: prefer the hash's expires_in, fall back to the persisted
    // session's expires_at, and finally to a 1-hour default. We do this last
    // so that a slow Supabase response cannot block the resume on success.
    let expiresAtMs: number
    if (expiresInSec) {
      expiresAtMs = Date.now() + expiresInSec * 1000
    } else {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        expiresAtMs = (session?.expires_at ?? Math.floor(Date.now() / 1000) + 3600) * 1000
      } catch {
        expiresAtMs = Date.now() + 3600 * 1000
      }
    }

    const token: StoredToken = {
      accessToken: providerToken,
      expiresAt: expiresAtMs,
    }
    await saveToken(token)
    this._authenticated = true
    sessionStorage.removeItem(OAUTH_STATE_KEY)
    // Defensive cleanup for the fallback path: Supabase normally clears the
    // hash itself once detectSessionInUrl completes, but on slow mobile
    // browsers the listener can fire while window.location still carries
    // the bearer. Idempotent no-op if the hash is already empty.
    clearOAuthHash()
    oauthLog('resume: success', { elapsedMs: Date.now() - startedAt })
    return true
  }

  async signOut(): Promise<void> {
    await clearToken()
    this._authenticated = false
  }

  /**
   * Probe Drive for an existing sync file and, if present, return its syncId
   * (the PBKDF2 salt) without decrypting. Returns null when no file exists or
   * the file is in a legacy/unknown format. Used by the setup wizard to
   * decide between "generate new recovery code" vs "ask user to enter
   * existing recovery code".
   */
  async readExistingSyncId(): Promise<string | null> {
    try {
      const token = await getValidToken()
      let fileId = await loadFileId()
      if (!fileId) fileId = await findSyncFile(token)
      if (!fileId) return null
      const res = await driveGet(`/drive/v3/files/${fileId}?alt=media`, token)
      if (!res.ok) return null
      const raw = await res.json() as unknown
      const { readEncryptedSyncId } = await import('./syncEncryption')
      return readEncryptedSyncId(raw)
    } catch {
      return null
    }
  }

  async push(state: AppState, media: MediaStoreAccessor): Promise<void> {
    const { key: vaultKey, syncId } = await this._requireVaultKey()
    const token = await getValidToken()
    let fileId = await loadFileId()
    if (!fileId) fileId = await findSyncFile(token)

    const localMediaIds = await media.listLocalMediaIds()
    const manifest: Record<string, MediaManifestEntry> = {}

    const folderId = await findOrCreateMediaFolder(token)

    await Promise.all([
      ...localMediaIds.images.map(async id => {
        const blob = await media.getImageBlob(id)
        if (!blob) return
        const driveId = await driveUpload('POST', null, { name: `${id}.bin`, parents: [folderId] }, blob, blob.type, token)
        manifest[id] = { type: 'image', syncedAt: new Date().toISOString(), driveFileId: driveId }
      }),
      ...localMediaIds.audio.map(async id => {
        const blob = await media.getAudioBlob(id)
        if (!blob) return
        const driveId = await driveUpload('POST', null, { name: `${id}.bin`, parents: [folderId] }, blob, blob.type, token)
        manifest[id] = { type: 'audio', syncedAt: new Date().toISOString(), driveFileId: driveId }
      }),
      ...localMediaIds.videos.map(async id => {
        const blob = await media.getVideoBlob(id)
        if (!blob) return
        const driveId = await driveUpload('POST', null, { name: `${id}.bin`, parents: [folderId] }, blob, blob.type, token)
        manifest[id] = { type: 'video', syncedAt: new Date().toISOString(), driveFileId: driveId }
      }),
    ])

    const envelope = await encryptSyncEnvelope({
      state,
      mediaManifest: manifest,
      vaultKey,
      syncId,
      appVersion: APP_VERSION,
    })
    const body = JSON.stringify(envelope)

    if (fileId) {
      try {
        await driveUpload('PATCH', fileId, { name: SYNC_FILE_NAME }, body, 'application/json', token)
      } catch (err) {
        if (!(err instanceof StaleDriveFileError)) throw err
        // Cached fileId points at a Drive file that no longer exists. Drop the
        // cache and create a fresh envelope file so the next sync converges.
        await clearFileId()
        const newId = await driveUpload('POST', null, { name: SYNC_FILE_NAME }, body, 'application/json', token)
        await saveFileId(newId)
      }
    } else {
      const newId = await driveUpload('POST', null, { name: SYNC_FILE_NAME }, body, 'application/json', token)
      await saveFileId(newId)
    }
  }

  async pull(localState: AppState, media: MediaStoreAccessor): Promise<PullResult | null> {
    const { key: vaultKey } = await this._requireVaultKey()
    const token = await getValidToken()
    let fileId = await loadFileId()
    if (!fileId) fileId = await findSyncFile(token)
    if (!fileId) return null

    const res = await driveGet(`/drive/v3/files/${fileId}?alt=media`, token)
    if (!res.ok) return null
    const raw = await res.json() as unknown
    const envelope = parseEncryptedSyncEnvelope(raw)
    const decrypted = await decryptSyncEnvelope<Record<string, MediaManifestEntry>>(envelope, vaultKey)
    const remote = decrypted.state
    const manifest = decrypted.mediaManifest ?? {}

    const localIds = await media.listLocalMediaIds()
    const localAllIds = new Set([...localIds.images, ...localIds.audio, ...localIds.videos])
    const downloadedMediaIds: string[] = []

    await Promise.all(
      Object.entries(manifest).map(async ([id, entry]) => {
        if (localAllIds.has(id)) return
        const mediaRes = await driveGet(`/drive/v3/files/${entry.driveFileId}?alt=media`, token)
        if (!mediaRes.ok) return
        const blob = await mediaRes.blob()
        if (entry.type === 'image') await media.putImage(id, blob)
        else if (entry.type === 'audio') await media.putAudio(id, blob)
        else await media.putVideo(id, blob)
        downloadedMediaIds.push(id)
      }),
    )

    return { merged: mergeStates(localState, remote), downloadedMediaIds }
  }

  async deactivate(deleteRemote: boolean): Promise<void> {
    if (deleteRemote) {
      try {
        const token = await getValidToken()
        const fileId = await loadFileId()
        if (fileId) {
          await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          })
        }
      } catch { /* best-effort */ }
    }
    if (this._syncId) {
      const { clearCachedVaultKey } = await import('./recoveryCode')
      await clearCachedVaultKey(this._syncId).catch(() => {})
    }
    await clearToken()
    await clearFileId()
    this._authenticated = false
  }
}

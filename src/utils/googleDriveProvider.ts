import type { AppState, SyncProviderType } from '../types'
import type { SyncProvider, MediaStoreAccessor, PullResult } from './privateSyncProvider'
import { SyncError } from './privateSyncProvider'
import { mergeStates } from './privateSyncMerge'
import { loadCachedVaultKey } from './recoveryCode'
import {
  encryptSyncEnvelope,
  decryptSyncEnvelope,
  parseEncryptedSyncEnvelope,
  encryptMediaBlob,
  decryptMediaBlob,
} from './syncEncryption'

const TOKEN_KEY = 'rm-sync-gdrive-token'
const FILE_ID_KEY = 'rm-sync-gdrive-fileid'
const SYNC_FILE_NAME = 'remember-me-sync.json'
const MEDIA_FOLDER_NAME = 'remember-me-media'
const APP_VERSION = '2.0.1'

// Manifest entries written after the H1 media-encryption rollout carry `iv`
// and `mimeType` so that pull() can decrypt the AES-GCM ciphertext back into
// a typed Blob. Old entries (pre-H1) lack both fields and are treated as
// legacy plaintext on download.
type MediaManifestEntry = {
  type: 'image' | 'audio' | 'video'
  syncedAt: string
  driveFileId: string
  iv?: string
  mimeType?: string
}

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

// Strip a stale OAuth fragment (#access_token / #provider_token / …) from
// window.location. With PKCE the bearer token no longer travels through the
// URL hash, but this helper stays for two reasons:
//   1. Users who started an OAuth flow on a previous (implicit-flow) build and
//      land back on /sync after the upgrade still have an `#access_token=…`
//      fragment in their address bar — scrub it.
//   2. Defensive cleanup if any future change reintroduces hash-based
//      callbacks. Idempotent no-op when the hash is empty.
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
    oauthLog('resume: start (pkce)', {
      queryHasCode: typeof window !== 'undefined'
        && /[?&]code=/.test(window.location.search),
    })

    const { getSyncSupabaseClient } = await import('./privateSyncClient')
    const supabase = getSyncSupabaseClient()

    // PKCE flow: Supabase's detectSessionInUrl auto-exchanges the `?code=`
    // query param for a session and emits SIGNED_IN with provider_token.
    // We attach the listener synchronously after createClient() so the
    // event cannot fire before we are listening. provider_token is emitted
    // exactly once per sign-in (Supabase docs), so missing the event means
    // losing the Drive bearer for this redirect — hence the timeout +
    // bail-to-false rather than retry.
    const providerToken = await new Promise<string | null>(resolve => {
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
        } else if (event === 'INITIAL_SESSION' && !session) {
          // No active sign-in detected → exchange must have failed (or the
          // user landed on /sync without an OAuth roundtrip in progress).
          finish(null, `event:${event}-no-session`)
        }
      })
      sub = subscription
    })

    if (!providerToken) {
      oauthLog('resume: failed, clearing pending flag', {
        elapsedMs: Date.now() - startedAt,
      })
      sessionStorage.removeItem(OAUTH_STATE_KEY)
      // Defensive: scrub any residual OAuth fragment a pre-PKCE upgrade may
      // have left in the URL. Idempotent no-op for a clean PKCE return.
      clearOAuthHash()
      return false
    }

    // Resolve expiry from the persisted session that detectSessionInUrl just
    // wrote, falling back to a 1-hour default when the lookup fails.
    let expiresAtMs: number
    try {
      const { data: { session } } = await supabase.auth.getSession()
      expiresAtMs = (session?.expires_at ?? Math.floor(Date.now() / 1000) + 3600) * 1000
    } catch {
      expiresAtMs = Date.now() + 3600 * 1000
    }

    const token: StoredToken = {
      accessToken: providerToken,
      expiresAt: expiresAtMs,
    }
    await saveToken(token)
    this._authenticated = true
    sessionStorage.removeItem(OAUTH_STATE_KEY)
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

  /**
   * H7: fetch kdfSalt + kdfIterations from the existing sync envelope so
   * the wizard can re-derive the vault key under the same params used at
   * setup. Returns null for legacy v2 envelopes (no kdf* fields) — caller
   * falls back to `legacyKdfParams(syncId)`.
   */
  async readExistingKdfParams(): Promise<{ salt: Uint8Array; iterations: number } | null> {
    try {
      const token = await getValidToken()
      let fileId = await loadFileId()
      if (!fileId) fileId = await findSyncFile(token)
      if (!fileId) return null
      const res = await driveGet(`/drive/v3/files/${fileId}?alt=media`, token)
      if (!res.ok) return null
      const raw = await res.json() as Record<string, unknown>
      if (typeof raw.kdfSalt !== 'string' || typeof raw.kdfIterations !== 'number') return null
      const saltBytes = Uint8Array.from(atob(raw.kdfSalt), c => c.charCodeAt(0))
      return { salt: saltBytes, iterations: raw.kdfIterations }
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

    // Each blob is sealed with a fresh AES-GCM nonce under the vault key
    // before upload. IV + original MIME live inside the encrypted manifest;
    // Drive only ever sees `application/octet-stream` ciphertext.
    const uploadEncrypted = async (
      id: string,
      blob: Blob,
      kind: 'image' | 'audio' | 'video',
    ): Promise<void> => {
      const sealed = await encryptMediaBlob(blob, vaultKey)
      const driveId = await driveUpload(
        'POST',
        null,
        { name: `${id}.bin`, parents: [folderId] },
        sealed.ciphertext,
        'application/octet-stream',
        token,
      )
      manifest[id] = {
        type: kind,
        syncedAt: new Date().toISOString(),
        driveFileId: driveId,
        iv: sealed.iv,
        mimeType: sealed.mimeType,
      }
    }

    await Promise.all([
      ...localMediaIds.images.map(async id => {
        const blob = await media.getImageBlob(id)
        if (!blob) return
        await uploadEncrypted(id, blob, 'image')
      }),
      ...localMediaIds.audio.map(async id => {
        const blob = await media.getAudioBlob(id)
        if (!blob) return
        await uploadEncrypted(id, blob, 'audio')
      }),
      ...localMediaIds.videos.map(async id => {
        const blob = await media.getVideoBlob(id)
        if (!blob) return
        await uploadEncrypted(id, blob, 'video')
      }),
    ])

    // H7: forward the locally cached PBKDF2 params into the envelope so a
    // new device can re-derive the vault key. Absent for legacy setups
    // (single-device users who never re-cached after the H7 upgrade) →
    // envelope falls back to schemaVersion=2, decrypt path treats it as
    // "salt = syncId, iter = 200_000".
    const { loadKdfParams, loadLastSeenVersion, saveLastSeenVersion } =
      await import('./recoveryCode')
    const cachedKdf = await loadKdfParams(syncId)
    const kdfMeta = cachedKdf
      ? { salt: btoa(String.fromCharCode(...cachedKdf.salt)), iterations: cachedKdf.iterations }
      : undefined
    // H5: bump the monotonic envelope version so pulls from this row are
    // strictly later than any prior state we've written or accepted.
    const nextVersion = (await loadLastSeenVersion(syncId)) + 1
    const envelope = await encryptSyncEnvelope({
      state,
      mediaManifest: manifest,
      vaultKey,
      syncId,
      appVersion: APP_VERSION,
      kdf: kdfMeta,
      envelopeVersion: nextVersion,
    })
    await saveLastSeenVersion(syncId, nextVersion)
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
    const { key: vaultKey, syncId } = await this._requireVaultKey()
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

    // H5: reject a remote envelope whose version is below the locally
    // cached high-water mark — that signals a replay of a stale backup
    // (malicious server, recovered cached file, etc.).
    const { loadLastSeenVersion, saveLastSeenVersion } = await import('./recoveryCode')
    const remoteVersion = typeof decrypted.envelopeVersion === 'number' ? decrypted.envelopeVersion : 0
    const lastSeen = await loadLastSeenVersion(syncId)
    if (remoteVersion < lastSeen) {
      throw new SyncError(
        `Veralteter Sync-Stand erkannt (Version ${remoteVersion} < ${lastSeen}) — möglicher Replay.`,
        'unknown',
      )
    }
    if (remoteVersion > lastSeen) {
      await saveLastSeenVersion(syncId, remoteVersion)
    }

    const localIds = await media.listLocalMediaIds()
    const localAllIds = new Set([...localIds.images, ...localIds.audio, ...localIds.videos])
    const downloadedMediaIds: string[] = []

    await Promise.all(
      Object.entries(manifest).map(async ([id, entry]) => {
        if (localAllIds.has(id)) return
        const mediaRes = await driveGet(`/drive/v3/files/${entry.driveFileId}?alt=media`, token)
        if (!mediaRes.ok) return
        const ct = await mediaRes.blob()
        // Manifest entries with `iv` are sealed under the vault key (post-H1
        // format). Entries without `iv` are legacy plaintext blobs and are
        // restored verbatim — this is the upgrade path for sync files
        // written by older clients.
        const blob = entry.iv
          ? await decryptMediaBlob(ct, entry.iv, entry.mimeType ?? '', vaultKey)
          : ct
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

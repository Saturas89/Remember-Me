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

// ── Google Identity Services script loader ────────────────────────────────
//
// GIS is required for the OAuth token client. We inject the <script> tag on
// demand (rather than putting it in index.html) so users who never enable
// Drive sync don't pay the network cost. The CSP must allow
// https://accounts.google.com/gsi/client – see vercel.json#script-src.

let _gisScriptPromise: Promise<void> | null = null

function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  const w = window as unknown as { google?: { accounts?: { oauth2?: unknown } } }
  if (w.google?.accounts?.oauth2) return Promise.resolve()
  if (_gisScriptPromise) return _gisScriptPromise

  _gisScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    )
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('GIS script failed')), { once: true })
      return
    }
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => {
      _gisScriptPromise = null // allow retry on next signIn
      reject(new Error('GIS script failed'))
    }
    document.head.appendChild(s)
  })
  return _gisScriptPromise
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
  if (!res.ok) throw new SyncError(`Drive-Upload fehlgeschlagen: ${res.status}`, 'network')
  const data = await res.json() as { id: string }
  return data.id
}

async function findSyncFile(token: string): Promise<string | null> {
  const res = await driveGet(
    `/drive/v3/files?q=name='${SYNC_FILE_NAME}'&spaces=drive&fields=files(id)`,
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
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
    if (!clientId) throw new SyncError('VITE_GOOGLE_CLIENT_ID nicht gesetzt', 'auth')

    await loadGoogleIdentityScript()
    return new Promise((resolve, reject) => {
      const gis = (window as unknown as {
        google?: {
          accounts?: {
            oauth2?: {
              initTokenClient(cfg: {
                client_id: string
                scope: string
                callback: (resp: { access_token?: string; expires_in?: number; error?: string }) => void
              }): { requestAccessToken(opts?: { prompt?: string }): void }
            }
          }
        }
      }).google?.accounts?.oauth2
      if (!gis) {
        reject(new SyncError('Google-Identity-SDK konnte nicht geladen werden', 'network'))
        return
      }
      const client = gis.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: async resp => {
          if (resp.error || !resp.access_token) {
            reject(new SyncError(`Google OAuth Fehler: ${resp.error}`, 'auth'))
            return
          }
          const token: StoredToken = {
            accessToken: resp.access_token,
            expiresAt: Date.now() + (resp.expires_in ?? 3600) * 1000,
          }
          await saveToken(token)
          this._authenticated = true
          resolve()
        },
      })
      client.requestAccessToken({ prompt: '' })
    })
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
      await driveUpload('PATCH', fileId, { name: SYNC_FILE_NAME }, body, 'application/json', token)
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
    this._authenticated = false
  }
}

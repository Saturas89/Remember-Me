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

const TOKEN_IDB = 'rm-sync-auth'
const TOKEN_STORE = 'tokens'
const ONEDRIVE_TOKEN_KEY = 'rm-sync-onedrive-token'
const APP_VERSION = '2.0.1'

interface StoredToken {
  accessToken: string
  expiresAt: number
  accountId: string
}

type MediaManifestEntry = { type: 'image' | 'audio' | 'video'; syncedAt: string }

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'
const APP_ROOT = `${GRAPH_BASE}/me/drive/special/approot`

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
      const req = tx.objectStore(TOKEN_STORE).get(ONEDRIVE_TOKEN_KEY)
      req.onsuccess = () => resolve((req.result as StoredToken | undefined) ?? null)
      req.onerror = () => reject(req.error)
    })
  } catch { return null }
}

async function saveToken(t: StoredToken): Promise<void> {
  const db = await openTokenDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(TOKEN_STORE, 'readwrite')
    tx.objectStore(TOKEN_STORE).put(t, ONEDRIVE_TOKEN_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function clearToken(): Promise<void> {
  try {
    const db = await openTokenDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(TOKEN_STORE, 'readwrite')
      tx.objectStore(TOKEN_STORE).delete(ONEDRIVE_TOKEN_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch { /* best-effort */ }
}

async function getValidToken(): Promise<string> {
  const stored = await loadToken()
  if (!stored || stored.expiresAt <= Date.now() + 60_000) {
    throw new SyncError('Kein gültiger OneDrive-Token – bitte erneut anmelden', 'auth')
  }
  return stored.accessToken
}

async function graphPut(path: string, body: Blob | string, mimeType: string, token: string): Promise<void> {
  const res = await fetch(`${APP_ROOT}:/${path}:/content`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': mimeType,
    },
    body,
  })
  if (res.status === 401) throw new SyncError('OneDrive-Authentifizierung abgelaufen', 'auth')
  if (!res.ok) throw new SyncError(`OneDrive-Upload fehlgeschlagen: ${res.status}`, 'network')
}

async function graphGet(path: string, token: string): Promise<Response> {
  const res = await fetch(`${APP_ROOT}:/${path}:/content`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) throw new SyncError('OneDrive-Authentifizierung abgelaufen', 'auth')
  return res
}

export class OneDriveProvider implements SyncProvider {
  readonly type: SyncProviderType = 'onedrive'

  private _authenticated = false
  private _syncId: string | null

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
    const clientId = import.meta.env.VITE_MS_CLIENT_ID as string | undefined
    if (!clientId) throw new SyncError('VITE_MS_CLIENT_ID nicht gesetzt', 'auth')

    const { PublicClientApplication } = await import('@azure/msal-browser')
    const msalConfig = {
      auth: {
        clientId,
        authority: 'https://login.microsoftonline.com/common',
        redirectUri: `${window.location.origin}/sync-callback`,
      },
      cache: { cacheLocation: 'sessionStorage' as const },
    }
    const msal = new PublicClientApplication(msalConfig)
    await msal.initialize()

    const result = await msal.loginPopup({
      scopes: ['Files.ReadWrite.AppFolder', 'User.Read'],
    })
    const tokenResult = await msal.acquireTokenSilent({
      scopes: ['Files.ReadWrite.AppFolder'],
      account: result.account,
    })
    const token: StoredToken = {
      accessToken: tokenResult.accessToken,
      expiresAt: tokenResult.expiresOn?.getTime() ?? Date.now() + 3600_000,
      accountId: result.account.homeAccountId,
    }
    await saveToken(token)
    this._authenticated = true
  }

  async signOut(): Promise<void> {
    await clearToken()
    this._authenticated = false
  }

  /**
   * Probe OneDrive for an existing sync file and return its syncId without
   * decrypting. See GoogleDriveProvider.readExistingSyncId for context.
   */
  async readExistingSyncId(): Promise<string | null> {
    try {
      const token = await getValidToken()
      const res = await graphGet('remember-me-sync.json', token)
      if (res.status === 404 || !res.ok) return null
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
    const localIds = await media.listLocalMediaIds()
    const manifest: Record<string, MediaManifestEntry> = {}

    await Promise.all([
      ...localIds.images.map(async id => {
        const blob = await media.getImageBlob(id)
        if (!blob) return
        await graphPut(`media/${id}.bin`, blob, blob.type, token)
        manifest[id] = { type: 'image', syncedAt: new Date().toISOString() }
      }),
      ...localIds.audio.map(async id => {
        const blob = await media.getAudioBlob(id)
        if (!blob) return
        await graphPut(`media/${id}.bin`, blob, blob.type, token)
        manifest[id] = { type: 'audio', syncedAt: new Date().toISOString() }
      }),
      ...localIds.videos.map(async id => {
        const blob = await media.getVideoBlob(id)
        if (!blob) return
        await graphPut(`media/${id}.bin`, blob, blob.type, token)
        manifest[id] = { type: 'video', syncedAt: new Date().toISOString() }
      }),
    ])

    const envelope = await encryptSyncEnvelope({
      state,
      mediaManifest: manifest,
      vaultKey,
      syncId,
      appVersion: APP_VERSION,
    })
    await graphPut('remember-me-sync.json', JSON.stringify(envelope), 'application/json', token)
  }

  async pull(localState: AppState, media: MediaStoreAccessor): Promise<PullResult | null> {
    const { key: vaultKey } = await this._requireVaultKey()
    const token = await getValidToken()
    const res = await graphGet('remember-me-sync.json', token)
    if (res.status === 404 || !res.ok) return null

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
        const mediaRes = await graphGet(`media/${id}.bin`, token)
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

  async deactivate(_deleteRemote: boolean): Promise<void> {
    if (this._syncId) {
      const { clearCachedVaultKey } = await import('./recoveryCode')
      await clearCachedVaultKey(this._syncId).catch(() => {})
    }
    await clearToken()
    this._authenticated = false
  }
}

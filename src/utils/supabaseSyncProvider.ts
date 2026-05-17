import type { AppState, SyncProviderType } from '../types'
import type { SyncProvider, MediaStoreAccessor, PullResult } from './privateSyncProvider'
import { SyncError } from './privateSyncProvider'
import { mergeStates } from './privateSyncMerge'
import {
  encryptText,
  decryptText,
  cacheVaultKey,
  loadCachedVaultKey,
  clearCachedVaultKey,
} from './recoveryCode'
import { getSyncSupabaseClient, resetSyncSupabaseClient } from './privateSyncClient'

export class SupabaseSyncProvider implements SyncProvider {
  readonly type: SyncProviderType = 'supabase'

  private _userId: string | null = null

  constructor(userId?: string) {
    if (userId) this._userId = userId
    else {
      getSyncSupabaseClient().auth.getUser().then(({ data }) => {
        this._userId = data.user?.id ?? null
      }).catch((err: unknown) => {
        console.warn('[SupabaseSyncProvider] Background auth check failed', err)
      })
    }
  }

  isAuthenticated(): boolean {
    return this._userId !== null
  }

  async signIn(): Promise<void> {
    throw new Error('signIn is handled by the setup wizard, not the provider directly')
  }

  async signOut(): Promise<void> {
    if (this._userId) await clearCachedVaultKey(this._userId)
    try { await getSyncSupabaseClient().auth.signOut() } catch { /* best-effort */ }
    resetSyncSupabaseClient()
    this._userId = null
  }

  async push(state: AppState, _media: MediaStoreAccessor): Promise<void> {
    const userId = await this._requireUserId()
    const key = await loadCachedVaultKey(userId)
    if (!key) throw new SyncError('Kein Vault-Key – Recovery Code fehlt', 'decrypt')

    // H5: embed the monotonic envelope version *inside* the encrypted
    // payload so a server-controlled attacker can't forge a high value
    // to bypass the replay guard. The bigint `version` column is kept
    // for back-compat and as an optimistic-concurrency aid, but the
    // authoritative counter is the encrypted one.
    const { loadKdfParams, loadLastSeenVersion, saveLastSeenVersion } =
      await import('./recoveryCode')
    const nextVersion = (await loadLastSeenVersion(userId)) + 1
    const json = JSON.stringify({ state, envelopeVersion: nextVersion })
    const { ct, iv } = await encryptText(json, key)

    // H7: forward the locally cached PBKDF2 salt + iterations so a new
    // device can re-derive the vault key from the recovery code. NULL salt
    // marks legacy v2 rows (salt = userId, 200_000 iter).
    const cachedKdf = await loadKdfParams(userId)
    const saltB64 = cachedKdf
      ? btoa(String.fromCharCode(...cachedKdf.salt))
      : null

    const supabase = getSyncSupabaseClient()
    const { error } = await supabase.from('private_sync_state').upsert({
      user_id: userId,
      state_ct: ct,
      state_iv: iv,
      encryption: 'recovery-code',
      version: nextVersion,
      updated_at: new Date().toISOString(),
      salt: saltB64,
    })
    if (!error) await saveLastSeenVersion(userId, nextVersion)
    if (error) {
      if (error.code === 'PGRST301' || String(error.message).includes('401')) {
        throw new SyncError('Supabase-Authentifizierung abgelaufen', 'auth')
      }
      throw new SyncError(`Supabase-Fehler: ${error.message}`, 'unknown')
    }
  }

  async pull(localState: AppState, _media: MediaStoreAccessor): Promise<PullResult | null> {
    const userId = await this._requireUserId()
    const key = await loadCachedVaultKey(userId)
    if (!key) throw new SyncError('Kein Vault-Key – Recovery Code fehlt', 'decrypt')

    const supabase = getSyncSupabaseClient()
    const { data, error } = await supabase
      .from('private_sync_state')
      .select('state_ct, state_iv')
      .eq('user_id', userId)
      .single()

    if (error?.code === 'PGRST116') return null
    if (error) throw new SyncError(`Supabase-Lesefehler: ${error.message}`, 'unknown')
    if (!data) return null

    const plain = await decryptText(data.state_ct as string, data.state_iv as string, key)
    const parsed = JSON.parse(plain) as AppState | { state: AppState; envelopeVersion?: number }

    // H5: payloads pushed before this PR are the raw AppState; new payloads
    // wrap it in `{ state, envelopeVersion }`. Detect via presence of the
    // wrapper shape — legacy reads default to version=0 (= "no replay
    // history yet", first pull accepts anything).
    let remote: AppState
    let remoteVersion = 0
    if (parsed && typeof parsed === 'object' && 'state' in parsed && typeof (parsed as { envelopeVersion?: unknown }).envelopeVersion === 'number') {
      const wrapped = parsed as { state: AppState; envelopeVersion: number }
      remote = wrapped.state
      remoteVersion = wrapped.envelopeVersion
    } else {
      remote = parsed as AppState
    }

    const { loadLastSeenVersion, saveLastSeenVersion } = await import('./recoveryCode')
    const lastSeen = await loadLastSeenVersion(userId)
    if (remoteVersion < lastSeen) {
      throw new SyncError(
        `Veralteter Sync-Stand erkannt (Version ${remoteVersion} < ${lastSeen}) — möglicher Replay.`,
        'unknown',
      )
    }
    if (remoteVersion > lastSeen) {
      await saveLastSeenVersion(userId, remoteVersion)
    }

    return { merged: mergeStates(localState, remote), downloadedMediaIds: [] }
  }

  async deactivate(deleteRemote: boolean): Promise<void> {
    const userId = this._userId
    if (deleteRemote && userId) {
      try {
        const supabase = getSyncSupabaseClient()
        await supabase.from('private_sync_state').delete().eq('user_id', userId)
      } catch { /* best-effort */ }
    }
    if (userId) await clearCachedVaultKey(userId)
    try { await getSyncSupabaseClient().auth.signOut() } catch { /* best-effort */ }
    resetSyncSupabaseClient()
    this._userId = null
  }

  async setupVaultKey(recoveryCode: string, userId: string): Promise<void> {
    const { deriveVaultKey, freshKdfParams, legacyKdfParams, cacheKdfParams } =
      await import('./recoveryCode')

    // H7: try to read an existing row's salt first — covers the "returning
    // user on a new device" case where we must use the same params the
    // first device generated. If the row is absent (first-ever setup) we
    // generate a fresh random salt; if the row has no salt (legacy v2) we
    // fall back to the old derivation so existing data stays readable.
    const supabase = getSyncSupabaseClient()
    const { data } = await supabase
      .from('private_sync_state')
      .select('salt')
      .eq('user_id', userId)
      .maybeSingle()

    let params
    if (data?.salt) {
      const saltBytes = Uint8Array.from(atob(data.salt as string), c => c.charCodeAt(0))
      params = { salt: saltBytes, iterations: 600_000 }
    } else if (data) {
      // Row exists but salt column is NULL → v2 legacy.
      params = legacyKdfParams(userId)
    } else {
      params = freshKdfParams()
    }

    const key = await deriveVaultKey(recoveryCode, params)
    await cacheVaultKey(userId, key)
    await cacheKdfParams(userId, params)
    this._userId = userId
  }

  private async _requireUserId(): Promise<string> {
    if (this._userId) return this._userId
    const { data } = await getSyncSupabaseClient().auth.getUser()
    if (!data.user?.id) throw new SyncError('Nicht angemeldet', 'auth')
    this._userId = data.user.id
    return this._userId
  }
}

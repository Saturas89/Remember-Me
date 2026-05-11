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

    const json = JSON.stringify(state)
    const { ct, iv } = await encryptText(json, key)

    // H7: forward the locally cached PBKDF2 salt + iterations so a new
    // device can re-derive the vault key from the recovery code. NULL salt
    // marks legacy v2 rows (salt = userId, 200_000 iter).
    const { loadKdfParams } = await import('./recoveryCode')
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
      version: Date.now(),
      updated_at: new Date().toISOString(),
      salt: saltB64,
    })
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
    const remote = JSON.parse(plain) as AppState
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

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

    const supabase = getSyncSupabaseClient()
    const { error } = await supabase.from('private_sync_state').upsert({
      user_id: userId,
      state_ct: ct,
      state_iv: iv,
      encryption: 'recovery-code',
      version: Date.now(),
      updated_at: new Date().toISOString(),
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
    const { deriveVaultKey } = await import('./recoveryCode')
    const key = await deriveVaultKey(recoveryCode, userId)
    await cacheVaultKey(userId, key)
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

// ── Supabase client for online sharing ──────────────────────────────────────
//
// Only loaded when the user has actively opted in to online sharing. All
// entry points in this module are guarded by a runtime feature check, so the
// offline-only code path never imports this file (Vite dynamic-import splits
// it into a separate chunk).

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface SharingConfig {
  url: string
  anonKey: string
}

export function readConfig(): SharingConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (!url || !anonKey) return null
  return { url, anonKey }
}

export function isOnlineSharingConfigured(): boolean {
  return readConfig() !== null
}

let _client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client
  const cfg = readConfig()
  if (!cfg) {
    throw new Error('online sharing is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)')
  }
  _client = createClient(cfg.url, cfg.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  })
  return _client
}

/**
 * Reset the client (used by the deactivate-sharing flow). After this call
 * the next getSupabaseClient() returns a fresh client — useful after
 * signOut() so cached auth state is dropped.
 */
export function resetSupabaseClient(): void {
  _client = null
}

/**
 * Sign in anonymously and return the user id. Called once when the user
 * opts in; the session is then persisted by supabase-js.
 */
export async function ensureAnonymousSession(): Promise<string> {
  const supabase = getSupabaseClient()
  const { data: existing } = await supabase.auth.getSession()
  if (existing.session?.user?.id) return existing.session.user.id

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  if (!data.user?.id) throw new Error('supabase anonymous sign-in returned no user id')
  return data.user.id
}

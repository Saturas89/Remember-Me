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

// Supabase uses fetch() without a built-in timeout; on flaky mobile
// connections requests can hang indefinitely. We cap each individual
// request at 20 s so callers get a real rejection they can surface.
export const SUPABASE_FETCH_TIMEOUT_MS = 20_000

export function fetchWithTimeout(url: RequestInfo | URL, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SUPABASE_FETCH_TIMEOUT_MS)
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer))
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
      // In E2E, skip the automatic initialize() call that supabase-js fires on
      // client construction. initialize() acquires navigator.locks and runs
      // _recoverAndRefresh() — on Playwright's iPhone 14 emulation (hasTouch:true)
      // the lock can hit its 5 s acquire-timeout, triggering the steal() path and
      // pushing bootstrapSession latency past readDeviceIdentity's 15 s budget.
      // Skipping auto-init is safe in E2E: each Playwright BrowserContext starts
      // fresh (no session to recover) and getSession() still loads any session
      // written by signInAnonymously() because _useSession reads localStorage directly.
      ...(import.meta.env.VITE_E2E === 'true' ? { skipAutoInitialize: true } : {}),
    },
    global: { fetch: fetchWithTimeout },
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

// ── Supabase client for online sharing ──────────────────────────────────────
//
// Only loaded when the user has actively opted in to online sharing. All
// entry points in this module are guarded by a runtime feature check, so the
// offline-only code path never imports this file (Vite dynamic-import splits
// it into a separate chunk).

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { GoTrueClient } from '@supabase/auth-js'

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
      // Playwright's iPhone 14 emulation (hasTouch:true, isMobile:true) delivers
      // navigator.locks.request() callbacks with a >35 s delay, causing
      // bootstrapSession to exceed the readDeviceIdentity budget and flaking
      // ~6 family-mode tests.
      //
      // skipAutoInitialize / lockAcquireTimeout are silently dropped by
      // supabase-js's _initSupabaseAuthClient (not in its destructuring list).
      // GoTrueClient therefore always calls initialize() despite our intent.
      // The lock bypass IS forwarded and keeps each lock acquisition fast, but
      // initialize() itself can still block on iPhone 14 WebKit inside
      // _handleVisibilityChange().  The injected-auth workaround below is the
      // real fix; these options are kept as documentation / fallback.
      ...(import.meta.env.VITE_E2E === 'true'
        ? {
            skipAutoInitialize: true,
            lockAcquireTimeout: -1,
            lock: typeof navigator !== 'undefined' && /iPhone/.test(navigator.userAgent)
              ? <R>(_: string, __: number, fn: () => Promise<R>) => fn()
              : undefined,
          }
        : {}),
    },
    global: { fetch: fetchWithTimeout },
  })

  // E2E iPhone 14 fix: supabase-js silently drops skipAutoInitialize so
  // GoTrueClient.initialize() fires and can block on Playwright's iPhone 14
  // WebKit emulation.  Replace the auth instance post-construction with a
  // fresh GoTrueClient that truly has skipAutoInitialize:true so
  // initializePromise stays null (await null resolves in the next microtask).
  if (import.meta.env.VITE_E2E === 'true' && typeof navigator !== 'undefined' && /iPhone/.test(navigator.userAgent)) {
    const iPhoneLock = <R>(_: string, __: number, fn: () => Promise<R>) => fn()
    const injectedAuth = new GoTrueClient({
      url: `${cfg.url}/auth/v1`,
      storageKey: 'supabase.auth.token',
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
      skipAutoInitialize: true,
      lockAcquireTimeout: -1,
      lock: iPhoneLock,
      headers: { apikey: cfg.anonKey },
      fetch: fetchWithTimeout,
    })
    ;(_client as unknown as { auth: GoTrueClient }).auth = injectedAuth
  }

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

  const isE2E = localStorage.getItem('traffic_type') === 'e2e'
  const { data, error } = await supabase.auth.signInAnonymously(
    isE2E ? { options: { data: { traffic_type: 'e2e' } } } : {},
  )
  if (error) throw error
  if (!data.user?.id) throw new Error('supabase anonymous sign-in returned no user id')
  return data.user.id
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { GoTrueClient } from '@supabase/auth-js'
import { fetchWithTimeout } from './supabaseClient'

let _syncClient: SupabaseClient | null = null

export function getSyncSupabaseClient(): SupabaseClient {
  if (_syncClient) return _syncClient
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (!url || !anonKey) {
    throw new Error('Supabase not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)')
  }
  _syncClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'rm-sync-session',
      // PKCE: the OAuth response comes back as `?code=…` instead of a URL
      // hash carrying the bearer token directly. Supabase's
      // detectSessionInUrl auto-exchanges the code for a session and emits
      // SIGNED_IN with provider_token. PKCE binds the redirect to the
      // originating client via a code_verifier in storage, which closes
      // the OAuth-CSRF window the implicit flow left open. See REQ-017
      // security audit Critical #2.
      flowType: 'pkce',
      ...(import.meta.env.VITE_E2E === 'true'
        ? {
            lock: typeof navigator !== 'undefined' && /iPhone/.test(navigator.userAgent)
              ? <R>(_: string, __: number, fn: () => Promise<R>) => fn()
              : undefined,
          }
        : {}),
    },
    global: { fetch: fetchWithTimeout },
  })

  if (import.meta.env.VITE_E2E === 'true' && typeof navigator !== 'undefined' && /iPhone/.test(navigator.userAgent)) {
    const iPhoneLock = <R>(_: string, __: number, fn: () => Promise<R>) => fn()
    const injectedAuth = new GoTrueClient({
      url: `${url}/auth/v1`,
      storageKey: 'rm-sync-session',
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
      skipAutoInitialize: true,
      lockAcquireTimeout: -1,
      lock: iPhoneLock,
      headers: { apikey: anonKey },
      fetch: fetchWithTimeout,
    })
    ;(_syncClient as unknown as { auth: GoTrueClient }).auth = injectedAuth
  }

  return _syncClient
}

export function resetSyncSupabaseClient(): void {
  _syncClient = null
}

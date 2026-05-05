import { createClient, type SupabaseClient } from '@supabase/supabase-js'
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
  return _syncClient
}

export function resetSyncSupabaseClient(): void {
  _syncClient = null
}

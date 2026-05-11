// ── Isolated sharingService loader for multi-user integration tests ──────
//
// `sharingService.ts` cached eine Session und der `supabaseClient` cached
// einen Singleton-Client. Für einen Multi-User-Test brauchen wir pro „Gerät"
// frische Modul-Zustände — sonst würde User B's `bootstrapSession()` einfach
// User A's gecachte Session zurückgeben.
//
// `vi.resetModules()` + `vi.doMock()` gibt uns das. Die Backend-Instanz lebt
// **außerhalb** der Modul-Graphen (im Test-Scope), sodass beide isolierten
// `sharingService`-Instanzen gegen denselben In-Memory-Server arbeiten.

import { vi } from 'vitest'
import type { Backend } from './supabaseFake'
import { createFakeSupabaseClient } from './supabaseFake'
import type {
  shareMemory,
  fetchIncomingShares,
  addAnnotation,
  bootstrapSession,
  deactivateOnlineSharing,
  lookupRecipientPublicKey,
} from '../utils/sharingService'

export interface IsolatedSharingApi {
  bootstrapSession: typeof bootstrapSession
  shareMemory: typeof shareMemory
  fetchIncomingShares: typeof fetchIncomingShares
  addAnnotation: typeof addAnnotation
  deactivateOnlineSharing: typeof deactivateOnlineSharing
  lookupRecipientPublicKey: typeof lookupRecipientPublicKey
}

/**
 * Lädt `sharingService` mit einer frischen Modul-Instanz und verdrahtet sie
 * gegen den übergebenen In-Memory-Backend. Wiederholtes Aufrufen liefert je
 * eine voneinander unabhängige Session — wie zwei verschiedene Geräte.
 */
export async function loadIsolatedSharing(backend: Backend): Promise<IsolatedSharingApi> {
  vi.resetModules()

  const client = createFakeSupabaseClient(backend)

  vi.doMock('../utils/supabaseClient', () => ({
    getSupabaseClient: () => client,
    ensureAnonymousSession: async () => {
      const { data: existing } = await client.auth.getSession()
      if (existing.session?.user?.id) return existing.session.user.id
      const { data, error } = await client.auth.signInAnonymously()
      if (error) throw error
      if (!data.user?.id) throw new Error('fake anonymous sign-in returned no user id')
      return data.user.id
    },
    resetSupabaseClient: () => {},
    readConfig: () => ({ url: 'http://fake.test', anonKey: 'fake-anon' }),
    isOnlineSharingConfigured: () => true,
    fetchWithTimeout: (...args: Parameters<typeof fetch>) => fetch(...args),
    SUPABASE_FETCH_TIMEOUT_MS: 1_000,
  }))

  vi.doMock('../utils/deviceKeyStore', async () => {
    const { generateDeviceKeyPair, exportPublicKey } = await import('../utils/crypto')
    type Cached = { keyPair: Awaited<ReturnType<typeof generateDeviceKeyPair>>; publicKeyB64: string }
    let cached: Cached | null = null
    return {
      loadOrCreateDeviceKey: async (): Promise<Cached> => {
        if (cached) return cached
        const keyPair = await generateDeviceKeyPair()
        const publicKeyB64 = await exportPublicKey(keyPair.publicKey)
        cached = { keyPair, publicKeyB64 }
        return cached
      },
      clearDeviceKey: async () => {
        cached = null
      },
    }
  })

  const mod = await import('../utils/sharingService')
  return {
    bootstrapSession: mod.bootstrapSession,
    shareMemory: mod.shareMemory,
    fetchIncomingShares: mod.fetchIncomingShares,
    addAnnotation: mod.addAnnotation,
    deactivateOnlineSharing: mod.deactivateOnlineSharing,
    lookupRecipientPublicKey: mod.lookupRecipientPublicKey,
  }
}

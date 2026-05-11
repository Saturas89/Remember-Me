// @vitest-environment jsdom
//
// Unit tests for GoogleDriveProvider.resumeFromOAuth — guards against the
// regression where the user lands on the login screen with
// "Google-Authentifizierung fehlgeschlagen" after a successful Google redirect.

import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'

// ── Supabase auth mock ─────────────────────────────────────────────────────

type AuthEvent = 'INITIAL_SESSION' | 'SIGNED_IN' | 'TOKEN_REFRESHED' | 'SIGNED_OUT'
type Session = { provider_token?: string; expires_at?: number } | null
type AuthListener = (event: AuthEvent, session: Session) => void

const recorder = {
  listeners: [] as AuthListener[],
  session: null as Session,
  getSessionCalls: 0,
}

const mockSupabase = {
  auth: {
    onAuthStateChange(cb: AuthListener) {
      recorder.listeners.push(cb)
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              const i = recorder.listeners.indexOf(cb)
              if (i >= 0) recorder.listeners.splice(i, 1)
            },
          },
        },
      }
    },
    getSession: () => {
      recorder.getSessionCalls += 1
      return Promise.resolve({ data: { session: recorder.session } })
    },
  },
}

import { vi } from 'vitest'

vi.mock('./privateSyncClient', () => ({
  getSyncSupabaseClient: () => mockSupabase,
  resetSyncSupabaseClient: vi.fn(),
}))

// Stand-ins for the heavyweight crypto deps that push() pulls in. The
// resumeFromOAuth tests don't exercise these, so the dummies stay inert there.
vi.mock('./recoveryCode', () => ({
  loadCachedVaultKey: vi.fn(),
  clearCachedVaultKey: vi.fn(async () => {}),
  loadKdfParams: vi.fn(async () => null),
  loadLastSeenVersion: vi.fn(async () => 0),
  saveLastSeenVersion: vi.fn(async () => {}),
}))
vi.mock('./syncEncryption', () => ({
  encryptSyncEnvelope: vi.fn(async () => ({ v: 2, ciphertext: 'mock', iv: 'mock', salt: 'mock' })),
  decryptSyncEnvelope: vi.fn(),
  parseEncryptedSyncEnvelope: vi.fn(),
}))

import { GoogleDriveProvider } from './googleDriveProvider'
import { loadCachedVaultKey } from './recoveryCode'

const OAUTH_KEY = 'rm-gdrive-oauth-pending'

function setHash(hash: string): void {
  window.location.hash = hash
}

// Wait for any pending dynamic imports / IndexedDB transactions / microtasks
// to settle. A few ticks of `setTimeout(0)` are enough; we never depend on
// real wall-clock time in these tests.
async function flush(times = 5): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await new Promise(r => setTimeout(r, 0))
  }
}

beforeEach(() => {
  recorder.listeners = []
  recorder.session = null
  recorder.getSessionCalls = 0
  sessionStorage.clear()
  setHash('')
})

describe('GoogleDriveProvider.resumeFromOAuth (PKCE)', () => {
  it('returns false when no OAuth pending flag is set', async () => {
    const p = new GoogleDriveProvider()
    expect(await p.resumeFromOAuth()).toBe(false)
  })

  it('takes provider_token from the SIGNED_IN session emitted by detectSessionInUrl', async () => {
    sessionStorage.setItem(OAUTH_KEY, '1')
    // Persisted session that getSession() returns once the listener has
    // fired — drives the expiry resolution path.
    recorder.session = {
      provider_token: 'google-token-pkce',
      expires_at: Math.floor(Date.now() / 1000) + 1800,
    }

    const p = new GoogleDriveProvider()
    const resumePromise = p.resumeFromOAuth()

    // Wait for the dynamic import + listener registration to settle.
    await flush()
    expect(recorder.listeners.length).toBe(1)

    recorder.listeners[0]('SIGNED_IN', {
      provider_token: 'google-token-pkce',
      expires_at: Math.floor(Date.now() / 1000) + 1800,
    })

    expect(await resumePromise).toBe(true)
    expect(p.isAuthenticated()).toBe(true)
    expect(sessionStorage.getItem(OAUTH_KEY)).toBeNull()
    // Expiry is sourced from getSession() — no URL hash to read it from.
    expect(recorder.getSessionCalls).toBe(1)
  })

  it('returns false when the listener emits INITIAL_SESSION without a session', async () => {
    sessionStorage.setItem(OAUTH_KEY, '1')

    const p = new GoogleDriveProvider()
    const resumePromise = p.resumeFromOAuth()

    await flush()
    expect(recorder.listeners.length).toBe(1)

    // PKCE exchange failed (or the user landed on /sync with no OAuth
    // round-trip in progress). Supabase emits INITIAL_SESSION with a null
    // session — resumeFromOAuth must give up cleanly.
    recorder.listeners[0]('INITIAL_SESSION', null)

    expect(await resumePromise).toBe(false)
    expect(sessionStorage.getItem(OAUTH_KEY)).toBeNull()
  })

  it('scrubs a stale implicit-flow hash left over from a pre-PKCE upgrade', async () => {
    sessionStorage.setItem(OAUTH_KEY, '1')
    // A user who started OAuth on the old implicit-flow build and only
    // returns after the upgrade still has #access_token=… in their URL.
    setHash('#access_token=stale-from-implicit&token_type=bearer')

    const p = new GoogleDriveProvider()
    const resumePromise = p.resumeFromOAuth()

    await flush()
    expect(recorder.listeners.length).toBe(1)
    recorder.listeners[0]('SIGNED_IN', {
      provider_token: 'google-token-pkce',
      expires_at: Math.floor(Date.now() / 1000) + 1800,
    })

    expect(await resumePromise).toBe(true)
    expect(window.location.hash).toBe('')
  })

  it('scrubs the OAuth hash even when resume fails', async () => {
    sessionStorage.setItem(OAUTH_KEY, '1')
    setHash('#access_token=stale&token_type=bearer')

    const p = new GoogleDriveProvider()
    const resumePromise = p.resumeFromOAuth()

    await flush()
    expect(recorder.listeners.length).toBe(1)
    recorder.listeners[0]('INITIAL_SESSION', null)

    expect(await resumePromise).toBe(false)
    expect(window.location.hash).toBe('')
  })

})

// ── push() 404-recovery ────────────────────────────────────────────────────
//
// Regression: after "Sync deaktivieren" the cached fileId pointed at a Drive
// file that no longer existed (deleteRemote=true had removed it; or the user
// trashed it manually). The next push PATCH'd the dead id and surfaced an
// opaque "Drive-Upload fehlgeschlagen: 404" to the user. push() now self-heals
// by clearing the cache and creating a fresh envelope file.

const TOKEN_IDB = 'rm-sync-auth'
const TOKEN_STORE = 'tokens'
const TOKEN_KEY = 'rm-sync-gdrive-token'
const FILE_ID_KEY = 'rm-sync-gdrive-fileid'

async function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(TOKEN_IDB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(TOKEN_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbPut(key: string, value: unknown): Promise<void> {
  const db = await openIdb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(TOKEN_STORE, 'readwrite')
    tx.objectStore(TOKEN_STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

async function idbGet<T = unknown>(key: string): Promise<T | undefined> {
  const db = await openIdb()
  const result = await new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(TOKEN_STORE, 'readonly')
    const req = tx.objectStore(TOKEN_STORE).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return result
}

async function idbClear(): Promise<void> {
  const db = await openIdb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(TOKEN_STORE, 'readwrite')
    tx.objectStore(TOKEN_STORE).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

const emptyState = {
  profile: null,
  answers: {},
  friends: [],
  friendAnswers: [],
  customQuestions: [],
} as unknown as Parameters<GoogleDriveProvider['push']>[0]

const emptyMedia = {
  getImageBlob: async () => null,
  getAudioBlob: async () => null,
  getVideoBlob: async () => null,
  putImage: async () => {},
  putAudio: async () => {},
  putVideo: async () => {},
  listLocalMediaIds: async () => ({ images: [], audio: [], videos: [] }),
}

interface FetchCall {
  url: string
  method: string
}

function installFetchMock(routes: Array<{
  match: (url: string, method: string) => boolean
  respond: () => Response | Promise<Response>
}>): { calls: FetchCall[] } {
  const calls: FetchCall[] = []
  globalThis.fetch = (vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL ? input.toString() : input.url
    const method = init?.method ?? 'GET'
    calls.push({ url, method })
    for (const r of routes) {
      if (r.match(url, method)) return r.respond()
    }
    return new Response(`unhandled: ${method} ${url}`, { status: 599 })
  }) as unknown) as typeof fetch
  return { calls }
}

describe('GoogleDriveProvider.push (404 recovery)', () => {
  beforeEach(async () => {
    await idbClear()
    vi.mocked(loadCachedVaultKey).mockResolvedValue({} as CryptoKey)
  })

  it('drops the cached fileId and re-uploads when PATCH returns 404', async () => {
    await idbPut(TOKEN_KEY, { accessToken: 'tok', expiresAt: Date.now() + 3600_000 })
    await idbPut(FILE_ID_KEY, 'stale-id')

    const { calls } = installFetchMock([
      // findOrCreateMediaFolder: search returns existing folder
      {
        match: (url, method) => method === 'GET' && url.includes('remember-me-media'),
        respond: () => new Response(JSON.stringify({ files: [{ id: 'folder' }] }), { status: 200 }),
      },
      // PATCH on the stale id → Drive replies 404
      {
        match: (url, method) => method === 'PATCH' && url.includes('/upload/drive/v3/files/stale-id'),
        respond: () => new Response(JSON.stringify({ error: { code: 404 } }), { status: 404 }),
      },
      // POST to create a fresh envelope file
      {
        match: (url, method) => method === 'POST' && /\/upload\/drive\/v3\/files\?/.test(url),
        respond: () => new Response(JSON.stringify({ id: 'fresh-id' }), { status: 200 }),
      },
    ])

    const provider = new GoogleDriveProvider('sync-1')
    await provider.push(emptyState, emptyMedia)

    const methods = calls.map(c => c.method)
    expect(methods).toContain('PATCH')
    expect(methods).toContain('POST')
    const patch = calls.find(c => c.method === 'PATCH')!
    expect(patch.url).toContain('/upload/drive/v3/files/stale-id')

    expect(await idbGet<string>(FILE_ID_KEY)).toBe('fresh-id')
  })

  it('propagates non-404 PATCH failures untouched', async () => {
    await idbPut(TOKEN_KEY, { accessToken: 'tok', expiresAt: Date.now() + 3600_000 })
    await idbPut(FILE_ID_KEY, 'cached-id')

    installFetchMock([
      {
        match: (url, method) => method === 'GET' && url.includes('remember-me-media'),
        respond: () => new Response(JSON.stringify({ files: [{ id: 'folder' }] }), { status: 200 }),
      },
      {
        match: (_url, method) => method === 'PATCH',
        respond: () => new Response(JSON.stringify({ error: { code: 500 } }), { status: 500 }),
      },
    ])

    const provider = new GoogleDriveProvider('sync-1')
    await expect(provider.push(emptyState, emptyMedia)).rejects.toThrow(/500/)
    // Cache must NOT be wiped on a non-stale failure.
    expect(await idbGet<string>(FILE_ID_KEY)).toBe('cached-id')
  })

  it('findSyncFile filters trashed files', async () => {
    await idbPut(TOKEN_KEY, { accessToken: 'tok', expiresAt: Date.now() + 3600_000 })
    // No FILE_ID_KEY → push will call findSyncFile.

    const { calls } = installFetchMock([
      {
        match: (url, method) => method === 'GET' && url.includes('remember-me-media'),
        respond: () => new Response(JSON.stringify({ files: [{ id: 'folder' }] }), { status: 200 }),
      },
      {
        match: (url, method) => method === 'GET' && url.includes('remember-me-sync.json'),
        respond: () => new Response(JSON.stringify({ files: [] }), { status: 200 }),
      },
      {
        match: (url, method) => method === 'POST' && /\/upload\/drive\/v3\/files\?/.test(url),
        respond: () => new Response(JSON.stringify({ id: 'fresh-id' }), { status: 200 }),
      },
    ])

    const provider = new GoogleDriveProvider('sync-1')
    await provider.push(emptyState, emptyMedia)

    const search = calls.find(c => c.method === 'GET' && c.url.includes('remember-me-sync.json'))
    expect(search).toBeDefined()
    expect(search!.url).toContain('trashed=false')
  })

  it('deactivate clears the cached fileId so a stale id from a previous setup cannot leak in', async () => {
    await idbPut(TOKEN_KEY, { accessToken: 'tok', expiresAt: Date.now() + 3600_000 })
    await idbPut(FILE_ID_KEY, 'old-id')

    const provider = new GoogleDriveProvider('sync-1')
    await provider.deactivate(false)

    expect(await idbGet(FILE_ID_KEY)).toBeUndefined()
    expect(await idbGet(TOKEN_KEY)).toBeUndefined()
  })
})

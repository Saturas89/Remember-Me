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

import { GoogleDriveProvider, parseProviderTokenFromHash } from './googleDriveProvider'

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

describe('parseProviderTokenFromHash', () => {
  it('extracts provider_token and expires_in from a Supabase implicit hash', () => {
    const hash = '#access_token=abc&expires_in=3600&provider_token=ya29.xyz&token_type=bearer&refresh_token=r'
    expect(parseProviderTokenFromHash(hash)).toEqual({
      providerToken: 'ya29.xyz',
      expiresIn: 3600,
    })
  })

  it('returns nulls for an empty or hashless URL', () => {
    expect(parseProviderTokenFromHash('')).toEqual({ providerToken: null, expiresIn: null })
    expect(parseProviderTokenFromHash('#')).toEqual({ providerToken: null, expiresIn: null })
  })

  it('handles missing provider_token gracefully', () => {
    expect(parseProviderTokenFromHash('#access_token=abc&token_type=bearer'))
      .toEqual({ providerToken: null, expiresIn: null })
  })

  it('rejects non-numeric expires_in', () => {
    expect(parseProviderTokenFromHash('#provider_token=t&expires_in=oops').expiresIn).toBeNull()
  })
})

describe('GoogleDriveProvider.resumeFromOAuth', () => {
  it('returns false when no OAuth pending flag is set', async () => {
    const p = new GoogleDriveProvider()
    expect(await p.resumeFromOAuth()).toBe(false)
  })

  it('reads provider_token directly from the URL hash (primary path)', async () => {
    sessionStorage.setItem(OAUTH_KEY, '1')
    setHash('#access_token=a&expires_in=3600&provider_token=google-token-1&token_type=bearer')

    const p = new GoogleDriveProvider()
    const ok = await p.resumeFromOAuth()

    expect(ok).toBe(true)
    expect(p.isAuthenticated()).toBe(true)
    expect(sessionStorage.getItem(OAUTH_KEY)).toBeNull()
    // Hash already had expires_in → no need to call getSession.
    expect(recorder.getSessionCalls).toBe(0)
    // Listener fallback was not used.
    expect(recorder.listeners.length).toBe(0)
  })

  it('falls back to onAuthStateChange when the hash has been consumed already', async () => {
    sessionStorage.setItem(OAUTH_KEY, '1')
    setHash('')

    const p = new GoogleDriveProvider()
    const resumePromise = p.resumeFromOAuth()

    // Wait for the dynamic import + listener registration to settle.
    await flush()
    expect(recorder.listeners.length).toBe(1)

    recorder.listeners[0]('SIGNED_IN', {
      provider_token: 'google-token-fallback',
      expires_at: Math.floor(Date.now() / 1000) + 1800,
    })

    expect(await resumePromise).toBe(true)
    expect(sessionStorage.getItem(OAUTH_KEY)).toBeNull()
  })

  it('returns false and clears the pending flag when the listener never sees a provider_token', async () => {
    sessionStorage.setItem(OAUTH_KEY, '1')
    setHash('')

    const p = new GoogleDriveProvider()
    const resumePromise = p.resumeFromOAuth()

    await flush()
    expect(recorder.listeners.length).toBe(1)

    // Supabase emits INITIAL_SESSION without a provider_token (post-detect
    // session, persisted form). resumeFromOAuth must give up cleanly.
    recorder.listeners[0]('INITIAL_SESSION', null)

    expect(await resumePromise).toBe(false)
    expect(sessionStorage.getItem(OAUTH_KEY)).toBeNull()
  })

  it('falls back to getSession expiry when the hash has no expires_in', async () => {
    sessionStorage.setItem(OAUTH_KEY, '1')
    setHash('#provider_token=just-token')
    recorder.session = { expires_at: Math.floor(Date.now() / 1000) + 600 }

    const p = new GoogleDriveProvider()
    expect(await p.resumeFromOAuth()).toBe(true)
    expect(recorder.getSessionCalls).toBe(1)
  })
})

import { expect, type BrowserContext, type Page } from '@playwright/test'

// Shared helpers for the REQ-017 Private-Sync E2E suite.

export const E2E_USER_ID = '00000000-0000-4000-8000-000000000001'

export async function dismissInstallPrompt(context: BrowserContext) {
  await context.addInitScript(() => {
    localStorage.setItem('rm-install-dismissed', '1')
  })
}

export async function completeOnboarding(page: Page, name: string) {
  await page.goto('/')
  await page.getByLabel('Wie heißt du?').fill(name)
  await page.getByRole('button', { name: /Loslegen/ }).click()
  await expect(page.getByText(new RegExp(`Hallo,\\s*${name}`))).toBeVisible()
}

export async function openSyncTab(page: Page) {
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  await nav.getByRole('button', { name: 'Sync', exact: true }).click()
}

/** Inject `appState.privateSync` directly so the hub view renders without
 *  having to walk the wizard. Pairs with `installPrivateSyncSupabaseMock`. */
export async function seedActiveSync(
  page: Page,
  providerType: 'google-drive' | 'onedrive' | 'supabase',
  userId: string = E2E_USER_ID,
) {
  await page.addInitScript(({ providerType, userId }) => {
    const raw = localStorage.getItem('remember-me-state') ?? '{}'
    const state = JSON.parse(raw)
    state.privateSync = {
      providerType,
      userId,
      lastSyncAt: null,
      status: 'idle',
      errorMessage: null,
      encryption: providerType === 'supabase' ? 'recovery-code' : undefined,
    }
    localStorage.setItem('remember-me-state', JSON.stringify(state))
  }, { providerType, userId })
}

// ── Supabase REST mock (private_sync_state) ───────────────────────────────
//
// Only the surface area exercised by E2E tests: signup/signin returning a
// user, getUser, and CRUD against the private_sync_state table.

export interface SyncMockState {
  user: { id: string; email: string }
  rows: Map<string, { state_ct: string; state_iv: string; encryption: string; updated_at: string }>
  log: { method: string; url: string }[]
}

export function createSyncMockState(): SyncMockState {
  return {
    user: { id: E2E_USER_ID, email: 'test@example.com' },
    rows: new Map(),
    log: [],
  }
}

export async function installPrivateSyncSupabaseMock(
  context: BrowserContext,
  state: SyncMockState,
): Promise<SyncMockState> {
  await context.route('http://supabase.e2e.local/**', async route => {
    const req = route.request()
    const url = new URL(req.url())
    state.log.push({ method: req.method(), url: req.url() })

    // ── Auth ───────────────────────────────────────────────────────────
    if (url.pathname.startsWith('/auth/v1/')) {
      const path = url.pathname.replace(/\/+$/, '')
      const baseUser = {
        id: state.user.id,
        aud: 'authenticated',
        role: 'authenticated',
        email: state.user.email,
        app_metadata: { provider: 'email' },
        user_metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const session = {
        access_token: `mock-${state.user.id}`,
        refresh_token: `mock-refresh-${state.user.id}`,
        expires_in: 3600,
        token_type: 'bearer',
        user: baseUser,
      }

      if (req.method() === 'POST' && path === '/auth/v1/token') {
        // Simulate "account not found" so the wizard takes the sign-up path
        // and shows the recovery-code screen (first-device flow, per E2E-01).
        return route.fulfill({
          status: 400, contentType: 'application/json',
          body: JSON.stringify({ error: 'invalid_grant', error_description: 'Email not confirmed' }),
        })
      }
      if (req.method() === 'POST' && path === '/auth/v1/signup') {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify(session),
        })
      }
      if (req.method() === 'GET' && path === '/auth/v1/user') {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify(baseUser),
        })
      }
      // logout / unknown auth → 200 noop
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    }

    // ── REST: private_sync_state ───────────────────────────────────────
    if (url.pathname.includes('/rest/v1/private_sync_state')) {
      const accept = (req.headers()['accept'] ?? '').toLowerCase()
      const wantsSingle = accept.includes('vnd.pgrst.object+json')
      const userParam = url.searchParams.get('user_id')?.replace(/^eq\./, '')

      if (req.method() === 'GET') {
        const row = userParam ? state.rows.get(userParam) : undefined
        if (!row) {
          if (wantsSingle) {
            return route.fulfill({
              status: 406, contentType: 'application/json',
              body: JSON.stringify({ code: 'PGRST116', message: 'no rows' }),
            })
          }
          return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
        }
        return route.fulfill({
          status: 200,
          contentType: wantsSingle ? 'application/vnd.pgrst.object+json' : 'application/json',
          body: JSON.stringify(wantsSingle ? row : [row]),
        })
      }
      if (req.method() === 'POST') {
        const body = JSON.parse(req.postData() || '{}')
        const arr = Array.isArray(body) ? body : [body]
        for (const r of arr) {
          state.rows.set(r.user_id, {
            state_ct: r.state_ct,
            state_iv: r.state_iv,
            encryption: r.encryption,
            updated_at: r.updated_at ?? new Date().toISOString(),
          })
        }
        return route.fulfill({ status: 201, contentType: 'application/json', body: '' })
      }
      if (req.method() === 'DELETE') {
        if (userParam) state.rows.delete(userParam)
        return route.fulfill({ status: 200, contentType: 'application/json', body: '' })
      }
    }

    return route.fulfill({
      status: 501, contentType: 'application/json',
      body: JSON.stringify({ message: `private-sync mock: unhandled ${req.method()} ${url.pathname}` }),
    })
  })

  return state
}

/** Stub `window.google.accounts.oauth2` so OAuth flows return a mock token
 *  immediately instead of opening a popup. Run via `context.addInitScript`. */
export async function installGoogleOAuthMock(context: BrowserContext) {
  await context.addInitScript(() => {
    interface TokenClient {
      requestAccessToken: (opts?: { prompt?: string }) => void
      callback?: (resp: { access_token: string; expires_in: number }) => void
    }
    interface GoogleNS {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string
            scope: string
            callback: (resp: { access_token: string; expires_in: number }) => void
          }) => TokenClient
        }
        id: {
          initialize: () => void
          renderButton: () => void
        }
      }
    }
    const w = window as Window & { google?: GoogleNS }
    w.google = {
      accounts: {
        oauth2: {
          initTokenClient: cfg => {
            const client: TokenClient = {
              requestAccessToken: () => {
                cfg.callback({ access_token: 'mock-google-token', expires_in: 3600 })
              },
              callback: cfg.callback,
            }
            return client
          },
        },
        id: {
          initialize: () => {},
          renderButton: () => {},
        },
      },
    }
  })
}

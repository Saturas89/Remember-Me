// Helpers for the real-DB Playwright suite (playwright.nightly.config.ts).
//
// Key difference from e2e/helpers/family-mode-helpers.ts: spawnRealDevice does
// NOT install the in-memory Supabase mock. Every Supabase call from the app
// goes to the real local PostgREST/GoTrue stack started by the CI job.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test'

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Returns a service-role client for test cleanup (admin.auth.admin.deleteUser).
export function supabaseAdmin(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  })
}

// Creates a browser context that talks to the real Supabase (no mock installed).
// Injects traffic_type=e2e and CI correlation IDs into localStorage so every
// session is filterable in PostHog regardless of which config runs the tests.
export async function spawnRealDevice(
  browser: Browser,
): Promise<{ ctx: BrowserContext; page: Page }> {
  const githubRunId    = process.env.GITHUB_RUN_ID   ?? null
  const browserProfile = process.env.BROWSER_PROFILE ?? null

  const ctx = await browser.newContext({ serviceWorkers: 'block' })
  await ctx.addInitScript(
    ({ runId, profile }) => {
      localStorage.setItem('rm-install-dismissed', '1')
      localStorage.setItem('traffic_type', 'e2e')
      if (!localStorage.getItem('remember-me-state')) {
        localStorage.setItem('remember-me-state', JSON.stringify({
          profile: null, answers: {}, friends: [], friendAnswers: [],
          customQuestions: [], appMode: 'full',
        }))
      }
      if (runId) {
        localStorage.setItem('github_run_id', runId)
        localStorage.setItem('test_run_id', `gh-${runId}`)
      }
      if (profile) localStorage.setItem('browser_profile', profile)
    },
    { runId: githubRunId, profile: browserProfile },
  )
  const page = await ctx.newPage()
  return { ctx, page }
}

// Reads the onlineSharing.deviceId from app state (equals auth.uid()).
// Used to collect IDs for post-test cleanup via the admin API.
export async function readDeviceId(page: Page): Promise<string> {
  const id = await page.waitForFunction(() => {
    try {
      const s = (window as unknown as { __rmState?: { get: () => Record<string, unknown> | null } })
        .__rmState?.get()
      const os = s?.onlineSharing as Record<string, string> | undefined
      return os?.deviceId || null
    } catch { return null }
  }, undefined, { timeout: 35_000 })
  return id.jsonValue() as Promise<string>
}

// Deletes a list of users by ID via the admin API.  Cascades to devices,
// shares, annotations etc. through FK ON DELETE CASCADE in the schema.
export async function cleanupUsers(admin: SupabaseClient, ids: string[]): Promise<void> {
  await Promise.all(ids.map(id => admin.auth.admin.deleteUser(id)))
}

// Polls the real DB until the given device owns at least `minShares` rows.
// Used by nightly auto-share specs in lieu of an in-memory mock.
export async function waitForRealShares(
  admin: SupabaseClient,
  ownerDeviceId: string,
  minShares = 1,
  timeoutMs = 30_000,
): Promise<void> {
  await expect.poll(async () => {
    const { data } = await admin.from('shares').select('id').eq('owner_id', ownerDeviceId)
    return data?.length ?? 0
  }, { timeout: timeoutMs }).toBeGreaterThanOrEqual(minShares)
}

// Waits until the family-hub is bootstrapped: polls the positive signal
// (deviceId + publicKey present in app state) instead of a localStorage key
// that the app never writes. Matches the approach used in family-mode-helpers.ts.
export async function waitForHubReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      try {
        const p = (window as unknown as { __rmState?: { get: () => Record<string, unknown> | null } }).__rmState?.get()
        const os = p?.onlineSharing as Record<string, unknown> | undefined
        return Boolean(os?.deviceId && os?.publicKey)
      } catch { return false }
    },
    undefined,
    { timeout: 45_000 },
  )
  await expect(
    page.getByRole('heading', { name: 'Online teilen', exact: true }),
  ).toBeVisible({ timeout: 10_000 })
}

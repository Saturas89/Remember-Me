// Bootstrap-Retry E2E tests against the production Supabase instance.
//
// Verifies the automatic exponential-backoff retry (3 s → 9 s → 27 s) and
// the manual "↺ Erneut versuchen" button introduced in #249.
//
// Failure injection via Playwright's page.route() – the browser sees a real
// HTTP 503 response from the Supabase GoTrue endpoint; no JS module is
// replaced or stubbed.
//
// Three scenarios:
//   stable-network  – no interception; hub connects cleanly
//   auto-retry      – first auth call returns 503; retry at 3 s succeeds
//   retry-button    – all auth calls return 503 until unrouted;
//                     error banner + button appear after 39 s;
//                     clicking the button reconnects the hub
//
// Cleanup: afterEach deletes created auth users; FK CASCADE removes devices,
// shares, and annotations.

import { test, expect } from '@playwright/test'
import {
  completeOnboarding,
  openFamilyHub,
  openFamilyTab,
  readDeviceIdentity,
} from '../helpers/family-mode-helpers'
import { cleanupUsers, spawnRealDevice, supabaseAdmin, waitForHubReady } from './helpers'

// Matches all Supabase GoTrue (auth) requests regardless of project domain.
const AUTH = '**/auth/v1/**'

// Navigate to hub WITHOUT waiting for bootstrap to succeed.
// Used when we want to observe the failure / retry state.
async function enterHubView(page: import('@playwright/test').Page): Promise<void> {
  await openFamilyTab(page)
  // Klick auf Invite aktiviert Online-Sharing und startet Sandra-Flow.
  await page.getByRole('button', { name: /Jemanden einladen/ }).click()
  // Zurück zu /friends – da sharing jetzt enabled, leitet es zum Hub weiter.
  await page.goto('/friends')
  // Hub heading appears as soon as the component mounts – independent of whether
  // bootstrapSession() has succeeded or failed.
  await expect(
    page.getByRole('heading', { name: 'Familienmodus', exact: true }),
  ).toBeVisible({ timeout: 20_000 })
}

test.describe('Bootstrap retry – Real-DB', () => {
  const createdUsers: string[] = []
  const admin = supabaseAdmin()

  test.afterEach(async () => {
    await cleanupUsers(admin, createdUsers.splice(0))
  })

  // ── 1. Stable network ──────────────────────────────────────────────────────

  test('stable-network: hub connects without error banner', async ({ browser }) => {
    test.setTimeout(60_000)

    const { page } = await spawnRealDevice(browser)
    await completeOnboarding(page, 'Stable')
    await openFamilyHub(page)

    const identity = await readDeviceIdentity(page)
    createdUsers.push(identity.deviceId)

    await expect(page.locator('.friends-hint--warn')).not.toBeVisible()
    await expect(page.getByRole('button', { name: /Erneut versuchen/ })).not.toBeVisible()
  })

  // ── 2. Auto-retry ──────────────────────────────────────────────────────────

  test('auto-retry: first auth call returns 503 – retry at 3 s recovers hub silently', async ({ browser }) => {
    test.setTimeout(30_000)

    const { page } = await spawnRealDevice(browser)
    await completeOnboarding(page, 'AutoRetry')

    // Fail the very first GoTrue call; let all subsequent ones through.
    let authCalls = 0
    await page.route(AUTH, async route => {
      authCalls++
      if (authCalls === 1) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'temporarily_unavailable' }),
        })
      } else {
        await route.continue()
      }
    })

    // openFamilyHub waits up to 45 s for hub ready.
    // The 1st attempt fails (503), retry fires at 3 s and succeeds → resolves in ~3 s.
    await openFamilyHub(page)

    const identity = await readDeviceIdentity(page)
    createdUsers.push(identity.deviceId)

    await expect(page.locator('.friends-hint--warn')).not.toBeVisible()
    await expect(page.getByRole('button', { name: /Erneut versuchen/ })).not.toBeVisible()
    // Confirms at least one retry happened (authCalls ≥ 2: 1 failed + 1 successful)
    expect(authCalls).toBeGreaterThanOrEqual(2)
  })

  // ── 3. Retry button ────────────────────────────────────────────────────────

  test('retry-button: error banner + button appear after all retries exhausted; click restores hub', async ({ browser }) => {
    // 3 s + 9 s + 27 s retry delays = 39 s minimum
    test.setTimeout(90_000)

    const { page } = await spawnRealDevice(browser)
    await completeOnboarding(page, 'RetryBtn')

    // Block ALL auth calls indefinitely – every bootstrapSession attempt gets 503.
    await page.route(AUTH, route =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'temporarily_unavailable' }),
      }),
    )

    // Navigate to hub without waiting for bootstrap (which will keep failing).
    await enterHubView(page)

    // After 3 + 9 + 27 s all four attempts are exhausted → error banner.
    await expect(page.locator('.friends-hint--warn')).toBeVisible({ timeout: 45_000 })
    const retryBtn = page.getByRole('button', { name: /Erneut versuchen/ })
    await expect(retryBtn).toBeVisible()

    // Unblock the auth endpoint so the next bootstrap cycle can succeed.
    await page.unroute(AUTH)
    await retryBtn.click()

    // Hub reconnects via the new bootstrap cycle.
    await waitForHubReady(page)
    const identity = await readDeviceIdentity(page)
    createdUsers.push(identity.deviceId)

    await expect(page.locator('.friends-hint--warn')).not.toBeVisible()
    await expect(retryBtn).not.toBeVisible()
  })
})

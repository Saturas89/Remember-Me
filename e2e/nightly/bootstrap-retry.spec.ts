// Bootstrap-Retry E2E tests against the production Supabase instance.
//
// Verifies the automatic exponential-backoff retry (3 s → 9 s → 27 s) and
// the manual "↺ Erneut versuchen" button introduced in #249.
//
// No mocks, no fakes. Network failures are triggered via Playwright's
// BrowserContext.setOffline(), which cuts OS-level TCP/UDP for the context –
// the application sees a genuine `net::ERR_INTERNET_DISCONNECTED` error, not
// an intercepted response.
//
// Three scenarios:
//   stable-network   – hub connects cleanly; no error banner ever appears
//   auto-retry       – brief offline window (< 3 s); 1st retry fires and recovers
//   retry-button     – offline > 39 s; all retries exhaust; error banner +
//                      retry button appear; click button → hub reconnects
//
// Cleanup: afterEach deletes created auth users; FK ON DELETE CASCADE removes
// devices, shares, annotations.

import { test, expect } from '@playwright/test'
import {
  completeOnboarding,
  openFamilyHub,
  readDeviceIdentity,
} from '../helpers/family-mode-helpers'
import { cleanupUsers, spawnRealDevice, supabaseAdmin, waitForHubReady } from './helpers'

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

  test('auto-retry: hub recovers after brief offline period (< first retry delay)', async ({ browser }) => {
    test.setTimeout(60_000)

    const { ctx, page } = await spawnRealDevice(browser)

    // Boot online, activate sharing, collect deviceId
    await completeOnboarding(page, 'AutoRetry')
    await openFamilyHub(page)
    const identity = await readDeviceIdentity(page)
    createdUsers.push(identity.deviceId)

    // Leave hub, cut network, re-enter
    await page.getByRole('button', { name: 'Zurück', exact: true }).click()
    await expect(page.getByTestId('open-online-sharing')).toBeVisible({ timeout: 5_000 })
    await ctx.setOffline(true)
    await page.getByTestId('open-online-sharing').click()

    // Hub heading appears immediately (component mounts), bootstrap fails silently
    await expect(page.getByRole('heading', { name: 'Online teilen', exact: true })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Verbinde mit Server', { exact: false })).toBeVisible({ timeout: 5_000 })

    // Restore within the first 3 s retry window → next attempt succeeds
    await page.waitForTimeout(500)
    await ctx.setOffline(false)

    await waitForHubReady(page)
    await expect(page.locator('.friends-hint--warn')).not.toBeVisible()
  })

  // ── 3. Retry button ────────────────────────────────────────────────────────

  test('retry-button: error banner + button appear after all retries exhausted; click restores hub', async ({ browser }) => {
    // 3 s + 9 s + 27 s delays = 39 s minimum, plus app overhead
    test.setTimeout(90_000)

    const { ctx, page } = await spawnRealDevice(browser)

    // Boot online, activate sharing
    await completeOnboarding(page, 'RetryBtn')
    await openFamilyHub(page)
    const identity = await readDeviceIdentity(page)
    createdUsers.push(identity.deviceId)

    // Leave hub, go offline, re-enter
    await page.getByRole('button', { name: 'Zurück', exact: true }).click()
    await expect(page.getByTestId('open-online-sharing')).toBeVisible({ timeout: 5_000 })
    await ctx.setOffline(true)
    await page.getByTestId('open-online-sharing').click()

    await expect(page.getByRole('heading', { name: 'Online teilen', exact: true })).toBeVisible({ timeout: 15_000 })

    // Wait for all automatic retries to exhaust (> 39 s)
    await expect(page.locator('.friends-hint--warn')).toBeVisible({ timeout: 45_000 })
    const retryBtn = page.getByRole('button', { name: /Erneut versuchen/ })
    await expect(retryBtn).toBeVisible()

    // Restore network and trigger manual retry
    await ctx.setOffline(false)
    await retryBtn.click()

    // Hub should reconnect after the next bootstrap cycle
    await waitForHubReady(page)
    await expect(page.locator('.friends-hint--warn')).not.toBeVisible()
    await expect(retryBtn).not.toBeVisible()
  })
})

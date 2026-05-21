// Production smoke tests – run against https://storyhold.app.
//
// Verifies:
//   • App loads without server errors across all six browser/device profiles
//   • HTTPS termination and CDN delivery work (URL starts with https://)
//   • traffic_type=e2e is correctly injected via storageState
//   • Debug route is accessible and reflects the e2e traffic type
//   • No critical JavaScript errors on initial load
//
// No authentication required. These tests are intentionally fast and only
// cover the golden-path entry point so they run in ≤ 60 s per browser.

import { test, expect } from './helpers'

test.describe('Production smoke', () => {

  test('app loads without 5xx errors', async ({ page, networkFailures }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle', { timeout: 30_000 })

    const serverErrors = networkFailures.filter(f => f.status >= 500)
    expect(serverErrors, `5xx errors on load: ${JSON.stringify(serverErrors)}`).toHaveLength(0)
  })

  test('app shell renders visible UI', async ({ page }) => {
    await page.goto('/')
    // Something interactive must appear within 15 s
    await expect(page.locator('button').first()).toBeVisible({ timeout: 15_000 })
  })

  test('HTTPS enforced – page URL starts with https', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    expect(page.url()).toMatch(/^https:\/\/(www\.)?storyhold\.app/)
  })

  test('debug route shows e2e traffic type', async ({ page }) => {
    await page.goto('/debug')
    // DebugPostHogView renders the current traffic_type inside a .friends-tag badge
    const badge = page.locator('.friends-tag').filter({ hasText: 'e2e' })
    await expect(badge).toBeVisible({ timeout: 15_000 })
  })

  test('no critical JS errors on initial load', async ({ page, consoleErrors }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle', { timeout: 30_000 })

    // Filter known-harmless third-party noise (case-insensitive)
    const critical = consoleErrors.filter(e => {
      const t = e.text.toLowerCase()
      return (
        !t.includes('favicon') &&
        !t.includes('analytics') &&
        !t.includes('posthog') &&
        !t.includes('speedinsights') &&
        !t.includes('speed insights') &&
        !t.includes('vercel')
      )
    })
    expect(critical, `Console errors: ${JSON.stringify(critical)}`).toHaveLength(0)
  })

})

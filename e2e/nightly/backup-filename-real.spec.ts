// Nightly real test: backup export ZIP uses Storyhold branding in the filename.
//
// Runs against https://www.storyhold.app (no mocks, no local server).
// The ArchiveExportCard builds a real ZIP in-browser and triggers a download.
// We capture the filename via page.waitForEvent('download') and assert it
// contains "storyhold" rather than the legacy "remember-me" prefix.
//
// Config: playwright.production-nightly.config.ts
// Covers: GitHub Issue #269

import { test, expect } from '@playwright/test'
import { completeOnboarding } from '../helpers/family-mode-helpers'
import { spawnRealDevice } from './helpers'

test.describe('Real: Backup-Dateiname verwendet Storyhold-Branding', () => {
  test('ZIP-Download enthält "storyhold", nicht "remember-me"', async ({ browser }) => {
    test.setTimeout(60_000)

    const { ctx, page } = await spawnRealDevice(browser)

    try {
      await completeOnboarding(page, 'Archiv-Test')

      // Open profile tab
      const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
      await nav.getByRole('button', { name: 'Profil', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Fortschritt' })).toBeVisible()

      // Trigger archive creation
      await page.getByRole('button', { name: /Jetzt sichern/ }).click()

      // Wait for the ZIP to finish building (ready phase shows a ✓ icon)
      await expect(page.locator('.arc-done-icon')).toBeVisible({ timeout: 30_000 })

      // Capture the browser download and verify the filename
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: /Auf Gerät sichern/ }).click(),
      ])

      const filename = download.suggestedFilename()
      expect(filename, `legacy prefix still present: ${filename}`).not.toMatch(/remember[\-_]?me/i)
      expect(filename, `expected "storyhold" in: ${filename}`).toContain('storyhold')
      expect(filename).toMatch(/\.zip$/)
    } finally {
      await ctx.close()
    }
  })
})

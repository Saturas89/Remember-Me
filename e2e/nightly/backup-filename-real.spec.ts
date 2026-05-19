// Nightly real tests: Storyhold-Branding im Backup-Export und Restore.
//
// Alle Tests laufen gegen https://www.storyhold.app – kein Mock, kein lokaler Server.
//
// Abgedeckte Fälle:
//   1. ZIP-Download: Dateiname enthält "storyhold", kein "remember-me"
//   2. Restore: JSON mit legacy-Typ "remember-me-backup" wird abgelehnt
//   3. Restore: Syntaktisch ungültiges JSON wird abgelehnt
//   4. Restore: Korrupte ZIP-Datei wird abgelehnt
//
// Config: playwright.production-nightly.config.ts
// Covers: GitHub Issue #269

import { test, expect, type Page } from '@playwright/test'
import { completeOnboarding } from '../helpers/family-mode-helpers'
import { spawnRealDevice } from './helpers'

async function goToProfile(page: Page) {
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  await nav.getByRole('button', { name: 'Profil', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Fortschritt' })).toBeVisible()
}

// Uploads a file directly into the hidden file input and accepts the confirm dialog.
async function uploadBackupFile(
  page: Page,
  file: { name: string; mimeType: string; buffer: Buffer },
) {
  page.once('dialog', dialog => dialog.accept())
  await page.locator('input[type="file"][accept*=".zip"]').setInputFiles(file)
}

// ── Suite 1: Export-Dateiname ────────────────────────────────────────────────

test.describe('Real: ZIP-Export – Dateiname verwendet Storyhold-Branding', () => {
  test('ZIP-Download enthält "storyhold", nicht "remember-me"', async ({ browser }) => {
    test.setTimeout(60_000)

    const { ctx, page } = await spawnRealDevice(browser)
    try {
      await completeOnboarding(page, 'Archiv-Test')
      await goToProfile(page)

      await page.getByRole('button', { name: /Jetzt sichern/ }).click()
      await expect(page.locator('.arc-done-icon')).toBeVisible({ timeout: 30_000 })

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

// ── Suite 2: Restore-Fehlerfälle ─────────────────────────────────────────────

test.describe('Real: Restore – Fehlerfälle', () => {
  test('JSON mit legacy-Typ "remember-me-backup" wird abgelehnt', async ({ browser }) => {
    test.setTimeout(30_000)

    const { ctx, page } = await spawnRealDevice(browser)
    try {
      await completeOnboarding(page, 'Restore-Test')
      await goToProfile(page)

      const legacyJson = JSON.stringify({
        $type: 'remember-me-backup',
        version: 2,
        exportedAt: new Date().toISOString(),
        state: { profile: null, answers: {}, friends: [] },
      })
      await uploadBackupFile(page, {
        name: 'old-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(legacyJson),
      })

      const msg = page.locator('.import-msg--error')
      await expect(msg).toBeVisible({ timeout: 10_000 })
      // Error text mentions Storyhold so users know where the file should come from
      await expect(msg).toContainText('Storyhold')
    } finally {
      await ctx.close()
    }
  })

  test('Syntaktisch ungültiges JSON wird abgelehnt', async ({ browser }) => {
    test.setTimeout(30_000)

    const { ctx, page } = await spawnRealDevice(browser)
    try {
      await completeOnboarding(page, 'Restore-Test')
      await goToProfile(page)

      await uploadBackupFile(page, {
        name: 'broken.json',
        mimeType: 'application/json',
        buffer: Buffer.from('{ this is ][[ not json at all ###'),
      })

      const msg = page.locator('.import-msg--error')
      await expect(msg).toBeVisible({ timeout: 10_000 })
      await expect(msg).toContainText('gelesen werden')
    } finally {
      await ctx.close()
    }
  })

  test('Korrupte ZIP-Datei wird abgelehnt', async ({ browser }) => {
    test.setTimeout(30_000)

    const { ctx, page } = await spawnRealDevice(browser)
    try {
      await completeOnboarding(page, 'Restore-Test')
      await goToProfile(page)

      // Valid PK signature prefix but truncated/garbage body – JSZip will reject it.
      await uploadBackupFile(page, {
        name: 'not-a-real-archive.zip',
        mimeType: 'application/zip',
        buffer: Buffer.from('PK\x03\x04 this is not a valid zip body'),
      })

      const msg = page.locator('.import-msg--error')
      await expect(msg).toBeVisible({ timeout: 10_000 })
      await expect(msg).toContainText('gelesen werden')
    } finally {
      await ctx.close()
    }
  })
})

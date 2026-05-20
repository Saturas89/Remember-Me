// Nightly real tests: Android share-button and file-picker behaviour.
//
// Covers:
//   Issue #268 – Share action does not open system share menu on Android.
//   Issue #266 – Backup import cannot access Downloads folder on Android.
//
// All tests run against https://www.storyhold.app (no local server, no mock).
// Mobile-specific tests are guarded with test.skip(!isMobile).
//
// Config: playwright.production-nightly.config.ts

import { test, expect, type Page } from '@playwright/test'
import { completeOnboarding } from '../helpers/family-mode-helpers'
import { spawnRealDevice } from './helpers'

async function goToProfile(page: Page) {
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  await nav.getByRole('button', { name: 'Profil', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Fortschritt' })).toBeVisible()
}

async function buildArchive(page: Page) {
  await page.getByRole('button', { name: /Jetzt sichern/ }).click()
  await expect(page.locator('.arc-done-icon')).toBeVisible({ timeout: 45_000 })
}

// ── #268: Share-Button ─────────────────────────────────────────────────────

test.describe('Real: Share-Action (Issue #268)', () => {
  test('share-Button ist nach Archiv-Erstellung auf mobilem Viewport sichtbar', async ({
    browser,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Share-Button-Sichtbarkeit nur auf mobilen Viewports relevant')
    test.setTimeout(60_000)

    const { ctx, page } = await spawnRealDevice(browser)
    try {
      await completeOnboarding(page, 'Share-Test')
      await goToProfile(page)
      await buildArchive(page)

      const shareBtn = page.getByRole('button', { name: /Teilen/ })
      await expect(shareBtn).toBeVisible({ timeout: 5_000 })
    } finally {
      await ctx.close()
    }
  })

  test('share-Button öffnet navigator.share (mock-Verifikation, mobil)', async ({
    browser,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Web Share API nur auf mobilen Viewports testbar')
    test.setTimeout(60_000)

    const { ctx, page } = await spawnRealDevice(browser)
    try {
      await completeOnboarding(page, 'Share-Mock-Test')
      await goToProfile(page)
      await buildArchive(page)

      // Inject share mock after archive is ready (zipBlob exists in component state).
      await page.evaluate(() => {
        ;(window as unknown as Record<string, unknown>).__shareCalls = []
        const nav = navigator as Navigator & {
          canShare?: (d: unknown) => boolean
          share?: (d: unknown) => Promise<void>
        }
        nav.canShare = () => true
        nav.share   = async (data: unknown) => {
          ;(window as unknown as { __shareCalls: unknown[] }).__shareCalls.push(data)
        }
      })

      await page.getByRole('button', { name: /Teilen/ }).click()
      // Give the async handler time to resolve.
      await page.waitForFunction(
        () => ((window as unknown as { __shareCalls?: unknown[] }).__shareCalls?.length ?? 0) > 0,
        undefined,
        { timeout: 10_000 },
      )

      const calls = await page.evaluate(
        () => (window as unknown as { __shareCalls: unknown[] }).__shareCalls,
      )
      expect(calls.length).toBeGreaterThan(0)
      const firstCall = calls[0] as { title?: string; files?: unknown[] }
      expect(firstCall).toHaveProperty('title')
    } finally {
      await ctx.close()
    }
  })

  test('share-Fallback ohne canShare öffnet text-share (navigator.share ohne files)', async ({
    browser,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Fallback-Pfad nur auf mobilen Viewports relevant')
    test.setTimeout(60_000)

    const { ctx, page } = await spawnRealDevice(browser)
    try {
      await completeOnboarding(page, 'Share-Fallback-Test')
      await goToProfile(page)
      await buildArchive(page)

      // Simulate an Android browser where canShare({files}) returns false.
      await page.evaluate(() => {
        ;(window as unknown as Record<string, unknown>).__shareCalls = []
        const nav = navigator as Navigator & {
          canShare?: (d: unknown) => boolean
          share?: (d: unknown) => Promise<void>
        }
        nav.canShare = (data: unknown) => {
          // Reject file sharing, allow text/url sharing.
          const d = data as { files?: unknown[] }
          return !(d?.files)
        }
        nav.share = async (data: unknown) => {
          ;(window as unknown as { __shareCalls: unknown[] }).__shareCalls.push(data)
        }
      })

      await page.getByRole('button', { name: /Teilen/ }).click()
      await page.waitForFunction(
        () => ((window as unknown as { __shareCalls?: unknown[] }).__shareCalls?.length ?? 0) > 0,
        undefined,
        { timeout: 10_000 },
      )

      const calls = await page.evaluate(
        () => (window as unknown as { __shareCalls: unknown[] }).__shareCalls,
      )
      const fallback = calls[0] as { url?: string; files?: unknown[] }
      // Fallback share must NOT contain files (file sharing was unavailable).
      expect(fallback).not.toHaveProperty('files')
      // But it should include a url so the native sheet has something to share.
      expect(fallback).toHaveProperty('url')
    } finally {
      await ctx.close()
    }
  })
})

// ── #266: File-Picker / Import ─────────────────────────────────────────────

test.describe('Real: Backup-Import file-picker (Issue #266)', () => {
  test('file-input accept-Attribut enthält nur Extensions (kein MIME-Type-Lock)', async ({
    browser,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Android SAF-Kompatibilitätsprüfung nur auf mobilen Viewports relevant')
    test.setTimeout(30_000)

    const { ctx, page } = await spawnRealDevice(browser)
    try {
      await completeOnboarding(page, 'FilePicker-Test')
      await goToProfile(page)

      const accept = await page
        .locator('input[type="file"][accept*=".zip"]')
        .getAttribute('accept')

      expect(accept, 'accept-Attribut fehlt').not.toBeNull()
      expect(accept).toContain('.zip')
      expect(accept).toContain('.json')
      // Must NOT contain MIME-type-only restrictions that block Android SAF Downloads.
      expect(accept, 'Kein reiner MIME-Type-Lock erlaubt').not.toBe('application/zip,application/json')
    } finally {
      await ctx.close()
    }
  })

  test('Backup-Import verarbeitet JSON-Datei aus beliebigem Pfad', async ({ browser }) => {
    test.setTimeout(30_000)

    const { ctx, page } = await spawnRealDevice(browser)
    try {
      await completeOnboarding(page, 'Import-Pfad-Test')
      await goToProfile(page)

      const validJson = JSON.stringify({
        $type:      'storyhold-backup',
        version:    2,
        exportedAt: new Date().toISOString(),
        state: {
          profile:         { name: 'Import-Test', createdAt: new Date().toISOString() },
          answers:         {},
          friends:         [],
          friendAnswers:   [],
          customQuestions: [],
          appMode:         'full',
        },
      })

      // Simulate selecting the file from an arbitrary path (e.g. Downloads/backup.json).
      // Playwright's setInputFiles bypasses the native picker entirely – this confirms
      // the import pipeline works once a file is selected, regardless of picker source.
      page.once('dialog', dialog => dialog.accept())
      await page
        .locator('input[type="file"][accept*=".zip"]')
        .setInputFiles({
          name:     'Downloads/storyhold-backup.json',
          mimeType: 'application/json',
          buffer:   Buffer.from(validJson),
        })

      const successMsg = page.locator('.import-msg--success')
      await expect(successMsg).toBeVisible({ timeout: 15_000 })
    } finally {
      await ctx.close()
    }
  })
})

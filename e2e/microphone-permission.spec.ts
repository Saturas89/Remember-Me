// E2E tests for the microphone permission-denied error messages in AudioRecorder.
//
// Strategy: patch navigator.mediaDevices.getUserMedia directly on the existing
// MediaDevices instance. This avoids browser-specific quirks around
// Object.defineProperty on navigator (Chrome caches an own property that
// shadows prototype overrides) and on Navigator.prototype (Firefox/WebKit make
// it non-configurable). Mutating the method on the already-resolved instance
// works in all engines. The user-agent string is overridden per test to trigger
// the platform-specific message branch (iOS / Android / Desktop).

import { test, expect, type BrowserContext } from '@playwright/test'

// ── Shared setup ──────────────────────────────────────────────────────────

/** Seeds the localStorage so onboarding is skipped and the app boots to the
 *  home screen with a completed profile. */
async function bootstrapApp(ctx: BrowserContext) {
  await ctx.addInitScript(() => {
    localStorage.setItem('rm-install-dismissed', '1')
    // Force German so tests see German UI regardless of CI-runner locale.
    // browser.newContext() does not inherit the global locale: 'de-DE' setting.
    localStorage.setItem('rm-lang', 'de')
    if (!localStorage.getItem('remember-me-state')) {
      localStorage.setItem('remember-me-state', JSON.stringify({
        profile: { name: 'Tina' },
        answers: {},
        friends: [],
        friendAnswers: [],
        customQuestions: [],
        appMode: 'full',
      }))
    }
  })
}

/** Patches getUserMedia to always throw NotAllowedError so the recorder
 *  error path is taken without relying on real OS permissions.
 *  Mutates the method on the existing MediaDevices instance — works in all
 *  browsers without fighting property descriptor configurability. */
async function denyMicrophone(ctx: BrowserContext) {
  await ctx.addInitScript(() => {
    if (navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException('Permission denied', 'NotAllowedError')
      }
    }
  })
}

/** Navigates to the first question in "Kindheit & Jugend" and clicks the
 *  record button, triggering the getUserMedia call. */
async function triggerRecording(page: import('@playwright/test').Page) {
  await page.goto('/')
  await expect(page.locator('.home-greeting')).toBeVisible()
  await page.getByRole('heading', { name: 'Kindheit & Jugend' }).click()
  await expect(page.locator('textarea.input-textarea').first()).toBeVisible()

  // The audio toolbar button triggers getUserMedia directly on click.
  // aria-label = m.audioStartAria = 'Sprachaufnahme starten'
  const recordBtn = page.getByRole('button', { name: /Sprachaufnahme starten|starten/i })
  await expect(recordBtn).toBeVisible()
  await recordBtn.click()
}

// ── Tests ─────────────────────────────────────────────────────────────────

test.describe('Mikrofon-Permission – plattformspezifische Fehlermeldungen', () => {

  test('Desktop: zeigt allgemeinen Hinweis auf Adressleisten-Schloss', async ({ browser }) => {
    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    })
    await bootstrapApp(ctx)
    await denyMicrophone(ctx)
    const page = await ctx.newPage()

    await triggerRecording(page)

    await expect(page.locator('.audio-rec-error')).toBeVisible({ timeout: 5_000 })
    const text = await page.locator('.audio-rec-error').textContent()
    expect(text).toContain('Schloss-Symbol')
    expect(text).not.toContain('Safari')
    expect(text).not.toContain('Android')

    await ctx.close()
  })

  test('iOS Safari: zeigt Einstellungen → Safari → Mikrofon-Pfad', async ({ browser }) => {
    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    })
    await bootstrapApp(ctx)
    await denyMicrophone(ctx)
    const page = await ctx.newPage()

    await triggerRecording(page)

    await expect(page.locator('.audio-rec-error')).toBeVisible({ timeout: 5_000 })
    const text = await page.locator('.audio-rec-error').textContent()
    expect(text).toContain('Safari')
    expect(text).toContain('Einstellungen')
    expect(text).not.toContain('Android')

    await ctx.close()
  })

  test('Android Chrome: zeigt Schloss-Symbol → Berechtigungen-Pfad', async ({ browser }) => {
    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    })
    await bootstrapApp(ctx)
    await denyMicrophone(ctx)
    const page = await ctx.newPage()

    await triggerRecording(page)

    await expect(page.locator('.audio-rec-error')).toBeVisible({ timeout: 5_000 })
    const text = await page.locator('.audio-rec-error').textContent()
    expect(text).toContain('Android')
    expect(text).not.toContain('Einstellungen')
    expect(text).not.toContain('Safari')

    await ctx.close()
  })

  // ── Negativ: Bei erlaubtem Mikrofon kein Fehler ────────────────────────

  test('kein Fehler sichtbar wenn Mikrofon erlaubt ist', async ({ browser }) => {
    const ctx = await browser.newContext()
    await bootstrapApp(ctx)

    // Stub getUserMedia to succeed with a real audio stream so the recorder
    // transitions to the recording state without actual microphone hardware.
    await ctx.addInitScript(() => {
      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = async () => {
          const audioCtx = new AudioContext()
          const dest = audioCtx.createMediaStreamDestination()
          return dest.stream
        }
      }
    })

    const page = await ctx.newPage()
    await triggerRecording(page)

    // No error element should appear — recording state starts
    await expect(page.locator('.audio-rec-error')).not.toBeVisible()
    await expect(page.locator('.media-toolbar__btn--recording')).toBeVisible({ timeout: 5_000 })

    await ctx.close()
  })
})

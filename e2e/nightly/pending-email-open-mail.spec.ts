// E2E tests for the "Open mail app" button on the pending-email-confirmation
// screen of the Storyhold Server sync setup wizard.
//
// Strategy: intercept the /auth/v1/signup POST and return session:null so the
// app enters the pending-email-confirmation step without creating a real
// Supabase user (no cleanup needed). window.open is replaced with a spy before
// each click so we can assert the exact URL without a real browser navigation.
//
// Positive cases: known providers show the button and open the correct webmail.
// Negative cases: unknown / custom domains must NOT show the button at all.

import { test, expect, type Page } from '@playwright/test'
import { spawnRealDevice } from './helpers'
import { completeOnboarding } from '../helpers/family-mode-helpers'

const FAKE_USER_ID = '00000000-dead-4000-8000-00open0mail00'

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Intercepts /auth/v1/signup and returns a "pending email confirmation"
 * response (session: null, email_confirmed_at: null). No real Supabase user
 * is created – the route is fulfilled entirely from the interceptor.
 */
async function interceptSignupAsUnconfirmed(page: Page, email: string): Promise<void> {
  await page.route('**/auth/v1/signup', async (route) => {
    const now = new Date().toISOString()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: FAKE_USER_ID,
          aud: 'authenticated',
          role: 'authenticated',
          email,
          email_confirmed_at: null,
          app_metadata: { provider: 'email' },
          user_metadata: {},
          identities: [],
          created_at: now,
          updated_at: now,
        },
        session: null,
      }),
    })
  })
}

/**
 * Walks the wizard to the signup form, fills in the email + password and
 * submits. Call interceptSignupAsUnconfirmed() first so the app lands on the
 * pending-email-confirmation step.
 */
async function submitSignupForm(page: Page, email: string): Promise<void> {
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  await nav.getByRole('button', { name: 'Sync', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Privater Sync' })).toBeVisible()
  await page.getByRole('button', { name: 'Einrichten' }).click()

  await expect(page.getByRole('heading', { name: /Wo sollen deine Daten/ })).toBeVisible()
  await page.getByRole('button', { name: /Storyhold Server/ }).click()
  await page.getByRole('button', { name: 'Weiter' }).click()

  await expect(page.getByRole('heading', { name: /Hast du schon ein Konto/ })).toBeVisible()
  await page.getByRole('button', { name: /Nein, neues Konto erstellen/ }).click()

  await expect(page.getByRole('heading', { name: 'Konto erstellen', exact: true })).toBeVisible()
  await page.getByLabel('E-Mail').fill(email)
  await page.getByLabel('Passwort').fill('Test-Passw0rd!')
  await page.getByRole('button', { name: 'Konto erstellen', exact: true }).click()
}

/** Installs a window.open spy and returns a function that reads the last captured URL. */
async function installWindowOpenSpy(page: Page): Promise<() => Promise<string | null>> {
  await page.evaluate(() => {
    (window as unknown as { __openMailSpy: string | null }).__openMailSpy = null
    window.open = (url?: string | URL) => {
      (window as unknown as { __openMailSpy: string | null }).__openMailSpy =
        typeof url === 'string' ? url : url?.toString() ?? null
      return null
    }
  })
  return () =>
    page.evaluate(
      () => (window as unknown as { __openMailSpy: string | null }).__openMailSpy,
    )
}

// ── Positive cases ─────────────────────────────────────────────────────────

test.describe('Open-Mail-Button – bekannte Anbieter öffnen Webmail-Posteingang', () => {
  const cases: Array<{ domain: string; expectedUrl: string }> = [
    { domain: 'gmail.com',      expectedUrl: 'https://mail.google.com' },
    { domain: 'gmx.de',         expectedUrl: 'https://www.gmx.de' },
    { domain: 'web.de',         expectedUrl: 'https://web.de/email' },
    { domain: 'outlook.com',    expectedUrl: 'https://outlook.live.com/mail/0/inbox' },
    { domain: 'proton.me',      expectedUrl: 'https://mail.proton.me' },
    { domain: 'icloud.com',     expectedUrl: 'https://www.icloud.com/mail' },
    { domain: 't-online.de',    expectedUrl: 'https://webmail.t-online.de' },
  ]

  for (const { domain, expectedUrl } of cases) {
    test(`${domain} → Button sichtbar und öffnet ${expectedUrl}`, async ({ browser }) => {
      test.setTimeout(60_000)
      const { ctx, page } = await spawnRealDevice(browser)

      await completeOnboarding(page, 'Lena')
      const email = `e2e-openmail-${Date.now()}@${domain}`

      await interceptSignupAsUnconfirmed(page, email)
      await submitSignupForm(page, email)

      // Pending-email step must be visible
      await expect(
        page.getByRole('heading', { name: /Bestätige deine E-Mail|Confirm your email/i }),
      ).toBeVisible({ timeout: 15_000 })

      // Button must be shown for known domain
      const btn = page.getByTestId('pending-email-open-mail')
      await expect(btn).toBeVisible()

      // Spy on window.open, click button, verify URL
      const readSpy = await installWindowOpenSpy(page)
      await btn.click()
      const openedUrl = await readSpy()
      expect(openedUrl).toBe(expectedUrl)

      await ctx.close()
    })
  }
})

// ── Negative cases ─────────────────────────────────────────────────────────

test.describe('Open-Mail-Button – unbekannte Domains zeigen Button nicht', () => {
  const unknownDomains = [
    'test.de',             // exact email from user bug report
    'example.invalid',     // domain used in other E2E tests
    'company-internal.de', // custom corporate domain
    'mymailserver.org',    // generic unknown provider
  ]

  for (const domain of unknownDomains) {
    test(`${domain} → kein Open-Mail-Button`, async ({ browser }) => {
      test.setTimeout(60_000)
      const { ctx, page } = await spawnRealDevice(browser)

      await completeOnboarding(page, 'Emma')
      const email = `e2e-openmail-neg-${Date.now()}@${domain}`

      await interceptSignupAsUnconfirmed(page, email)
      await submitSignupForm(page, email)

      await expect(
        page.getByRole('heading', { name: /Bestätige deine E-Mail|Confirm your email/i }),
      ).toBeVisible({ timeout: 15_000 })

      // Button must NOT be rendered for unknown domain
      await expect(page.getByTestId('pending-email-open-mail')).not.toBeVisible()

      // Resend-button must still be present (not broken by the missing open-mail button)
      await expect(
        page.getByRole('button', { name: /Bestätigungs-Mail erneut senden|Resend confirmation email/i }),
      ).toBeVisible()

      await ctx.close()
    })
  }
})

// ── Resend-Button unabhängig von Domain ───────────────────────────────────

test('Resend-Button ist für alle Domains vorhanden und löst Request aus', async ({ browser }) => {
  test.setTimeout(60_000)
  const { ctx, page } = await spawnRealDevice(browser)

  await completeOnboarding(page, 'Mia')
  const email = `e2e-resend-${Date.now()}@gmail.com`

  await interceptSignupAsUnconfirmed(page, email)

  // Intercept the resend call (OTP resend) and capture that it fires.
  // A small artificial delay is required: without it the route resolves
  // synchronously before React can commit the setResending(true) render,
  // causing React to batch setResending(true) + setResending(false) into a
  // single no-op and the button never appears disabled.
  let resendCalled = false
  await page.route('**/auth/v1/otp', async (route) => {
    resendCalled = true
    await new Promise(resolve => setTimeout(resolve, 300))
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })

  await submitSignupForm(page, email)
  await expect(
    page.getByRole('heading', { name: /Bestätige deine E-Mail|Confirm your email/i }),
  ).toBeVisible({ timeout: 15_000 })

  const resendBtn = page.getByRole('button', {
    name: /Bestätigungs-Mail erneut senden|Resend confirmation email/i,
  })
  await expect(resendBtn).toBeVisible()
  await resendBtn.click()

  // Button must enter loading state (disabled while the request is in flight).
  await expect(resendBtn).toBeDisabled({ timeout: 3_000 })

  // Wait for the request to complete
  await expect.poll(() => resendCalled, { timeout: 10_000 }).toBe(true)

  await ctx.close()
})

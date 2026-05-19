// Shared helpers for private-sync E2E specs (chaos-real, gdrive-device-switch).
// Kept separate from private-sync-real.spec.ts to avoid coupling; that file
// carries its own inline copies of openSyncTab / readSyncUserId / runSetupWizard.

import { createClient } from '@supabase/supabase-js'
import { expect, type Page } from '@playwright/test'
import { supabaseAdmin } from './helpers'

export const TEST_PASSWORD = 'Supabase-E2E-2026!'
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || ''

export function testEmail(suffix: string): string {
  return `e2e-chaos-${suffix}-${Date.now()}@example.invalid`
}

export async function openSyncTab(page: Page): Promise<void> {
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  await nav.getByRole('button', { name: 'Sync', exact: true }).click()
}

export async function readSyncUserId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    try {
      const s = (window as unknown as {
        __rmState?: { get: () => Record<string, unknown> | null }
      }).__rmState?.get()
      return (s?.privateSync as { userId?: string } | undefined)?.userId ?? null
    } catch { return null }
  })
}

/** Walks the full Storyhold Server wizard and returns the recovery code.
 *  Pre-creates the user via admin API + intercepts the /signup POST with a
 *  synthetic session so the test never waits for a confirmation email. */
export async function runSetupWizard(
  page: Page,
  email: string,
  password = TEST_PASSWORD,
): Promise<string> {
  const adminClient = supabaseAdmin()
  const now = new Date().toISOString()

  const { data: preCreated, error: createError } = await adminClient.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (createError || !preCreated.user) throw new Error(`Pre-create failed: ${createError?.message}`)
  const preUserId = preCreated.user.id

  const nodeClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { data: preLogin, error: loginError } = await nodeClient.auth.signInWithPassword({ email, password })
  if (loginError || !preLogin.session) throw new Error(`Pre-login failed: ${loginError?.message}`)
  const { access_token, refresh_token } = preLogin.session

  await page.route('**/auth/v1/signup', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token,
        user: {
          id: preUserId, aud: 'authenticated', role: 'authenticated', email,
          email_confirmed_at: now,
          app_metadata: { provider: 'email', providers: ['email'] },
          user_metadata: {},
          identities: [{ id: preUserId, user_id: preUserId, identity_data: { email, sub: preUserId }, provider: 'email', last_sign_in_at: now, created_at: now, updated_at: now }],
          created_at: now, updated_at: now,
        },
      }),
    })
  })

  try {
    await openSyncTab(page)
    await expect(page.getByRole('heading', { name: 'Privater Sync' })).toBeVisible()
    await page.getByRole('button', { name: 'Einrichten' }).click()

    await expect(page.getByRole('heading', { name: /Wo sollen deine Daten/ })).toBeVisible()
    await page.getByRole('button', { name: /Storyhold Server/ }).click()
    await page.getByRole('button', { name: 'Weiter' }).click()

    await expect(page.getByRole('heading', { name: /Hast du schon ein Konto/ })).toBeVisible()
    await page.getByRole('button', { name: /Nein, neues Konto erstellen/ }).click()

    await expect(page.getByRole('heading', { name: 'Konto erstellen', exact: true })).toBeVisible()
    await page.getByLabel('E-Mail').fill(email)
    await page.getByLabel('Passwort').fill(password)
    await page.getByRole('button', { name: 'Konto erstellen', exact: true }).click()

    const recoveryHeading = page.getByRole('heading', { name: 'Dein Sicherheitsschlüssel' })
    const pendingHeading  = page.getByRole('heading', { name: 'Bestätige deine E-Mail' })
    await expect(recoveryHeading.or(pendingHeading)).toBeVisible({ timeout: 20_000 })

    if (await pendingHeading.isVisible()) {
      await page.evaluate(async (sess) => {
        type SyncClient = { auth: { setSession: (s: { access_token: string; refresh_token: string }) => Promise<unknown> } }
        const client = (window as unknown as { __rmSyncClient?: SyncClient }).__rmSyncClient
        if (!client) throw new Error('__rmSyncClient not on window')
        await client.auth.setSession({ access_token: sess.access_token, refresh_token: sess.refresh_token })
      }, { access_token, refresh_token })
      await expect(recoveryHeading).toBeVisible({ timeout: 20_000 })
    }
  } finally {
    await page.unroute('**/auth/v1/signup')
  }

  const code = page.locator('.private-sync-view__code')
  await expect(code).toBeVisible()
  const codeText = await code.textContent() ?? ''

  const continueBtn = page.getByRole('button', { name: 'Weiter' })
  await expect(continueBtn).toBeDisabled()
  await page.getByRole('checkbox').check()
  await expect(continueBtn).toBeEnabled()
  await continueBtn.click()

  await expect(page.getByRole('heading', { name: 'Privater Sync', exact: true })).toBeVisible({ timeout: 20_000 })
  return codeText
}

/** Navigates device 2 to the enter-code step after signing in with an existing account. */
export async function goToEnterCodeStep(page: Page, email: string, password = TEST_PASSWORD): Promise<void> {
  await openSyncTab(page)
  await page.getByRole('button', { name: 'Einrichten' }).click()
  await page.getByRole('button', { name: /Storyhold Server/ }).click()
  await page.getByRole('button', { name: 'Weiter' }).click()
  await page.getByRole('button', { name: /Ja, ich melde mich an/ }).click()
  await expect(page.getByRole('heading', { name: /Anmelden/, exact: false })).toBeVisible()
  await page.getByLabel('E-Mail').fill(email)
  await page.getByLabel('Passwort').fill(password)
  await page.getByRole('button', { name: /Anmelden/ }).click()
  await expect(page.getByRole('heading', { name: /Sicherheitsschlüssel eingeben/ })).toBeVisible({ timeout: 20_000 })
}

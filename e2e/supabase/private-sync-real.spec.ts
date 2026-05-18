// Private Sync E2E tests against the production Supabase instance.
//
// Tests the "Storyhold Server" (Supabase) sync provider end-to-end:
// the setup wizard creates a real auth.users row, sync operations write
// to the real private_sync_state table, and RLS policies are exercised.
//
// OneDrive and Google Drive providers are not covered here: they rely on
// OAuth2 authorization code flows against cloud services (Microsoft / Google)
// for which no local Docker-compatible alternative exists. Those providers
// are covered by mock-based tests in e2e/private-sync/ and by encryption
// unit tests in src/utils/oneDriveProvider.encryption.test.ts and
// src/utils/googleDriveProvider.encryption.test.ts.
//
// Cleanup: afterEach deletes created auth users; CASCADE removes private_sync_state rows.

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { cleanupUsers, spawnRealDevice, supabaseAdmin } from './helpers'
import {
  completeOnboarding,
} from '../helpers/family-mode-helpers'

const TEST_EMAIL_BASE   = 'e2e-sync-real'
const TEST_PASSWORD     = 'Supabase-E2E-2026!'
const SUPABASE_URL      = process.env.SUPABASE_URL      || 'http://127.0.0.1:54321'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || ''

// Generate a unique email per test run to avoid conflicts between retries.
function testEmail(suffix: string): string {
  return `${TEST_EMAIL_BASE}-${suffix}-${Date.now()}@example.invalid`
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function openSyncTab(page: import('@playwright/test').Page) {
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  await nav.getByRole('button', { name: 'Sync', exact: true }).click()
}

/** Walks the full Storyhold Server setup wizard and returns the recovery code. */
async function runSetupWizard(
  page: import('@playwright/test').Page,
  email: string,
  password = TEST_PASSWORD,
): Promise<string> {
  await openSyncTab(page)
  await expect(page.getByRole('heading', { name: 'Privater Sync' })).toBeVisible()
  await page.getByRole('button', { name: 'Einrichten' }).click()

  // Provider-Wahl
  await expect(page.getByRole('heading', { name: /Wo sollen deine Daten/ })).toBeVisible()
  await page.getByRole('button', { name: /Storyhold Server/ }).click()
  await page.getByRole('button', { name: 'Weiter' }).click()

  // Konto-Modus
  await expect(page.getByRole('heading', { name: /Hast du schon ein Konto/ })).toBeVisible()
  await page.getByRole('button', { name: /Nein, neues Konto erstellen/ }).click()

  // Registrierung
  await expect(page.getByRole('heading', { name: 'Konto erstellen', exact: true })).toBeVisible()
  await page.getByLabel('E-Mail').fill(email)
  await page.getByLabel('Passwort').fill(password)
  await page.getByRole('button', { name: 'Konto erstellen', exact: true }).click()

  // Production Supabase requires email confirmation. Detect which step appears
  // and, if the pending-email screen shows up, bypass it via the admin API.
  const recoveryHeading = page.getByRole('heading', { name: 'Dein Sicherheitsschlüssel' })
  const pendingHeading  = page.getByRole('heading', { name: 'Bestätige deine E-Mail' })

  const needsEmailConfirm = await Promise.race([
    recoveryHeading.waitFor({ state: 'visible', timeout: 20_000 }).then(() => false),
    pendingHeading.waitFor({ state: 'visible', timeout: 20_000 }).then(() => true),
  ])

  if (needsEmailConfirm) {
    // 1. Admin-confirm the email server-side.
    const adminClient = supabaseAdmin()
    const { data: { users } } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
    const user = users.find(u => u.email === email)
    if (!user) throw new Error(`User not found in auth.users for email ${email}`)
    await adminClient.auth.admin.updateUser(user.id, { email_confirm: true })

    // 2. Sign in from Node.js to obtain a real session.
    const nodeClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } })
    const { data: signInData, error: signInError } = await nodeClient.auth.signInWithPassword({ email, password })
    if (signInError || !signInData.session) throw new Error(`Node sign-in after confirm failed: ${signInError?.message}`)
    const session = signInData.session

    // 3. Inject the session into the browser context. The GoTrueClient for the
    //    sync supabase instance listens on BroadcastChannel('rm-sync-session')
    //    and fires onAuthStateChange(SIGNED_IN) when it receives the message,
    //    which advances the UI from pending-email to recovery-code.
    const expiresAt = Math.round(Date.now() / 1000) + (session.expires_in ?? 3600)
    await page.evaluate(
      ({ storageKey, sess, exp }) => {
        localStorage.setItem(storageKey, JSON.stringify({ currentSession: sess, expiresAt: exp }))
        new BroadcastChannel(storageKey).postMessage({ event: 'SIGNED_IN', session: sess })
      },
      { storageKey: 'rm-sync-session', sess: session, exp: expiresAt },
    )

    await expect(recoveryHeading).toBeVisible({ timeout: 20_000 })
  }

  const code = page.locator('.private-sync-view__code')
  await expect(code).toBeVisible()
  const codeText = await code.textContent() ?? ''

  const continueBtn = page.getByRole('button', { name: 'Weiter' })
  await expect(continueBtn).toBeDisabled()
  await page.getByRole('checkbox').check()
  await expect(continueBtn).toBeEnabled()
  await continueBtn.click()

  // Hub
  await expect(page.getByRole('heading', { name: 'Privater Sync', exact: true })).toBeVisible({ timeout: 20_000 })
  return codeText
}

/** Reads the privateSync.userId from app state (= auth.uid() after signup). */
async function readSyncUserId(page: import('@playwright/test').Page): Promise<string | null> {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem('remember-me-state')
      if (!raw) return null
      const s = JSON.parse(raw)
      return (s.privateSync as { userId?: string } | undefined)?.userId ?? null
    } catch { return null }
  })
}

// ── Test suite ─────────────────────────────────────────────────────────────

test.describe('Private Sync – Storyhold Server (Real-DB)', () => {
  const createdUsers: string[] = []
  const admin = supabaseAdmin()

  test.afterEach(async () => {
    await cleanupUsers(admin, createdUsers.splice(0))
  })

  // ── Setup-Wizard ──────────────────────────────────────────────────────────

  test('setup-wizard: vollständiger Durchlauf erstellt echten Auth-User', async ({ browser }) => {
    test.setTimeout(90_000)
    const { ctx, page } = await spawnRealDevice(browser)

    await completeOnboarding(page, 'Anna')
    const email = testEmail('setup')
    await runSetupWizard(page, email)

    // Verify via admin API: user exists in auth.users
    const userId = await readSyncUserId(page)
    expect(userId, 'App muss userId nach Setup speichern').toBeTruthy()
    createdUsers.push(userId!)

    const { data: users } = await admin.auth.admin.listUsers()
    const created = users.users.find(u => u.email === email)
    expect(created, 'auth.users muss den neuen User enthalten').toBeTruthy()
    expect(created!.id).toBe(userId)

    await ctx.close()
  })

  // ── Sync-Operation ────────────────────────────────────────────────────────

  test('sync-write: nach Sync liegt ein verschlüsselter Blob in private_sync_state', async ({
    browser,
  }) => {
    test.setTimeout(90_000)
    const { ctx, page } = await spawnRealDevice(browser)

    await completeOnboarding(page, 'Berta')
    const email = testEmail('syncwrite')
    await runSetupWizard(page, email)

    const userId = await readSyncUserId(page)
    expect(userId).toBeTruthy()
    createdUsers.push(userId!)

    // Trigger a state change → auto-sync fires after 5 s.
    // Add an answer so the app has something to sync.
    await page.evaluate(() => {
      const bridge = (window as unknown as { __rmState?: { get: () => Record<string, unknown> | null; save: (s: unknown) => void } }).__rmState
      const state = bridge?.get() ?? {}
      const answers = (state.answers as Record<string, unknown>) ?? {}
      const now = new Date().toISOString()
      answers['sync-q1'] = { id: 'sync-q1', questionId: 'sync-q1', categoryId: 'childhood', value: 'Gesyncter Wert.', createdAt: now, updatedAt: now }
      state.answers = answers
      bridge?.save(state)
    })

    // Wait up to 15 s for auto-sync to fire
    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from('private_sync_state')
            .select('state_ct, state_iv, encryption')
            .eq('user_id', userId!)
            .maybeSingle()
          return Boolean(data?.state_ct)
        },
        { timeout: 30_000, intervals: [2_000] },
      )
      .toBe(true)

    // Verify the stored blob is ciphertext (not plaintext)
    const { data: row } = await admin
      .from('private_sync_state')
      .select('state_ct, state_iv, encryption')
      .eq('user_id', userId!)
      .single()
    expect(row!.encryption).toBe('recovery-code')
    expect(row!.state_ct).not.toContain('Gesyncter Wert.')  // must be encrypted
    expect(row!.state_iv).toBeTruthy()

    await ctx.close()
  })

  // ── RLS-Isolation ─────────────────────────────────────────────────────────

  test('rls-isolation: User B kann User As Sync-Zeile nicht lesen', async ({ browser }) => {
    test.setTimeout(90_000)
    const { ctx: ctxA, page: pageA } = await spawnRealDevice(browser)
    const { ctx: ctxB, page: pageB } = await spawnRealDevice(browser)

    await completeOnboarding(pageA, 'Alice')
    const emailA = testEmail('rls-a')
    await runSetupWizard(pageA, emailA)
    const userIdA = await readSyncUserId(pageA)
    expect(userIdA).toBeTruthy()
    createdUsers.push(userIdA!)

    await completeOnboarding(pageB, 'Bob')
    const emailB = testEmail('rls-b')
    await runSetupWizard(pageB, emailB)
    const userIdB = await readSyncUserId(pageB)
    expect(userIdB).toBeTruthy()
    createdUsers.push(userIdB!)

    // Trigger sync for Alice so her row exists
    await pageA.evaluate(() => {
      const bridge = (window as unknown as { __rmState?: { get: () => Record<string, unknown> | null; save: (s: unknown) => void } }).__rmState
      const state = bridge?.get() ?? {}
      const answers = (state.answers as Record<string, unknown>) ?? {}
      const now = new Date().toISOString()
      answers['rls-q1'] = { id: 'rls-q1', questionId: 'rls-q1', categoryId: 'family', value: 'Privat.', createdAt: now, updatedAt: now }
      state.answers = answers
      bridge?.save(state)
    })
    await expect
      .poll(
        async () => {
          const { data } = await admin.from('private_sync_state').select('user_id').eq('user_id', userIdA!)
          return (data?.length ?? 0) > 0
        },
        { timeout: 30_000, intervals: [2_000] },
      )
      .toBe(true)

    // Bob (via anon client signed in as Bob) must NOT see Alice's row
    const { createClient } = await import('@supabase/supabase-js')
    const bobClient = createClient(
      process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321',
      process.env.SUPABASE_ANON_KEY ?? '',
      { auth: { persistSession: false } },
    )
    // Sign Bob in
    await bobClient.auth.signInWithPassword({ email: emailB, password: TEST_PASSWORD })
    const { data: rows } = await bobClient
      .from('private_sync_state')
      .select('user_id')
      .eq('user_id', userIdA!)
    expect(rows?.length ?? 0).toBe(0)  // RLS: Bob sieht Alice's Zeile nicht

    await ctxA.close()
    await ctxB.close()
  })

  // ── Deaktivierung ─────────────────────────────────────────────────────────

  test('deactivate: „Cloud löschen" entfernt Zeile aus private_sync_state', async ({ browser }) => {
    test.setTimeout(90_000)
    const { ctx, page } = await spawnRealDevice(browser)

    await completeOnboarding(page, 'Cara')
    const email = testEmail('deact')
    await runSetupWizard(page, email)

    const userId = await readSyncUserId(page)
    expect(userId).toBeTruthy()
    createdUsers.push(userId!)

    // Warte bis Sync-Zeile existiert
    await page.evaluate(() => {
      const bridge = (window as unknown as { __rmState?: { get: () => Record<string, unknown> | null; save: (s: unknown) => void } }).__rmState
      const state = bridge?.get() ?? {}
      ;(state.answers as Record<string, unknown>)['deact-q1'] = {
        id: 'deact-q1', questionId: 'deact-q1', categoryId: 'childhood',
        value: 'Wird gelöscht.', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }
      bridge?.save(state)
    })
    await expect
      .poll(
        async () => {
          const { data } = await admin.from('private_sync_state').select('user_id').eq('user_id', userId!)
          return (data?.length ?? 0) > 0
        },
        { timeout: 30_000, intervals: [2_000] },
      )
      .toBe(true)

    // Deaktivieren via UI
    await page.getByRole('button', { name: 'Sync deaktivieren' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: /Ja, Cloud-Daten löschen/ }).click()

    // Setup-View muss wieder erscheinen
    await expect(page.getByRole('button', { name: 'Einrichten' })).toBeVisible({ timeout: 20_000 })

    // DB-Zeile muss gelöscht sein
    await expect
      .poll(
        async () => {
          const { data } = await admin.from('private_sync_state').select('user_id').eq('user_id', userId!)
          return data?.length ?? 0
        },
        { timeout: 10_000 },
      )
      .toBe(0)

    await ctx.close()
  })

  // ── Zweites Gerät / Sign-in ───────────────────────────────────────────────

  test('new-device: Sign-in auf zweitem Gerät stellt Sync wieder her', async ({ browser }) => {
    test.setTimeout(120_000)
    const { ctx: ctx1, page: page1 } = await spawnRealDevice(browser)
    const { ctx: ctx2, page: page2 } = await spawnRealDevice(browser)

    // Gerät 1: Setup + Sync
    await completeOnboarding(page1, 'Dani')
    const email = testEmail('newdev')
    const recoveryCode = await runSetupWizard(page1, email)
    const userId = await readSyncUserId(page1)
    expect(userId).toBeTruthy()
    createdUsers.push(userId!)

    // Eintrag speichern damit etwas synct
    await page1.evaluate(() => {
      const bridge = (window as unknown as { __rmState?: { get: () => Record<string, unknown> | null; save: (s: unknown) => void } }).__rmState
      const state = bridge?.get() ?? {}
      ;(state.answers as Record<string, unknown>)['newdev-q1'] = {
        id: 'newdev-q1', questionId: 'newdev-q1', categoryId: 'childhood',
        value: 'Zweites Gerät Test.', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }
      bridge?.save(state)
    })
    await expect
      .poll(
        async () => {
          const { data } = await admin.from('private_sync_state').select('user_id').eq('user_id', userId!)
          return (data?.length ?? 0) > 0
        },
        { timeout: 30_000, intervals: [2_000] },
      )
      .toBe(true)

    // Gerät 2: Anmelden (bestehendes Konto)
    await completeOnboarding(page2, 'Dani2')
    await openSyncTab(page2)
    await page2.getByRole('button', { name: 'Einrichten' }).click()
    await page2.getByRole('button', { name: /Storyhold Server/ }).click()
    await page2.getByRole('button', { name: 'Weiter' }).click()
    await page2.getByRole('button', { name: /Ja, ich habe bereits ein Konto/ }).click()

    // Sign-in Formular
    await expect(page2.getByRole('heading', { name: /Anmelden/, exact: false })).toBeVisible()
    await page2.getByLabel('E-Mail').fill(email)
    await page2.getByLabel('Passwort').fill(TEST_PASSWORD)
    await page2.getByRole('button', { name: /Anmelden/ }).click()

    // Recovery-Code-Eingabe
    await expect(page2.getByRole('heading', { name: /Sicherheitsschlüssel/ })).toBeVisible({ timeout: 20_000 })
    await page2.getByLabel(/Sicherheitsschlüssel|Recovery/).fill(recoveryCode)
    await page2.getByRole('button', { name: /Weiter|Entschlüsseln/ }).click()

    // Sync-Hub auf zweitem Gerät
    await expect(page2.getByRole('heading', { name: 'Privater Sync', exact: true })).toBeVisible({ timeout: 30_000 })

    await ctx1.close()
    await ctx2.close()
  })
})

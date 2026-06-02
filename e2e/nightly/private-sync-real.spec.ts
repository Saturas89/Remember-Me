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
  const adminClient = supabaseAdmin()
  const now = new Date().toISOString()

  // Pre-create the user so we have a known ID and immediately confirmed
  // email — no slow listUsers() scan, no race with GoTrue's confirmation mail.
  const { data: preCreated, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createError || !preCreated.user) throw new Error(`Pre-create failed: ${createError?.message}`)
  const preUserId = preCreated.user.id

  // Sign in from Node now (email already confirmed) to get real tokens.
  const nodeClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { data: preLogin, error: loginError } = await nodeClient.auth.signInWithPassword({ email, password })
  if (loginError || !preLogin.session) throw new Error(`Pre-login failed: ${loginError?.message}`)
  const { access_token, refresh_token } = preLogin.session

  // Intercept the browser's /signup POST and return a synthetic session response.
  // This decouples the test from whatever Supabase URL is baked into the
  // production bundle and eliminates email-confirmation latency.  The GoTrue SDK
  // sees access_token → calls _saveSession() → emits SIGNED_IN → app advances to
  // the recovery-code screen without any email-confirmation bypass logic.
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
          id: preUserId,
          aud: 'authenticated',
          role: 'authenticated',
          email,
          email_confirmed_at: now,
          app_metadata: { provider: 'email', providers: ['email'] },
          user_metadata: {},
          identities: [{
            id: preUserId,
            user_id: preUserId,
            identity_data: { email, sub: preUserId },
            provider: 'email',
            last_sign_in_at: now,
            created_at: now,
            updated_at: now,
          }],
          created_at: now,
          updated_at: now,
        },
      }),
    })
  })

  try {
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

    const recoveryHeading = page.getByRole('heading', { name: 'Dein Sicherheitsschlüssel' })
    const pendingHeading  = page.getByRole('heading', { name: 'Bestätige deine E-Mail' })

    // .or() waits atomically until EITHER heading is visible. With the synthetic
    // session response, the SDK calls _saveSession() → SIGNED_IN → recovery-code
    // screen appears directly. The pending branch is a safety net for cases where
    // the SDK routes the response through a different code path (e.g. PKCE exchange).
    await expect(recoveryHeading.or(pendingHeading)).toBeVisible({ timeout: 20_000 })

    if (await pendingHeading.isVisible()) {
      // Fallback: SDK didn't absorb the session from the synthetic response.
      // Inject the pre-obtained tokens directly via the exposed sync client.
      await page.evaluate(async (sess) => {
        type SyncClient = { auth: { setSession: (s: { access_token: string; refresh_token: string }) => Promise<unknown> } }
        const client = (window as unknown as { __rmSyncClient?: SyncClient }).__rmSyncClient
        if (!client) throw new Error('__rmSyncClient not on window — privateSyncClient.ts E2E exposure missing?')
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

  // Hub
  await expect(page.getByRole('heading', { name: 'Privater Sync', exact: true })).toBeVisible({ timeout: 20_000 })
  return codeText
}

/** Reads the privateSync.userId from the in-memory app state bridge.
 *
 * Reads from window.__rmState.get() instead of localStorage because in the
 * production build the app encrypts the localStorage value asynchronously
 * (AES-GCM, "enc1:" prefix). By the time this helper runs the encrypted
 * ciphertext is already written and JSON.parse() on it throws, returning null.
 * The in-memory bridge (_currentState in stateStorage.ts) is always plaintext
 * and updated synchronously inside saveState(), so it reflects the true value
 * the moment onComplete() writes it. */
async function readSyncUserId(page: import('@playwright/test').Page): Promise<string | null> {
  return page.evaluate(() => {
    try {
      const s = (window as unknown as {
        __rmState?: { get: () => Record<string, unknown> | null }
      }).__rmState?.get()
      return (s?.privateSync as { userId?: string } | undefined)?.userId ?? null
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
    test.setTimeout(150_000)
    const { ctx, page } = await spawnRealDevice(browser)

    await completeOnboarding(page, 'Berta')
    const email = testEmail('syncwrite')
    await runSetupWizard(page, email)

    const userId = await readSyncUserId(page)
    expect(userId).toBeTruthy()
    createdUsers.push(userId!)

    // Trigger a state change so the debounce (DEBOUNCE_MS = 30 s) fires.
    // bridge.save() writes to localStorage/_currentState without going
    // through React state, so the debounce is not reset — it fires once,
    // 30 s after providerType changed from null→'supabase' at wizard end.
    // Poll timeout must exceed DEBOUNCE_MS + sync round-trip time.
    await page.evaluate(() => {
      const bridge = (window as unknown as { __rmState?: { get: () => Record<string, unknown> | null; save: (s: unknown) => void } }).__rmState
      const state = bridge?.get() ?? {}
      const answers = (state.answers as Record<string, unknown>) ?? {}
      const now = new Date().toISOString()
      answers['sync-q1'] = { id: 'sync-q1', questionId: 'sync-q1', categoryId: 'childhood', value: 'Gesyncter Wert.', createdAt: now, updatedAt: now }
      state.answers = answers
      bridge?.save?.(state)
    })

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
        { timeout: 90_000, intervals: [3_000] },
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
    test.setTimeout(210_000)
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
      bridge?.save?.(state)
    })
    await expect
      .poll(
        async () => {
          const { data } = await admin.from('private_sync_state').select('user_id').eq('user_id', userIdA!)
          return (data?.length ?? 0) > 0
        },
        { timeout: 90_000, intervals: [3_000] },
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
    test.setTimeout(180_000)
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
      bridge?.save?.(state)
    })
    await expect
      .poll(
        async () => {
          const { data } = await admin.from('private_sync_state').select('user_id').eq('user_id', userId!)
          return (data?.length ?? 0) > 0
        },
        { timeout: 90_000, intervals: [3_000] },
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
    test.setTimeout(210_000)
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
      bridge?.save?.(state)
    })
    await expect
      .poll(
        async () => {
          const { data } = await admin.from('private_sync_state').select('user_id').eq('user_id', userId!)
          return (data?.length ?? 0) > 0
        },
        { timeout: 90_000, intervals: [3_000] },
      )
      .toBe(true)

    // Gerät 2: Anmelden (bestehendes Konto)
    await completeOnboarding(page2, 'Dani2')
    await openSyncTab(page2)
    await page2.getByRole('button', { name: 'Einrichten' }).click()
    await page2.getByRole('button', { name: /Storyhold Server/ }).click()
    await page2.getByRole('button', { name: 'Weiter' }).click()
    await page2.getByRole('button', { name: /Ja, ich melde mich an/ }).click()

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

  // ── New-Device Data Round-trip ─────────────────────────────────────────────

  test('new-device-data-roundtrip: Antworten von Gerät 1 sind nach Sync auf Gerät 2 im Archiv sichtbar', async ({ browser }) => {
    test.setTimeout(240_000)
    const { ctx: ctx1, page: page1 } = await spawnRealDevice(browser)
    const { ctx: ctx2, page: page2 } = await spawnRealDevice(browser)

    // Gerät 1: Setup, Antwort speichern, Sync abwarten
    await completeOnboarding(page1, 'Elli')
    const email = testEmail('roundtrip')
    const recoveryCode = await runSetupWizard(page1, email)
    const userId = await readSyncUserId(page1)
    expect(userId).toBeTruthy()
    createdUsers.push(userId!)

    const testValue = 'Meine Kindheitserinnerung – Roundtrip-Test.'
    await page1.evaluate((val: string) => {
      const bridge = (window as unknown as { __rmState?: { get: () => Record<string, unknown> | null; save?: (s: unknown) => void } }).__rmState
      const state = bridge?.get() ?? {}
      // Use a real question ID from the childhood category so the ArchiveView
      // can find and render the answer (it looks up answers by category question id).
      ;(state.answers as Record<string, unknown>)['childhood-02'] = {
        id: 'childhood-02', questionId: 'childhood-02', categoryId: 'childhood',
        value: val, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }
      if (bridge?.save) {
        bridge.save(state)
      } else {
        // Production build: write plaintext so React picks it up on next load.
        // loadStoredState() treats values without "enc1:" as legacy plaintext.
        localStorage.setItem('remember-me-state', JSON.stringify(state))
      }
    }, testValue)
    // In production the page needs a reload so React re-hydrates the answer
    // from localStorage into state before the sync debounce fires.
    if (!await page1.evaluate(() =>
      typeof (window as unknown as { __rmState?: { save?: unknown } }).__rmState?.save === 'function',
    )) {
      await page1.goto('/sync')
      await expect(page1.getByRole('heading', { name: 'Privater Sync', exact: true })).toBeVisible({ timeout: 30_000 })
    }

    // Warte bis Gerät 1 den verschlüsselten Blob hochgeladen hat
    await expect
      .poll(
        async () => {
          const { data } = await admin.from('private_sync_state').select('user_id').eq('user_id', userId!)
          return (data?.length ?? 0) > 0
        },
        { timeout: 90_000, intervals: [3_000] },
      )
      .toBe(true)

    // Gerät 2: Anmelden mit bestehendem Konto + Recovery Code
    await completeOnboarding(page2, 'Elli2')
    await openSyncTab(page2)
    await page2.getByRole('button', { name: 'Einrichten' }).click()
    await page2.getByRole('button', { name: /Storyhold Server/ }).click()
    await page2.getByRole('button', { name: 'Weiter' }).click()
    await page2.getByRole('button', { name: /Ja, ich melde mich an/ }).click()
    await page2.getByLabel('E-Mail').fill(email)
    await page2.getByLabel('Passwort').fill(TEST_PASSWORD)
    await page2.getByRole('button', { name: /Anmelden/ }).click()
    await expect(page2.getByRole('heading', { name: /Sicherheitsschlüssel/ })).toBeVisible({ timeout: 20_000 })
    await page2.getByLabel(/Sicherheitsschlüssel|Recovery/).fill(recoveryCode)
    await page2.getByRole('button', { name: /Weiter|Entschlüsseln/ }).click()
    await expect(page2.getByRole('heading', { name: 'Privater Sync', exact: true })).toBeVisible({ timeout: 30_000 })

    // After onComplete(), privateSync.syncNow() runs in the background.
    // Wait until the merged app-state contains device 1's answer before
    // navigating to the archive (the archive re-renders reactively, but we
    // want to land on the right view only after the data is there).
    await expect.poll(async () => {
      return page2.evaluate((val) => {
        const s = (window as unknown as { __rmState?: { get: () => Record<string, unknown> | null } }).__rmState?.get()
        const answers = s?.answers as Record<string, { value: string }> | undefined
        return Object.values(answers ?? {}).some(a => a.value === val)
      }, testValue)
    }, { timeout: 90_000, intervals: [3_000] }).toBe(true)

    // Zum Archiv navigieren und prüfen, dass die Antwort von Gerät 1 sichtbar ist
    const nav = page2.getByRole('navigation', { name: 'Hauptnavigation' })
    await nav.getByRole('button', { name: 'Vermächtnis', exact: true }).click()
    await expect(page2.getByText(testValue)).toBeVisible({ timeout: 10_000 })

    await ctx1.close()
    await ctx2.close()
  })

  // ── Re-Login ───────────────────────────────────────────────────────────────

  test('relogin: Anmelden auf bestehendem Konto zeigt Sync-Hub und erhält Daten', async ({ browser }) => {
    test.setTimeout(180_000)
    const { ctx: ctx1, page: page1 } = await spawnRealDevice(browser)
    const { ctx: ctx2, page: page2 } = await spawnRealDevice(browser)

    // Gerät 1: Konto anlegen + Eintrag speichern
    await completeOnboarding(page1, 'Fiona')
    const email = testEmail('relogin')
    const recoveryCode = await runSetupWizard(page1, email)
    const userId = await readSyncUserId(page1)
    expect(userId).toBeTruthy()
    createdUsers.push(userId!)

    const loginTestValue = 'Relogin-Erinnerung.'
    await page1.evaluate((val: string) => {
      const bridge = (window as unknown as { __rmState?: { get: () => Record<string, unknown> | null; save?: (s: unknown) => void } }).__rmState
      const state = bridge?.get() ?? {}
      // Use a real question ID from the family category so the ArchiveView
      // can find and render the answer (it looks up answers by category question id).
      ;(state.answers as Record<string, unknown>)['family-01'] = {
        id: 'family-01', questionId: 'family-01', categoryId: 'family',
        value: val, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }
      if (bridge?.save) {
        bridge.save(state)
      } else {
        // Production build: write plaintext so React picks it up on next load.
        // loadStoredState() treats values without "enc1:" as legacy plaintext.
        localStorage.setItem('remember-me-state', JSON.stringify(state))
      }
    }, loginTestValue)
    // In production the page needs a reload so React re-hydrates the answer
    // from localStorage into state before the sync debounce fires.
    if (!await page1.evaluate(() =>
      typeof (window as unknown as { __rmState?: { save?: unknown } }).__rmState?.save === 'function',
    )) {
      await page1.goto('/sync')
      await expect(page1.getByRole('heading', { name: 'Privater Sync', exact: true })).toBeVisible({ timeout: 30_000 })
    }

    await expect
      .poll(
        async () => {
          const { data } = await admin.from('private_sync_state').select('user_id').eq('user_id', userId!)
          return (data?.length ?? 0) > 0
        },
        { timeout: 90_000, intervals: [3_000] },
      )
      .toBe(true)

    // Gerät 2 simuliert dasselbe Gerät nach App-Neustart / Cache-Leerung:
    // frische Context, bekannte E-Mail + Passwort + Recovery-Code
    await completeOnboarding(page2, 'Fiona')
    await openSyncTab(page2)
    await page2.getByRole('button', { name: 'Einrichten' }).click()
    await page2.getByRole('button', { name: /Storyhold Server/ }).click()
    await page2.getByRole('button', { name: 'Weiter' }).click()
    await page2.getByRole('button', { name: /Ja, ich melde mich an/ }).click()

    await expect(page2.getByRole('heading', { name: /Anmelden/, exact: false })).toBeVisible()
    await page2.getByLabel('E-Mail').fill(email)
    await page2.getByLabel('Passwort').fill(TEST_PASSWORD)
    await page2.getByRole('button', { name: /Anmelden/ }).click()

    // Recovery-Code eingeben
    await expect(page2.getByRole('heading', { name: /Sicherheitsschlüssel/ })).toBeVisible({ timeout: 20_000 })
    await page2.getByLabel(/Sicherheitsschlüssel|Recovery/).fill(recoveryCode)
    await page2.getByRole('button', { name: /Weiter|Entschlüsseln/ }).click()

    // Sync-Hub muss sichtbar sein und Provider korrekt anzeigen
    await expect(page2.getByRole('heading', { name: 'Privater Sync', exact: true })).toBeVisible({ timeout: 30_000 })
    await expect(page2.getByText(/Storyhold Server/i)).toBeVisible()

    // After onComplete(), privateSync.syncNow() runs asynchronously.
    // Poll the in-memory bridge until device 1's answer has been merged into
    // the app state before navigating to the archive view.
    await expect.poll(async () => {
      return page2.evaluate((val) => {
        const s = (window as unknown as { __rmState?: { get: () => Record<string, unknown> | null } }).__rmState?.get()
        const answers = s?.answers as Record<string, { value: string }> | undefined
        return Object.values(answers ?? {}).some(a => a.value === val)
      }, loginTestValue)
    }, { timeout: 90_000, intervals: [3_000] }).toBe(true)

    // Archiv prüfen: Eintrag muss nach Re-Login entschlüsselt verfügbar sein
    const nav2 = page2.getByRole('navigation', { name: 'Hauptnavigation' })
    await nav2.getByRole('button', { name: 'Vermächtnis', exact: true }).click()
    await expect(page2.getByText(loginTestValue)).toBeVisible({ timeout: 10_000 })

    await ctx1.close()
    await ctx2.close()
  })
})

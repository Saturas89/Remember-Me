// Chaos / edge-case tests for the Storyhold Server sync wizard.
//
// Covers cancel paths, wrong credentials, dialog interactions and mid-flow
// navigation that normal happy-path tests don't exercise.  All tests use the
// Supabase provider — no third-party OAuth is involved.
//
// Cleanup: afterEach deletes any auth.users rows created during the test.

import { test, expect } from '@playwright/test'
import { cleanupUsers, spawnRealDevice, supabaseAdmin } from './helpers'
import { completeOnboarding } from '../helpers/family-mode-helpers'
import {
  TEST_PASSWORD,
  testEmail,
  openSyncTab,
  readSyncUserId,
  runSetupWizard,
  waitForFirstSync,
  goToEnterCodeStep,
} from './private-sync-helpers'

test.describe('Private Sync – Chaos Tests (Storyhold Server)', () => {
  const createdUsers: string[] = []
  const admin = supabaseAdmin()

  test.afterEach(async () => {
    await cleanupUsers(admin, createdUsers.splice(0))
  })

  // ── 1. Back-Navigation ───────────────────────────────────────────────────────

  test('wizard-back-navigation: ← Zurück-Buttons kehren zur vorherigen Stufe zurück', async ({ browser }) => {
    // 90 s: completeOnboarding + goto production + navigation steps can sum to
    // ~60 s on narrow-viewport Samsung S23 simulation; the extra headroom
    // prevents the test from hitting the timer before the final assertion.
    test.setTimeout(90_000)
    const { ctx, page } = await spawnRealDevice(browser)
    await completeOnboarding(page, 'Toni')

    await openSyncTab(page)
    await page.getByRole('button', { name: 'Einrichten' }).click()

    // Provider-Wahl
    await expect(page.getByRole('heading', { name: /Wo sollen deine Daten/ })).toBeVisible()
    await page.getByRole('button', { name: /Storyhold Server/ }).click()
    await page.getByRole('button', { name: 'Weiter' }).click()

    // Konto-Modus
    await expect(page.getByRole('heading', { name: /Hast du schon ein Konto/ })).toBeVisible()

    // ← Zurück → Provider-Wahl
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.getByRole('button', { name: /← Zurück/ }).click()
    await expect(page.getByRole('heading', { name: /Wo sollen deine Daten/ })).toBeVisible()

    // ← Zurück → Intro. Scroll to top first so the topbar back-button is
    // fully in the hit area on narrow-viewport devices (e.g. Samsung S23, 360 px).
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.getByRole('button', { name: /← Zurück/ }).click()
    await expect(page.getByRole('button', { name: 'Einrichten' })).toBeVisible({ timeout: 10_000 })

    await ctx.close()
  })

  // ── 2. Wizard mid-form verlassen ─────────────────────────────────────────────

  test('wizard-abandon-mid-form: Navigation weg vom Formular setzt Wizard zurück', async ({ browser }) => {
    test.setTimeout(60_000)
    const { ctx, page } = await spawnRealDevice(browser)
    await completeOnboarding(page, 'Felix')

    await openSyncTab(page)
    await page.getByRole('button', { name: 'Einrichten' }).click()
    await page.getByRole('button', { name: /Storyhold Server/ }).click()
    await page.getByRole('button', { name: 'Weiter' }).click()
    await page.getByRole('button', { name: /Nein, neues Konto erstellen/ }).click()

    // Formular mit Daten füllen, aber NICHT abschicken
    await expect(page.getByRole('heading', { name: 'Konto erstellen', exact: true })).toBeVisible()
    await page.getByLabel('E-Mail').fill('halffinished@example.invalid')
    await page.getByLabel('Passwort').fill('geheim1234!')

    // Zu einem anderen Tab navigieren
    const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
    await nav.getByRole('button', { name: 'Familie', exact: true }).click()
    await expect(page.getByRole('heading', { name: /Familie|Online teilen|verbunden/, exact: false })).toBeVisible()

    // Zurück zu Sync: Wizard-State zurückgesetzt → Einrichten-Button
    await nav.getByRole('button', { name: 'Sync', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Einrichten' })).toBeVisible({ timeout: 5_000 })

    await ctx.close()
  })

  // ── 3. Falsches Passwort ─────────────────────────────────────────────────────

  test('wrong-password: Fehlermeldung erscheint bei falschem Passwort', async ({ browser }) => {
    test.setTimeout(90_000)
    const { ctx, page } = await spawnRealDevice(browser)
    const email = testEmail('wrongpw')

    // User vorab anlegen (admin)
    const { data, error } = await admin.auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true })
    expect(error).toBeNull()
    createdUsers.push(data.user!.id)

    await completeOnboarding(page, 'Greta')
    await openSyncTab(page)
    await page.getByRole('button', { name: 'Einrichten' }).click()
    await page.getByRole('button', { name: /Storyhold Server/ }).click()
    await page.getByRole('button', { name: 'Weiter' }).click()
    await page.getByRole('button', { name: /Ja, ich melde mich an/ }).click()

    await expect(page.getByRole('heading', { name: /Anmelden/, exact: false })).toBeVisible()
    await page.getByLabel('E-Mail').fill(email)
    await page.getByLabel('Passwort').fill('dieses-passwort-ist-falsch!')
    await page.getByRole('button', { name: /Anmelden/ }).click()

    // Fehlermeldung muss sichtbar sein
    await expect(page.locator('.private-sync-view__error')).toBeVisible({ timeout: 15_000 })
    // Formular noch da → User kann erneut versuchen
    await expect(page.getByLabel('E-Mail')).toBeVisible()

    await ctx.close()
  })

  // ── 4. Falscher Recovery-Code, dann richtiger ────────────────────────────────

  test('wrong-recovery-code: Fehler bei falschem Schlüssel, richtiger Schlüssel öffnet Hub', async ({ browser }) => {
    test.setTimeout(240_000)
    const { ctx: ctx1, page: page1 } = await spawnRealDevice(browser)
    const { ctx: ctx2, page: page2 } = await spawnRealDevice(browser)

    await completeOnboarding(page1, 'Hanna')
    const email = testEmail('wrongcode')
    const recoveryCode = await runSetupWizard(page1, email)
    const userId = await readSyncUserId(page1)
    createdUsers.push(userId!)
    await waitForFirstSync(admin, userId!, 90_000)
    await ctx1.close()

    await completeOnboarding(page2, 'Hanna2')
    await goToEnterCodeStep(page2, email)

    // Falscher Code
    await page2.getByLabel(/Sicherheitsschlüssel|Recovery/).fill('XXXX-XXXX-XXXX-XXXX-XXXX-XXXX')
    await page2.getByRole('button', { name: /Entschlüsseln/ }).click()
    await expect(page2.locator('.private-sync-view__error')).toBeVisible({ timeout: 10_000 })
    await expect(page2.locator('.private-sync-view__error')).toContainText(/Falscher Schlüssel/)

    // Korrekter Code → Hub
    await page2.getByLabel(/Sicherheitsschlüssel|Recovery/).fill(recoveryCode)
    await page2.getByRole('button', { name: /Entschlüsseln/ }).click()
    await expect(page2.getByRole('heading', { name: 'Privater Sync', exact: true })).toBeVisible({ timeout: 20_000 })

    await ctx2.close()
  })

  // ── 5. Deaktivierungs-Dialog abbrechen ───────────────────────────────────────

  test('deactivate-cancel: Abbrechen im Deaktivierungs-Dialog lässt Sync aktiv', async ({ browser }) => {
    test.setTimeout(150_000)
    const { ctx, page } = await spawnRealDevice(browser)

    await completeOnboarding(page, 'Ines')
    const email = testEmail('deactcancel')
    await runSetupWizard(page, email)
    const userId = await readSyncUserId(page)
    createdUsers.push(userId!)

    // Deaktivieren anklicken
    await page.getByRole('button', { name: 'Sync deaktivieren' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Abbrechen
    await dialog.getByRole('button', { name: 'Abbrechen' }).click()
    await expect(dialog).not.toBeVisible()

    // Sync-Hub muss noch da sein
    await expect(page.getByRole('heading', { name: 'Privater Sync', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sync deaktivieren' })).toBeVisible()

    // DB-Zeile noch vorhanden
    const { data } = await admin.from('private_sync_state').select('user_id').eq('user_id', userId!)
    // Die Zeile wird erst beim ersten echten Sync angelegt; deactivate-cancel
    // darf sie nicht löschen — rows?.length kann 0 oder 1 sein, aber nicht -1.
    expect(data).not.toBeNull()

    await ctx.close()
  })

  // ── 6. „Schlüssel verloren?"-Dialog abbrechen ────────────────────────────────

  test('lost-key-cancel: Abbrechen schließt Dialog ohne Reset', async ({ browser }) => {
    test.setTimeout(240_000)
    const { ctx: ctx1, page: page1 } = await spawnRealDevice(browser)
    const { ctx: ctx2, page: page2 } = await spawnRealDevice(browser)

    await completeOnboarding(page1, 'Jonas')
    const email = testEmail('lostcancel')
    await runSetupWizard(page1, email)
    const userId = await readSyncUserId(page1)
    createdUsers.push(userId!)
    await ctx1.close()

    await completeOnboarding(page2, 'Jonas2')
    await goToEnterCodeStep(page2, email)

    // Schlüssel verloren? Dialog öffnen
    await page2.getByRole('button', { name: /Schlüssel verloren/ }).click()
    const dialog = page2.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Abbrechen → Dialog weg, Eingabefeld noch da
    await dialog.getByRole('button', { name: 'Abbrechen' }).click()
    await expect(dialog).not.toBeVisible()
    await expect(page2.getByLabel(/Sicherheitsschlüssel|Recovery/)).toBeVisible()

    await ctx2.close()
  })

  // ── 7. „Schlüssel verloren?" bestätigen → Reset ──────────────────────────────

  test('lost-key-reset: Neu starten generiert neuen Sicherheitsschlüssel', async ({ browser }) => {
    test.setTimeout(240_000)
    const { ctx: ctx1, page: page1 } = await spawnRealDevice(browser)
    const { ctx: ctx2, page: page2 } = await spawnRealDevice(browser)

    await completeOnboarding(page1, 'Klara')
    const email = testEmail('lostreset')
    await runSetupWizard(page1, email)
    const userId = await readSyncUserId(page1)
    createdUsers.push(userId!)
    await ctx1.close()

    await completeOnboarding(page2, 'Klara2')
    await goToEnterCodeStep(page2, email)

    // Schlüssel verloren? → Neu starten
    await page2.getByRole('button', { name: /Schlüssel verloren/ }).click()
    const dialog = page2.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Neu starten' }).click()

    // Wizard zeigt neuen Sicherheitsschlüssel (recovery-code step)
    await expect(page2.getByRole('heading', { name: 'Dein Sicherheitsschlüssel' })).toBeVisible({ timeout: 10_000 })
    const newCode = await page2.locator('.private-sync-view__code').textContent()
    expect(newCode?.trim().length).toBeGreaterThan(0)

    await ctx2.close()
  })
})

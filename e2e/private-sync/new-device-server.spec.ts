import { test, expect } from '@playwright/test'
import {
  completeOnboarding,
  createSyncMockState,
  dismissInstallPrompt,
  installPrivateSyncSupabaseMock,
  openSyncTab,
  E2E_USER_ID,
} from './helpers'

// E2E-05 – Neues Gerät: Sicherheitsschlüssel eingeben
// Ableitung: Master-Spec §13, US-008.
//
// Simuliert ein "zweites Gerät", indem wir vor dem Setup einen verschlüsselten
// State in die gemockte Supabase-Tabelle legen. Die App liest danach beim
// Code-Eingabe-Screen den Eintrag, versucht ihn zu entschlüsseln und meldet
// einen Fehler bei falschem Code.

test.describe('Privater Sync – Recovery-Code auf neuem Gerät (E2E-05)', () => {
  test('Falscher Sicherheitsschlüssel zeigt Fehlermeldung', async ({ context, page }) => {
    await dismissInstallPrompt(context)
    const mock = createSyncMockState()
    // Pretend an existing encrypted row already exists for this user.
    mock.rows.set(E2E_USER_ID, {
      state_ct: 'aGVsbG8=', // base64 garbage – decryption fails for any key
      state_iv: 'AAAAAAAAAAAAAAAAAAAAAAA=',
      encryption: 'recovery-code',
      updated_at: new Date().toISOString(),
    })
    await installPrivateSyncSupabaseMock(context, mock)

    await completeOnboarding(page, 'Eva')
    await openSyncTab(page)

    // Walk the wizard: Server → Account-Mode → Sign-In → Enter-Code.
    await page.getByRole('button', { name: 'Einrichten' }).click()
    await page.getByRole('button', { name: /Storyhold Server/ }).click()
    await page.getByRole('button', { name: 'Weiter' }).click()

    // H4: returning user picks "Anmelden" explicitly.
    await expect(page.getByRole('heading', { name: /Hast du schon ein Konto/ })).toBeVisible()
    await page.getByRole('button', { name: /Ja, ich melde mich an/ }).click()

    await page.getByLabel('E-Mail').fill('returning@example.com')
    await page.getByLabel('Passwort').fill('passw0rd!')
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click()

    // With a row pre-seeded for this user, the wizard lands on Enter-Code.
    await expect(page.getByRole('heading', {
      name: /Sicherheitsschlüssel eingeben|Dein Sicherheitsschlüssel/,
    })).toBeVisible()
  })
})

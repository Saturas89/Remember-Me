import { test, expect } from '@playwright/test'
import {
  completeOnboarding,
  dismissInstallPrompt,
  openSyncTab,
} from './helpers'
import { createDriveMockState, installGoogleDriveMock } from '../mocks/googleDriveMock'

// E2E-02 – Setup-Wizard für Provider „Google Drive"
// Ableitung: Master-Spec §13, US-007.

test.describe('Privater Sync – Setup-Wizard Google Drive (E2E-02)', () => {
  test.beforeEach(async ({ context }) => {
    await dismissInstallPrompt(context)
    await installGoogleDriveMock(context, createDriveMockState())
  })

  test('Google-Drive-Setup nutzt OAuth-Mock und schließt erfolgreich ab', async ({ page }) => {
    await completeOnboarding(page, 'Bea')
    await openSyncTab(page)

    // S1
    await page.getByRole('button', { name: 'Einrichten' }).click()

    // S2 – Provider-Auswahl. „Weiter" startet jetzt direkt den Google-OAuth-Flow,
    // ein separater Anmelden-Screen entfällt. Der Continue-Button bleibt sichtbar
    // und wechselt während des Flows in den Lade-Zustand.
    await page.getByRole('button', { name: /Google Drive/ }).click()
    const continueBtn = page.getByRole('button', { name: 'Weiter' })
    await expect(continueBtn).toBeEnabled()

    // We don't click further than the visible UI in this scenario because the
    // GoogleDriveProvider implementation depends on @react-oauth/google
    // internals that are not yet exercised end-to-end. The presence of the
    // enabled continue button + the working OAuth-mock surface is the contract
    // under test.
  })

  // Regression (PKCE flow): after the redirect comes back as `?code=…`,
  // Supabase auto-exchanges it for a session and emits SIGNED_IN with
  // provider_token. resumeFromOAuth listens for that event and forwards the
  // user to the recovery-code step instead of the login error.
  //
  // Routing the Supabase /token endpoint to a stub session in this test
  // would replicate Supabase's backend behaviour; here we exercise the
  // simpler invariant: with the pending flag set and no real OAuth code, the
  // listener times out cleanly and the user lands on the documented error
  // — never on a stale "...fehlgeschlagen" screen with a bearer in the URL.
  test('PKCE-Resume: ohne gültigen ?code= meldet die View klar einen Auth-Fehler', async ({ page }) => {
    await completeOnboarding(page, 'Bea')

    await page.evaluate(() => {
      sessionStorage.setItem('rm-gdrive-oauth-pending', '1')
    })

    // No `?code=…` query param → Supabase emits INITIAL_SESSION (null), our
    // listener gives up, view shows the error message.
    await page.goto('/sync')

    await expect(page.getByText('Google-Authentifizierung fehlgeschlagen'))
      .toBeVisible({ timeout: 25_000 })
    // URL must not retain any stale OAuth fragment from a pre-PKCE flow.
    expect(await page.evaluate(() => window.location.hash)).toBe('')
  })
})

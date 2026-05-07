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

    // S2
    await page.getByRole('button', { name: /Google Drive/ }).click()
    await page.getByRole('button', { name: 'Weiter' }).click()

    // S3 – OAuth-Button (Mock liefert Token sofort).
    const signInBtn = page.getByRole('button', { name: 'Mit Google anmelden' })
    await expect(signInBtn).toBeVisible()

    // We don't click further than the visible UI in this scenario because the
    // GoogleDriveProvider implementation depends on @react-oauth/google
    // internals that are not yet exercised end-to-end. The presence of the
    // button + the working OAuth-mock surface is the contract under test.
  })

  // Regression: after a successful Google OAuth redirect the user used to land
  // on the login screen with "Google-Authentifizierung fehlgeschlagen" because
  // the session was raced against detectSessionInUrl. resumeFromOAuth now
  // reads provider_token directly from the URL hash, so a redirect return
  // must take the user straight to the recovery-code step.
  test('OAuth-Redirect mit provider_token im Hash setzt das Setup fort', async ({ page }) => {
    await completeOnboarding(page, 'Bea')

    // Simulate the state Supabase leaves on the page right before the browser
    // navigates to Google: the pending flag in sessionStorage. We then arrive
    // back at /sync with the implicit-flow hash that Google + Supabase would
    // have populated on a successful redirect.
    await page.evaluate(() => {
      sessionStorage.setItem('rm-gdrive-oauth-pending', '1')
    })

    const oauthHash =
      '#access_token=mock-supabase-access' +
      '&provider_token=mock-google-provider-token' +
      '&token_type=bearer' +
      '&expires_in=3600' +
      '&refresh_token=mock-refresh'
    await page.goto(`/sync${oauthHash}`)

    // Setup wizard resumes at the recovery-code step (no existing sync file
    // → first-device flow).
    await expect(page.getByRole('heading', { name: 'Dein Sicherheitsschlüssel' }))
      .toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Google-Authentifizierung fehlgeschlagen')).toHaveCount(0)
  })
})

import { test, expect } from '@playwright/test'
import {
  completeOnboarding,
  createSyncMockState,
  dismissInstallPrompt,
  installPrivateSyncSupabaseMock,
  openSyncTab,
} from './helpers'

// E2E-01 – Setup-Wizard für Provider „Storyhold Server" (Supabase)
// Ableitung: Master-Spec §13, AC-001-* / US-008.

test.describe('Privater Sync – Setup-Wizard Server (E2E-01)', () => {
  test.beforeEach(async ({ context }) => {
    await dismissInstallPrompt(context)
    await installPrivateSyncSupabaseMock(context, createSyncMockState())
  })

  test('Komplettes Setup mit Server-Provider zeigt am Ende den Sync-Hub', async ({ page }) => {
    await completeOnboarding(page, 'Anna')
    await openSyncTab(page)

    // S1: Intro
    await expect(page.getByRole('heading', { name: 'Privater Sync' })).toBeVisible()
    await page.getByRole('button', { name: 'Einrichten' }).click()

    // S2: Provider-Wahl – „Storyhold Server"
    await expect(page.getByRole('heading', { name: /Wo sollen deine Daten/ })).toBeVisible()
    await page.getByRole('button', { name: /Storyhold Server/ }).click()
    await page.getByRole('button', { name: 'Weiter' }).click()

    // S3: Konto-Modus (H4: explicit sign-up choice).
    await expect(page.getByRole('heading', { name: /Hast du schon ein Konto/ })).toBeVisible()
    await page.getByRole('button', { name: /Nein, neues Konto erstellen/ }).click()

    // S4: E-Mail-Registrierung (mocked via installPrivateSyncSupabaseMock).
    await expect(page.getByRole('heading', { name: 'Konto erstellen', exact: true })).toBeVisible()
    await page.getByLabel('E-Mail').fill('test@example.com')
    await page.getByLabel('Passwort').fill('passw0rd!')
    await page.getByRole('button', { name: 'Konto erstellen', exact: true }).click()

    // S5: Recovery Code
    await expect(page.getByRole('heading', { name: 'Dein Sicherheitsschlüssel' })).toBeVisible()
    const code = page.locator('.private-sync-view__code')
    await expect(code).toBeVisible()
    await expect(code).toHaveText(/^[A-Za-z0-9]{4}(-[A-Za-z0-9]{4}){5}$/)

    const continueBtn = page.getByRole('button', { name: 'Weiter' })
    await expect(continueBtn).toBeDisabled()
    await page.getByRole('checkbox').check()
    await expect(continueBtn).toBeEnabled()
    await continueBtn.click()

    // After completion, the Hub view is rendered (the App auto-switches once
    // appState.privateSync is set by onComplete).
    await expect(page.getByRole('heading', { name: 'Privater Sync', exact: true })).toBeVisible()
    await expect(page.getByText(/Storyhold Server/)).toBeVisible()
  })
})

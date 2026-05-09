import { test, expect } from '@playwright/test'
import {
  completeOnboarding,
  createSyncMockState,
  dismissInstallPrompt,
  installPrivateSyncSupabaseMock,
  openSyncTab,
  seedActiveSync,
  E2E_USER_ID,
} from './helpers'

// E2E-03 – Hub zeigt Status-Badge; manueller Sync-Button nur im Fehlerfall.
// Ableitung: Master-Spec §13, US-004.

test.describe('Privater Sync – Hub-Anzeige (E2E-03)', () => {
  test.beforeEach(async ({ context }) => {
    await dismissInstallPrompt(context)
    await installPrivateSyncSupabaseMock(context, createSyncMockState())
  })

  test('Hub rendert Status-Badge und blendet manuellen Sync-Button im Normalfall aus', async ({ page }) => {
    await seedActiveSync(page, 'supabase', E2E_USER_ID)
    await completeOnboarding(page, 'Cara')
    await openSyncTab(page)

    // Hub is rendered because seedActiveSync set state.privateSync upfront.
    await expect(page.getByRole('heading', { name: 'Privater Sync', exact: true })).toBeVisible()

    // Auto-sync läuft 5s nach jeder Änderung – im fehlerfreien Status sollen
    // weder „Jetzt synchronisieren" noch „Erneut versuchen" angeboten werden.
    await expect(page.getByRole('button', { name: /Jetzt synchronisieren/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Erneut versuchen/ })).toHaveCount(0)

    // Status-Badge bleibt sichtbar, damit der Nutzer den Sync-Zustand erkennt.
    await expect(page.locator('.sync-badge')).toBeVisible()
  })
})

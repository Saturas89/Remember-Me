import { test, expect } from '@playwright/test'
import {
  completeOnboarding,
  createSyncMockState,
  dismissInstallPrompt,
  installPrivateSyncSupabaseMock,
  openSyncTab,
  seedActiveSync,
} from './helpers'

// E2E-04 – Sync deaktivieren via Confirmation-Dialog
// Ableitung: Master-Spec §13, AC-006-*.

test.describe('Privater Sync – Deaktivierung (E2E-04)', () => {
  test.beforeEach(async ({ context }) => {
    await dismissInstallPrompt(context)
    await installPrivateSyncSupabaseMock(context, createSyncMockState())
  })

  test('Confirmation-Dialog bietet drei Optionen, „Cloud löschen" deaktiviert Sync', async ({ page }) => {
    await seedActiveSync(page, 'supabase')
    await completeOnboarding(page, 'Dani')
    await openSyncTab(page)

    await expect(page.getByRole('heading', { name: 'Privater Sync', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Sync deaktivieren' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: /Ja, Cloud-Daten löschen/ })).toBeVisible()
    await expect(dialog.getByRole('button', { name: /Nein, nur lokal deaktivieren/ })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Abbrechen' })).toBeVisible()

    await dialog.getByRole('button', { name: /Ja, Cloud-Daten löschen/ }).click()

    // Hub disappears, Setup-View comes back ("Privater Sync" intro).
    await expect(page.getByRole('button', { name: 'Einrichten' })).toBeVisible()
  })
})

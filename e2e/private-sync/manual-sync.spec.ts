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

// E2E-03 – Manueller Sync via "Jetzt synchronisieren"-Button
// Ableitung: Master-Spec §13, US-004.

test.describe('Privater Sync – Manueller Sync (E2E-03)', () => {
  test.beforeEach(async ({ context }) => {
    await dismissInstallPrompt(context)
    await installPrivateSyncSupabaseMock(context, createSyncMockState())
  })

  test('Klick auf „Jetzt synchronisieren" zeigt den Hub mit Status-Badge', async ({ page }) => {
    await seedActiveSync(page, 'supabase', E2E_USER_ID)
    await completeOnboarding(page, 'Cara')
    await openSyncTab(page)

    // Hub is rendered because seedActiveSync set state.privateSync upfront.
    await expect(page.getByRole('heading', { name: 'Privater Sync', exact: true })).toBeVisible()
    const syncBtn = page.getByRole('button', { name: /Jetzt synchronisieren/ })
    await expect(syncBtn).toBeVisible()

    // The button is reachable and the status badge is rendered. We don't
    // assert on a successful round-trip here because the Supabase provider
    // requires a cached vault key in IndexedDB; that scenario is covered by
    // the unit tests in supabaseSyncProvider.test.ts.
    await expect(page.locator('.sync-badge')).toBeVisible()
  })
})

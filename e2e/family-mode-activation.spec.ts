import { test, expect } from '@playwright/test'
import {
  completeOnboarding,
  createMockState,
  dismissInstallPrompt,
  installSupabaseMock,
  openFamilyHub,
  openFamilyTab,
  readDeviceIdentity,
} from './helpers/family-mode-helpers'

// REQ-015 §4.1 Aktivierung (FR-15.1 – FR-15.3).
//
// Kein Consent-Screen, keine Pflicht-Checkbox mehr. Der Invite-Button auf dem
// Familie-Tab startet direkt den Sandra-Flow und aktiviert Online-Sharing.

test.describe('Familienmodus – Aktivierung (FR-15.1 – FR-15.3)', () => {
  test.beforeEach(async ({ context }) => {
    await dismissInstallPrompt(context)
    await installSupabaseMock(context, createMockState())
  })

  test('Familie-Tab öffnet direkt den Familienmodus-Intro-Screen ohne Checkbox', async ({ page }) => {
    await completeOnboarding(page, 'Anna')
    await openFamilyTab(page)
    await expect(page.getByRole('heading', { name: 'Familienmodus', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /Jemanden einladen/ })).toBeVisible()
    await expect(page.getByRole('checkbox')).not.toBeVisible()
  })

  test('Invite-Button aktiviert Online-Sharing und Hub zeigt Geräte-Identität', async ({ page }) => {
    await completeOnboarding(page, 'Anna')
    await openFamilyHub(page)

    await expect(page.getByRole('heading', { name: 'Familienmodus', exact: true })).toBeVisible()

    const identity = await readDeviceIdentity(page)
    expect(identity.deviceId).toMatch(/[0-9a-f-]{36}/)
    expect(identity.publicKey.length).toBeGreaterThan(20)
  })

  test('Intro-Screen ohne Einladen aktiviert nichts', async ({ page }) => {
    await completeOnboarding(page, 'Anna')
    await openFamilyTab(page)
    await expect(page.getByRole('heading', { name: 'Familienmodus', exact: true })).toBeVisible()

    const stored = await page.evaluate(() => {
      type Bridge = { get: () => Record<string, unknown> | null }
      const p = (window as unknown as { __rmState?: Bridge }).__rmState?.get()
      return p?.onlineSharing ?? null
    })
    expect(stored).toBeNull()
  })
})

import { test, expect } from '@playwright/test'
import {
  completeOnboarding,
  createMockState,
  dismissInstallPrompt,
  installSupabaseMock,
  openFamilyHub,
  openFriendsTab,
  readDeviceIdentity,
} from './helpers/family-mode-helpers'

// REQ-015 §4.1 Aktivierung & Consent (FR-15.1 – FR-15.3).
//
// Pure single-device flows: opening the entry point in "Freunde", reading
// the consent screen, ticking the mandatory checkbox, and confirming that
// activation persists a device identity.

test.describe('Familienmodus – Aktivierung & Consent (FR-15.1 – FR-15.3)', () => {
  test.beforeEach(async ({ context }) => {
    await dismissInstallPrompt(context)
    await installSupabaseMock(context, createMockState())
  })

  test('Freunde-Tab öffnet direkt den Familienmodus-Intro-Screen', async ({ page }) => {
    await completeOnboarding(page, 'Anna')
    await openFriendsTab(page)
    await expect(page.getByRole('heading', { name: 'Laufend verbunden bleiben', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Aktivieren', exact: true })).toBeVisible()
  })

  test('Consent-Screen erklärt Datenschutz und erzwingt die Pflicht-Checkbox', async ({ page }) => {
    await completeOnboarding(page, 'Anna')
    await openFriendsTab(page)
    // Freunde-Tab zeigt direkt den Consent-Screen – kein CTA-Klick nötig.

    await expect(page.getByRole('heading', { name: 'Laufend verbunden bleiben', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Datenschutz auf einen Blick/ })).toBeVisible()
    await expect(page.getByText(/nur die andere Person und ich das Geteilte lesen können/)).toBeVisible()

    const activate = page.getByRole('button', { name: 'Aktivieren', exact: true })
    await expect(activate).toBeDisabled()

    await page.getByRole('checkbox').check()
    await expect(activate).toBeEnabled()
  })

  test('Aktivieren legt Geräte-Identität an und zeigt den Hub', async ({ page }) => {
    await completeOnboarding(page, 'Anna')
    await openFamilyHub(page)

    await expect(page.getByRole('heading', { name: 'Online teilen', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Jemanden einladen' })).toBeVisible()
    // REQ-022: the canonical entry for new connections is now the Sandra-flow CTA.
    await expect(page.getByTestId('onboarding-open-sandra')).toBeEnabled()

    const identity = await readDeviceIdentity(page)
    expect(identity.deviceId).toMatch(/[0-9a-f-]{36}/)
    expect(identity.publicKey.length).toBeGreaterThan(20)
  })

  test('Cancel im Consent-Screen aktiviert nichts', async ({ page }) => {
    await completeOnboarding(page, 'Anna')
    await openFriendsTab(page)
    // Freunde-Tab zeigt direkt den Consent-Screen.
    await expect(page.getByRole('heading', { name: 'Laufend verbunden bleiben', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Zurück', exact: true }).click()
    // Zurück führt zu Home (kein eigener Friends-Screen mehr).
    await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible()

    const stored = await page.evaluate(() => {
      type Bridge = { get: () => Record<string, unknown> | null }
      const p = (window as unknown as { __rmState?: Bridge }).__rmState?.get()
      return p?.onlineSharing ?? null
    })
    expect(stored).toBeNull()
  })
})

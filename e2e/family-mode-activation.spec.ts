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

  test('Einstieg über Freunde-Bereich zeigt Familienmodus-CTA', async ({ page }) => {
    await completeOnboarding(page, 'Anna')
    await openFriendsTab(page)
    const cta = page.getByTestId('open-online-sharing')
    await expect(cta).toBeVisible()
    await expect(cta).toHaveText(/Einrichten/)
    await expect(page.getByText(/tauscht je einmal einen Verbindungslink aus/)).toBeVisible()
  })

  test('Consent-Screen erklärt Datenschutz und erzwingt die Pflicht-Checkbox', async ({ page }) => {
    await completeOnboarding(page, 'Anna')
    await openFriendsTab(page)
    await page.getByTestId('open-online-sharing').click()

    await expect(page.getByRole('heading', { name: 'Familienmodus', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Datenschutz auf einen Blick/ })).toBeVisible()
    await expect(page.getByText(/verschlüsselt gespeichert werden/)).toBeVisible()

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
    await expect(page.getByRole('button', { name: /Verbindungslink teilen/ })).toBeEnabled()

    const identity = await readDeviceIdentity(page)
    expect(identity.deviceId).toMatch(/[0-9a-f-]{36}/)
    expect(identity.publicKey.length).toBeGreaterThan(20)
  })

  test('Cancel im Consent-Screen aktiviert nichts', async ({ page }) => {
    await completeOnboarding(page, 'Anna')
    await openFriendsTab(page)
    await page.getByTestId('open-online-sharing').click()
    await expect(page.getByRole('heading', { name: 'Familienmodus', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Zurück', exact: true }).click()
    await expect(page.getByRole('heading', { name: /Erinnerung einsammeln/ })).toBeVisible()

    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('remember-me-state')
      if (!raw) return null
      try { return JSON.parse(raw).onlineSharing ?? null } catch { return null }
    })
    expect(stored).toBeNull()
  })
})

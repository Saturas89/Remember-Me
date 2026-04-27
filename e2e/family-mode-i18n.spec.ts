import { test, expect, type Page } from '@playwright/test'
import { Buffer } from 'node:buffer'

// E2E proof that the Familienmodus translations from REQ-015 actually reach
// the screen when the user switches the locale to English. The DE strings
// are exercised by family-mode-*.spec.ts; this file is the EN counterpart.
//
// Complements:
//   • i18n.spec.ts            – tests the switcher itself + auto-detection.
//   • family-mode-*.spec.ts   – tests the feature on the (pinned) DE locale.

async function bootEnglish(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('rm-install-dismissed', '1')
    localStorage.setItem('rm-lang', 'en')
  })
}

async function onboardEnglish(page: Page, name = 'Anna') {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await page.getByLabel("What's your name?").fill(name)
  await page.getByRole('button', { name: /Get started/i }).click()
  await expect(page.getByText(new RegExp(`Hello,\\s*${name}`))).toBeVisible()
}

async function openFriendsTab(page: Page) {
  await page.locator('.bottom-nav').getByRole('button', { name: /^Friends$/ }).click()
  await expect(page.getByRole('heading', { name: /Collect memories/ })).toBeVisible()
}

function contactPath(displayName: string, deviceId: string, publicKey: string): string {
  const handshake = JSON.stringify({
    $type: 'remember-me-contact',
    version: 1,
    deviceId,
    publicKey,
    displayName,
  })
  const b64 = Buffer.from(handshake, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `/?contact=${b64}`
}

test.describe('Familienmodus – englische Lokalisierung', () => {
  test.beforeEach(async ({ page }) => { await bootEnglish(page) })

  test('Friends-Tab zeigt englische Familienmodus-Section', async ({ page }) => {
    await onboardEnglish(page)
    await openFriendsTab(page)

    // Title + tags + setup CTA
    await expect(page.getByRole('heading', { name: 'Family mode' })).toBeVisible()
    await expect(page.getByText('Permanent', { exact: true })).toBeVisible()
    await expect(page.getByText('Two-way', { exact: true })).toBeVisible()
    await expect(page.getByText('Encrypted', { exact: true })).toBeVisible()
    await expect(page.getByTestId('open-online-sharing')).toHaveText(/Set up/)
  })

  test('Online-Sharing-Intro-Consent-Screen auf Englisch', async ({ page }) => {
    await onboardEnglish(page)
    await openFriendsTab(page)
    await page.getByTestId('open-online-sharing').click()

    await expect(page.getByRole('heading', { name: 'Family mode', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: /What is this\?/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Privacy at a glance/ })).toBeVisible()
    await expect(page.getByText(/I understand that my shared memories/)).toBeVisible()

    const activate = page.getByRole('button', { name: 'Activate', exact: true })
    await expect(activate).toBeDisabled()
    await page.getByRole('checkbox').check()
    await expect(activate).toBeEnabled()
  })

  test('ContactHandshake-View beim Empfänger auf Englisch', async ({ page }) => {
    await page.goto(
      contactPath('Grandma', '00000000-0000-4000-8000-000000000001', 'PUBLIC_KEY_PLACEHOLDER'),
    )

    await expect(page.getByRole('heading', { name: 'Link contact' })).toBeVisible()
    await expect(page.getByText(/Grandma/).first()).toBeVisible()
    await expect(page.getByText(/wants to connect with you/i)).toBeVisible()
    // Without prior opt-in, the screen offers activation as next step.
    await expect(page.getByRole('button', { name: /Set up online sharing/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Cancel/ })).toBeVisible()
  })
})

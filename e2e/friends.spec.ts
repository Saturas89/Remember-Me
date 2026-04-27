import { test, expect, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rm-install-dismissed', '1')
  })
})

async function completeOnboarding(page: Page, name: string) {
  await page.goto('/')
  await page.getByLabel('Wie heißt du?').fill(name)
  await page.getByRole('button', { name: /Loslegen/ }).click()
  await expect(page.getByText(new RegExp(`Hallo,\\s*${name}`))).toBeVisible()
}

async function openFriendsTab(page: Page) {
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  await nav.getByRole('button', { name: 'Freunde', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Erinnerung einsammeln/ })).toBeVisible()
}

test.describe('Remember Me – Freunde-Einladung', () => {
  test('shows share button and invitation explainer', async ({ page }) => {
    await completeOnboarding(page, 'Anna')
    await openFriendsTab(page)

    // The Friends view contains two `.share-cta-btn` instances when the build
    // has Supabase configured (the second is the Familienmodus opt-in CTA),
    // so we scope the lookup to the invite section by accessible text.
    const shareBtn = page.getByRole('button', { name: /Link teilen/ })
    await expect(shareBtn).toBeVisible()
    await expect(shareBtn).toBeEnabled()

    await expect(page.getByText(/Du teilst den Link/)).toBeVisible()
    await expect(page.getByText(/Ganz ohne App oder Account/)).toBeVisible()
  })

  test('does NOT show the personalisation warning once a profile name is set', async ({ page }) => {
    await completeOnboarding(page, 'Anna')
    await openFriendsTab(page)
    await expect(page.locator('.friends-hint--warn')).toHaveCount(0)
  })

  test('opens the ZIP import file picker from the friends section', async ({ page }) => {
    await completeOnboarding(page, 'Anna')
    await openFriendsTab(page)

    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: /Erinnerungen öffnen/ }).click()
    const chooser = await fileChooserPromise
    expect(chooser.isMultiple()).toBe(false)
  })
})

import { test, expect, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rm-install-dismissed', '1')
  })
})

async function completeOnboarding(page: Page, name = 'TestUser') {
  await page.goto('/')
  await page.getByLabel('Wie heißt du?').fill(name)
  await page.getByRole('button', { name: /Loslegen/ }).click()
  await expect(page.locator('.home-view')).toBeVisible()
}

async function openProfileTab(page: Page) {
  await page.locator('.bottom-nav').getByRole('button', { name: /Profil|Profile/i }).click()
  await expect(page.getByRole('heading', { name: /Fortschritt|Progress/ })).toBeVisible()
}

async function switchLanguage(page: Page, lang: 'de' | 'en') {
  const label = lang === 'en' ? /English/ : /Deutsch/
  await page.getByRole('button', { name: label }).click()
}

test.describe('i18n – Sprachauswahl / Language switching', () => {
  test('zeigt standardmäßig deutsche Texte', async ({ page }) => {
    await completeOnboarding(page)
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    // German nav label visible
    await expect(page.locator('.bottom-nav').getByRole('button', { name: 'Profil', exact: true })).toBeVisible()
  })

  test('wechselt zu Englisch über die Sprachauswahl im Profil', async ({ page }) => {
    await completeOnboarding(page)
    await openProfileTab(page)

    // Language section should be visible
    await expect(page.getByRole('heading', { name: 'Sprache' })).toBeVisible()

    // Switch to English
    await switchLanguage(page, 'en')

    // html lang attribute changes
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')

    // Profile heading now shows English
    await expect(page.getByRole('heading', { name: /Progress/ })).toBeVisible()
  })

  test('speichert die Sprachpräferenz und lädt sie beim Neuladen', async ({ page }) => {
    await completeOnboarding(page)
    await openProfileTab(page)
    await switchLanguage(page, 'en')

    // Verify English is active
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')

    // Reload the page
    await page.reload()

    // Language should still be English
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.locator('.home-view')).toBeVisible()
  })

  test('Hauptnavigation zeigt englische Labels nach Sprachwechsel', async ({ page }) => {
    await completeOnboarding(page)
    await openProfileTab(page)
    await switchLanguage(page, 'en')

    // Nav button for profile should now say "Profile" in English
    await expect(page.locator('.bottom-nav').getByRole('button', { name: 'Profile', exact: true })).toBeVisible()
  })

  test('wechselt zurück zu Deutsch', async ({ page }) => {
    await completeOnboarding(page)
    await openProfileTab(page)

    // Switch to English first
    await switchLanguage(page, 'en')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')

    // Switch back to German
    await switchLanguage(page, 'de')
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')

    await expect(page.getByRole('heading', { name: /Fortschritt/ })).toBeVisible()
  })

  test('Kategorien zeigen englische Titel nach Sprachwechsel', async ({ page }) => {
    await completeOnboarding(page)
    await openProfileTab(page)
    await switchLanguage(page, 'en')

    // Navigate to home
    await page.locator('.bottom-nav').getByRole('button', { name: /Journey/i }).click()
    await expect(page.locator('.categories-grid')).toBeVisible()

    // English category title should be visible
    await expect(page.getByText('Childhood & Youth')).toBeVisible()
  })
})

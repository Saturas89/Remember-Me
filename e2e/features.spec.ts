import { test, expect, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rm-install-dismissed', '1')
  })
})

async function completeOnboarding(page: Page, name = 'Features') {
  await page.goto('/')
  await page.getByLabel('Wie heißt du?').fill(name)
  await page.getByRole('button', { name: /Loslegen/ }).click()
  await expect(page.getByText(new RegExp(`Hallo,\\s*${name}`))).toBeVisible()
}

async function openFeaturesTab(page: Page) {
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  await nav.getByRole('button', { name: 'Features', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Was kommt als Nächstes/ })).toBeVisible()
}

test.describe('Remember Me – Features Tab', () => {
  test.beforeEach(async ({ page }) => {
    await completeOnboarding(page)
  })

  test('shows the five planned feature banners', async ({ page }) => {
    await openFeaturesTab(page)
    const banners = page.locator('.feature-img-btn')
    await expect(banners).toHaveCount(5)
    for (const title of [
      'Automatische Lebensgeschichte',
      'Lebenszeitlinie',
      'Privater Sync',
      'Familienmodus',
      'Import bestehender Erinnerungen',
    ]) {
      await expect(page.getByRole('button', { name: title })).toBeVisible()
    }
  })

  test('opens a feature detail page and returns to the list', async ({ page }) => {
    await openFeaturesTab(page)

    await page.getByRole('button', { name: 'Lebenszeitlinie' }).click()

    await expect(page.getByRole('heading', { name: 'Lebenszeitlinie' })).toBeVisible()
    await expect(page.getByText(/Noch nicht verfügbar/)).toBeVisible()
    await expect(page).toHaveURL(/\/feature\/lebenszeitlinie$/)

    await page.getByRole('button', { name: /Zurück/ }).click()

    await expect(page.locator('.feature-img-btn')).toHaveCount(5)
    await expect(page).toHaveURL(/\/feature(\/)?$/)
  })

  test('renders the detail page directly when the URL contains a feature id', async ({ page }) => {
    // Profile already seeded by test.beforeEach() onboarding above
    await page.goto('/feature/privater-sync')
    await expect(page.getByRole('heading', { name: 'Privater Sync' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Zurück/ })).toBeVisible()
  })

  test('falls back to the banner list for unknown feature slugs', async ({ page }) => {
    await page.goto('/feature/does-not-exist')
    await expect(page.locator('.feature-img-btn')).toHaveCount(5)
  })

  test('browser back navigation returns from detail to list', async ({ page }) => {
    await openFeaturesTab(page)
    await page.getByRole('button', { name: 'Familienmodus' }).click()
    await expect(page.getByRole('heading', { name: 'Familienmodus' })).toBeVisible()

    await page.goBack()
    await expect(page.locator('.feature-img-btn')).toHaveCount(5)
  })
})

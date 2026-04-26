import { test, expect, type Page } from '@playwright/test'

// ── Shared setup ────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rm-install-dismissed', '1')
  })
})

// ── Locale-aware helpers ────────────────────────────────

async function completeOnboarding(page: Page, locale: 'de' | 'en', name = 'Features') {
  await page.goto('/')
  const nameLabel = locale === 'de' ? 'Wie heißt du?' : "What's your name?"
  const startBtnRx = locale === 'de' ? /Loslegen/ : /Get started/
  const greetingRx = locale === 'de'
    ? new RegExp(`Hallo,\\s*${name}`)
    : new RegExp(`Hello,\\s*${name}`)
  await page.getByLabel(nameLabel).fill(name)
  await page.getByRole('button', { name: startBtnRx }).click()
  await expect(page.getByText(greetingRx)).toBeVisible()
}

async function openFeaturesTab(page: Page, locale: 'de' | 'en') {
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  await nav.getByRole('button', { name: 'Features', exact: true }).click()
  const headingRx = locale === 'de' ? /Was kommt als Nächstes/ : /What's coming next/
  await expect(page.getByRole('heading', { name: headingRx })).toBeVisible()
}

// ── German ──────────────────────────────────────────────

test.describe('Remember Me – Features Tab (de)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('rm-lang', 'de')
    })
    await completeOnboarding(page, 'de')
  })

  test('shows the four planned feature banners', async ({ page }) => {
    await openFeaturesTab(page, 'de')
    const banners = page.locator('.feature-img-btn')
    await expect(banners).toHaveCount(4)
    for (const title of [
      'Automatische Lebensgeschichte',
      'Lebenszeitlinie',
      'Privater Sync',
      'Import bestehender Erinnerungen',
    ]) {
      await expect(page.getByRole('button', { name: title })).toBeVisible()
    }
  })

  test('opens a feature detail page and returns to the list', async ({ page }) => {
    await openFeaturesTab(page, 'de')

    await page.getByRole('button', { name: 'Lebenszeitlinie' }).click()

    await expect(page.getByRole('heading', { name: 'Lebenszeitlinie' })).toBeVisible()
    await expect(page.getByText(/Noch nicht verfügbar/)).toBeVisible()
    await expect(page).toHaveURL(/\/feature\/lebenszeitlinie$/)

    await page.getByRole('button', { name: /Zurück/ }).click()

    await expect(page.locator('.feature-img-btn')).toHaveCount(4)
    await expect(page).toHaveURL(/\/feature(\/)?$/)
  })

  test('renders the detail page directly when the URL contains a feature id', async ({ page }) => {
    await page.goto('/feature/privater-sync')
    await expect(page.getByRole('heading', { name: 'Privater Sync' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Zurück/ })).toBeVisible()
  })

  test('falls back to the banner list for unknown feature slugs', async ({ page }) => {
    await page.goto('/feature/does-not-exist')
    await expect(page.locator('.feature-img-btn')).toHaveCount(4)
  })

  test('browser back navigation returns from detail to list', async ({ page }) => {
    await openFeaturesTab(page, 'de')
    await page.getByRole('button', { name: 'Privater Sync' }).click()
    await expect(page.getByRole('heading', { name: 'Privater Sync' })).toBeVisible()

    await page.goBack()
    await expect(page.locator('.feature-img-btn')).toHaveCount(4)
  })
})

// ── English ─────────────────────────────────────────────

test.describe('Remember Me – Features Tab (en)', () => {
  test.use({ locale: 'en-US', timezoneId: 'America/New_York' })

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('rm-lang', 'en')
    })
    await completeOnboarding(page, 'en')
  })

  test('shows the four planned feature banners in English', async ({ page }) => {
    await openFeaturesTab(page, 'en')
    const banners = page.locator('.feature-img-btn')
    await expect(banners).toHaveCount(4)
    for (const title of [
      'Automatic Life Story',
      'Life Timeline',
      'Private Sync',
      'Import existing memories',
    ]) {
      await expect(page.getByRole('button', { name: title })).toBeVisible()
    }
  })

  test('opens a feature detail page and returns to the list (en)', async ({ page }) => {
    await openFeaturesTab(page, 'en')

    await page.getByRole('button', { name: 'Life Timeline' }).click()

    await expect(page.getByRole('heading', { name: 'Life Timeline' })).toBeVisible()
    await expect(page.getByText(/Not yet available/)).toBeVisible()
    await expect(page).toHaveURL(/\/feature\/lebenszeitlinie$/)

    await page.getByRole('button', { name: /Back/ }).click()

    await expect(page.locator('.feature-img-btn')).toHaveCount(4)
    await expect(page).toHaveURL(/\/feature(\/)?$/)
  })

  test('renders the detail page directly when the URL contains a feature id (en)', async ({ page }) => {
    await page.goto('/feature/privater-sync')
    await expect(page.getByRole('heading', { name: 'Private Sync' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Back/ })).toBeVisible()
  })

  test('falls back to the banner list for unknown feature slugs (en)', async ({ page }) => {
    await page.goto('/feature/does-not-exist')
    await expect(page.locator('.feature-img-btn')).toHaveCount(4)
  })

  test('browser back navigation returns from detail to list (en)', async ({ page }) => {
    await openFeaturesTab(page, 'en')
    await page.getByRole('button', { name: 'Private Sync' }).click()
    await expect(page.getByRole('heading', { name: 'Private Sync' })).toBeVisible()

    await page.goBack()
    await expect(page.locator('.feature-img-btn')).toHaveCount(4)
  })
})

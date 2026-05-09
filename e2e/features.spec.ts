import { test, expect, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rm-install-dismissed', '1')
    // E2E: skip the new mode-choice step in onboarding
    localStorage.setItem('remember-me-state', JSON.stringify({
      profile: null, answers: {}, friends: [], friendAnswers: [],
      customQuestions: [], appMode: 'full',
    }))
  })
})

async function completeOnboarding(page: Page, name = 'Features') {
  await page.goto('/')
  await page.getByLabel('Wie heißt du?').fill(name)
  await page.getByRole('button', { name: /Loslegen/ }).click()
  await expect(page.getByText(new RegExp(`Hallo,\\s*${name}`))).toBeVisible()
}

async function openFeaturesSection(page: Page) {
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  await nav.getByRole('button', { name: 'Profil', exact: true }).click()
  // Open the <details> section for planned features
  const details = page.locator('.profile-features-details')
  await details.locator('summary').click()
  await expect(page.getByText('Was kommt als Nächstes')).toBeVisible()
}

test.describe('Remember Me – Geplante Features (Profil-Tab)', () => {
  test.beforeEach(async ({ page }) => {
    await completeOnboarding(page)
  })

  test('zeigt die vier geplanten Feature-Karten im Profil-Tab', async ({ page }) => {
    await openFeaturesSection(page)
    await expect(page.locator('.profile-feature-item')).toHaveCount(4)
    await expect(page.locator('.profile-feature-item__img')).toHaveCount(4)
  })

  test('Feature-Banner skalieren auf volle Breite des Containers', async ({ page }) => {
    await openFeaturesSection(page)
    const imgs = page.locator('.profile-feature-item__img')
    const count = await imgs.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      const imgBox = await imgs.nth(i).boundingBox()
      const containerBox = await page.locator('.profile-features-grid').boundingBox()
      expect(imgBox).not.toBeNull()
      expect(containerBox).not.toBeNull()
      expect(imgBox!.width).toBeGreaterThan(200)
      expect(imgBox!.width).toBeCloseTo(containerBox!.width, -1)
    }
  })

  test('Features-Sektion ist standardmäßig eingeklappt und öffnet sich per Klick', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
    await nav.getByRole('button', { name: 'Profil', exact: true }).click()

    const details = page.locator('.profile-features-details')
    await expect(details).toBeVisible()
    // Feature items are hidden until the <details> is opened
    await expect(page.locator('.profile-feature-item').first()).not.toBeVisible()

    await details.locator('summary').click()
    await expect(page.locator('.profile-feature-item').first()).toBeVisible()
  })
})

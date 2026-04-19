import { test, expect } from '@playwright/test'

// Each Playwright test already runs in a fresh browser context, so localStorage
// starts empty. No manual reset needed (an addInitScript here would also fire
// on reload and break the persistence test below).

test.describe('Remember Me – Onboarding & Home', () => {
  test('fresh visitor sees onboarding and can create a profile', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByText(/Deine Geschichte verdient es/)).toBeVisible()

    const nameInput = page.getByLabel('Wie heißt du?')
    await expect(nameInput).toBeVisible()

    const startButton = page.getByRole('button', { name: /Loslegen/ })
    await expect(startButton).toBeDisabled()

    await nameInput.fill('Alex')
    await expect(startButton).toBeEnabled()
    await startButton.click()

    await expect(page.getByText(/Hallo,\s*Alex/)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Kindheit & Jugend' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Eigene Erinnerung' })).toBeVisible()
  })

  test('all six built-in categories render on Home', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Wie heißt du?').fill('Testuser')
    await page.getByRole('button', { name: /Loslegen/ }).click()

    for (const title of [
      'Kindheit & Jugend',
      'Familie & Beziehungen',
      'Beruf & Leidenschaften',
      'Werte & Überzeugungen',
      'Erinnerungen & Erlebnisse',
      'Wünsche & Vermächtnis',
    ]) {
      await expect(page.getByRole('heading', { name: title })).toBeVisible()
    }
  })

  test('profile is persisted to localStorage across reloads', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Wie heißt du?').fill('Persistence')
    await page.getByRole('button', { name: /Loslegen/ }).click()
    await expect(page.getByText(/Hallo,\s*Persistence/)).toBeVisible()

    await page.reload()

    await expect(page.getByText(/Hallo,\s*Persistence/)).toBeVisible()
    await expect(page.getByLabel('Wie heißt du?')).toHaveCount(0)
  })
})

test.describe('Remember Me – Bottom navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Wie heißt du?').fill('Navigator')
    await page.getByRole('button', { name: /Loslegen/ }).click()
    await expect(page.getByText(/Hallo,\s*Navigator/)).toBeVisible()
  })

  // Scope nav queries to the <nav aria-label="Hauptnavigation"> so labels like
  // "Vermächtnis" don't collide with category-card buttons ("Wünsche & Vermächtnis").
  for (const label of ['Freunde', 'Vermächtnis', 'Features', 'Profil', 'Lebensweg']) {
    test(`bottom nav opens "${label}" tab`, async ({ page }) => {
      const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
      const tab = nav.getByRole('button', { name: label, exact: true })
      await tab.click()
      await expect(tab).toHaveAttribute('aria-current', 'page')
    })
  }
})

test.describe('Remember Me – Eigene Erinnerung (custom questions)', () => {
  test('user can add a custom question and see it listed', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Wie heißt du?').fill('Custom')
    await page.getByRole('button', { name: /Loslegen/ }).click()

    await page.getByRole('heading', { name: 'Eigene Erinnerung' }).click()

    const titleInput = page.getByPlaceholder('Titel der Erinnerung...')
    await expect(titleInput).toBeVisible()

    await titleInput.fill('Mein erster Schultag')
    await page.getByRole('button', { name: /Hinzufügen/ }).click()

    await expect(page.getByText('Mein erster Schultag')).toBeVisible()
    await expect(page.getByText(/Noch nichts eingetragen/)).toBeVisible()
  })
})

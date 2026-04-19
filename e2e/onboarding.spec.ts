import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
})

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

  for (const label of ['Freunde', 'Vermächtnis', 'Features', 'Profil', 'Lebensweg']) {
    test(`bottom nav opens "${label}" tab`, async ({ page }) => {
      await page.getByRole('button', { name: label }).click()
      // The tab we just clicked should be the active one
      const tabButton = page.getByRole('button', { name: label })
      await expect(tabButton).toHaveAttribute('aria-current', /page|true/)
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

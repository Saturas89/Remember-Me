import { test, expect, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rm-install-dismissed', '1')
  })
})

async function completeOnboarding(page: Page, name = 'Quizer') {
  await page.goto('/')
  await page.getByLabel('Wie heißt du?').fill(name)
  await page.getByRole('button', { name: /Loslegen/ }).click()
  await expect(page.getByText(new RegExp(`Hallo,\\s*${name}`))).toBeVisible()
}

test.describe('Remember Me – Answering a category', () => {
  test('entering an answer updates the overall progress headline', async ({ page }) => {
    await completeOnboarding(page)

    // Initially, no overall progress label is shown
    await expect(page.locator('.home-overall')).toHaveCount(0)

    await page.getByRole('heading', { name: 'Kindheit & Jugend' }).click()

    const textarea = page.locator('textarea.input-textarea').first()
    await expect(textarea).toBeVisible()
    await textarea.fill('Ich wuchs in einem kleinen Dorf auf.')

    // Return to the home screen
    await page.getByRole('button', { name: /Kategorien/ }).click()

    // Progress label should now be visible and non-zero
    const overall = page.locator('.home-overall')
    await expect(overall).toBeVisible()
    await expect(overall).toContainText(/%.*deiner Geschichte/)
  })

  test('text answers persist across reloads', async ({ page }) => {
    await completeOnboarding(page)

    await page.getByRole('heading', { name: 'Werte & Überzeugungen' }).click()
    const textarea = page.locator('textarea.input-textarea').first()
    await textarea.fill('Ehrlichkeit ist mir wichtig.')

    await page.getByRole('button', { name: /Kategorien/ }).click()
    await page.reload()

    await page.getByRole('heading', { name: 'Werte & Überzeugungen' }).click()
    await expect(page.locator('textarea.input-textarea').first()).toHaveValue('Ehrlichkeit ist mir wichtig.')
  })

  test('advances to the next question when tapping Weiter', async ({ page }) => {
    await completeOnboarding(page)

    await page.getByRole('heading', { name: 'Kindheit & Jugend' }).click()

    const meta = page.locator('.question-card__meta')
    await expect(meta).toContainText(/Frage 1 von/)

    await page.locator('textarea.input-textarea').first().fill('Antwort 1')
    await page.getByRole('button', { name: /Weiter/ }).click()

    await expect(meta).toContainText(/Frage 2 von/)
  })
})

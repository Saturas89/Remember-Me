import { test, expect, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rm-install-dismissed', '1')
  })
})

async function completeOnboarding(page: Page, name = 'Custom') {
  await page.goto('/')
  await page.getByLabel('Wie heißt du?').fill(name)
  await page.getByRole('button', { name: /Loslegen/ }).click()
  await expect(page.getByText(new RegExp(`Hallo,\\s*${name}`))).toBeVisible()
}

async function openCustomQuestions(page: Page) {
  await page.getByRole('heading', { name: 'Eigene Erinnerung' }).click()
  await expect(page.getByPlaceholder('Titel der Erinnerung...')).toBeVisible()
}

test.describe('Remember Me – Eigene Erinnerungen', () => {
  test('share section is hidden until at least one memory exists', async ({ page }) => {
    await completeOnboarding(page)
    await openCustomQuestions(page)

    await expect(page.locator('.share-cta-btn')).toHaveCount(0)

    await page.getByPlaceholder('Titel der Erinnerung...').fill('Mein Lieblingsort')
    await page.getByRole('button', { name: /Hinzufügen/ }).click()

    const shareBtn = page.locator('.share-cta-btn')
    await expect(shareBtn).toBeVisible()
    await expect(shareBtn).toContainText(/Erinnerungen teilen/)
  })

  test('entering and saving an answer shows it in the list', async ({ page }) => {
    await completeOnboarding(page)
    await openCustomQuestions(page)

    await page.getByPlaceholder('Titel der Erinnerung...').fill('Mein Lieblingsort')
    await page.getByRole('button', { name: /Hinzufügen/ }).click()

    await page.getByRole('button', { name: /Eintragen/ }).click()
    await page.locator('textarea.input-textarea').fill('Die Nordseeküste')
    await page.getByRole('button', { name: 'Speichern', exact: true }).click()

    await expect(page.locator('.custom-q-item__answer')).toContainText('Die Nordseeküste')
    await expect(page.locator('.custom-q-item__unanswered')).toHaveCount(0)
  })

  test('deleting a memory removes it from the list and hides the share section', async ({ page }) => {
    await completeOnboarding(page)
    await openCustomQuestions(page)

    await page.getByPlaceholder('Titel der Erinnerung...').fill('Temporäre Erinnerung')
    await page.getByRole('button', { name: /Hinzufügen/ }).click()
    await expect(page.locator('.custom-q-item')).toHaveCount(1)

    await page.getByRole('button', { name: 'Erinnerung löschen' }).click()

    await expect(page.locator('.custom-q-item')).toHaveCount(0)
    await expect(page.locator('.share-cta-btn')).toHaveCount(0)
  })

  test('rejects an invalid import code with an error message', async ({ page }) => {
    await completeOnboarding(page)
    await openCustomQuestions(page)

    await page.getByPlaceholder('Code hier einfügen...').fill('nicht-gültiger-code')
    await page.getByRole('button', { name: 'Importieren' }).click()

    await expect(page.locator('.import-msg--error')).toContainText(/Ungültiger Code/)
  })
})

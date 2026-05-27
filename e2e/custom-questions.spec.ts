import { test, expect, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rm-install-dismissed', '1')
    // E2E: only seed on first navigation – tests that build state via
    // __rmState.save between gotos must not be reset by a re-run init script.
    if (!localStorage.getItem('remember-me-state')) {
      localStorage.setItem('remember-me-state', JSON.stringify({
        profile: null, answers: {}, friends: [], friendAnswers: [],
        customQuestions: [], appMode: 'full',
      }))
    }
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

test.describe('Storyhold – Eigene Erinnerungen', () => {
  test('share button is never shown (share feature removed)', async ({ page }) => {
    await completeOnboarding(page)
    await openCustomQuestions(page)

    // No share button before adding a memory.
    await expect(page.locator('.share-cta-btn')).toHaveCount(0)

    await page.getByPlaceholder('Titel der Erinnerung...').fill('Mein Lieblingsort')
    await page.getByRole('button', { name: /Hinzufügen/ }).click()

    // No share button after adding a memory either – feature has been removed.
    await expect(page.locator('.share-cta-btn')).toHaveCount(0)
  })

  test('entering and saving an answer shows it in the list', async ({ page }) => {
    await completeOnboarding(page)
    await openCustomQuestions(page)

    await page.getByPlaceholder('Titel der Erinnerung...').fill('Mein Lieblingsort')
    await page.getByRole('button', { name: /Hinzufügen/ }).click()

    await page.getByRole('button', { name: /Eintragen/ }).click()
    await page.locator('.custom-q-item__answer-form textarea.input-textarea').fill('Die Nordseeküste')
    await page.getByRole('button', { name: 'Speichern', exact: true }).click()

    await expect(page.locator('.custom-q-item__answer')).toContainText('Die Nordseeküste')
    await expect(page.locator('.custom-q-item__unanswered')).toHaveCount(0)
  })

  test('deleting a memory removes it from the list', async ({ page }) => {
    await completeOnboarding(page)
    await openCustomQuestions(page)

    await page.getByPlaceholder('Titel der Erinnerung...').fill('Temporäre Erinnerung')
    await page.getByRole('button', { name: /Hinzufügen/ }).click()
    await expect(page.locator('.custom-q-item')).toHaveCount(1)

    await page.getByRole('button', { name: 'Erinnerung löschen' }).click()

    await expect(page.locator('.custom-q-item')).toHaveCount(0)
  })
})

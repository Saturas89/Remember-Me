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

async function completeOnboarding(page: Page, name: string) {
  await page.goto('/')
  await page.getByLabel('Wie heißt du?').fill(name)
  await page.getByRole('button', { name: /Loslegen/ }).click()
  await expect(page.getByText(new RegExp(`Hallo,\\s*${name}`))).toBeVisible()
}

async function openFriendsTab(page: Page) {
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  await nav.getByRole('button', { name: 'Freunde', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Einladen & verbinden/ })).toBeVisible()
}

test.describe('Storyhold – Freunde-Einladung', () => {
  test('shows invitation CTA and ZIP import button', async ({ page }) => {
    await completeOnboarding(page, 'Anna')
    await openFriendsTab(page)

    // Primary CTA in the invitation section is the Sandra-Flow entry.
    await expect(page.getByTestId('sandra-entry-cta')).toBeVisible()
    await expect(page.getByTestId('sandra-entry-cta')).toBeEnabled()

    // ZIP import is available for receiving offline memory packages.
    await expect(page.getByRole('button', { name: /Erinnerungen öffnen/ })).toBeVisible()
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

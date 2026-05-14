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
  await expect(page.getByRole('heading', { name: /Erinnerung einsammeln/ })).toBeVisible()
}

test.describe('Storyhold – Freunde-Einladung', () => {
  test('shows share button and invitation explainer', async ({ page }) => {
    await completeOnboarding(page, 'Anna')
    await openFriendsTab(page)

    // Primary CTA in the merged invitation section is the Sandra-Flow entry.
    await expect(page.getByTestId('sandra-entry-cta')).toBeVisible()

    // The Themenpack fallback is hidden behind a collapsible <details>;
    // expand it before asserting on the secondary share button and copy.
    await page.getByText('Lieber vorbereitete Fragen?').click()
    const shareBtn = page.getByRole('button', { name: /Themen-Link teilen/ })
    await expect(shareBtn).toBeVisible()
    await expect(shareBtn).toBeEnabled()

    await expect(page.getByText(/Du teilst den Link/)).toBeVisible()
    await expect(page.getByText(/Ganz ohne App oder Account/)).toBeVisible()
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

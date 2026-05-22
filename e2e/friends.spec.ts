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

async function openFamilyTab(page: Page) {
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  await nav.getByRole('button', { name: 'Familie', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Laufend verbunden bleiben', exact: true })).toBeVisible()
}

test.describe('Storyhold – Familie-Tab', () => {
  test('Familie-Tab zeigt direkt den Online-Sharing-Intro-Screen ohne Checkbox', async ({ page }) => {
    await completeOnboarding(page, 'Anna')
    await openFamilyTab(page)

    // Kein Checkbox mehr – Invite-Button direkt sichtbar.
    await expect(page.getByRole('button', { name: /Jemanden einladen/ })).toBeVisible()
    await expect(page.getByRole('checkbox')).not.toBeVisible()
  })
})

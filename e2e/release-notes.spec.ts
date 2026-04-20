import { test, expect, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rm-install-dismissed', '1')
  })
})

async function completeOnboarding(page: Page, name = 'ReleaseTest') {
  await page.goto('/')
  await page.getByLabel('Wie heißt du?').fill(name)
  await page.getByRole('button', { name: /Loslegen/ }).click()
  await expect(page.getByText(new RegExp(`Hallo,\\s*${name}`))).toBeVisible()
}

async function openProfileTab(page: Page) {
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  await nav.getByRole('button', { name: 'Profil', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Fortschritt' })).toBeVisible()
}

test.describe('Remember Me – Release Notes', () => {
  test.beforeEach(async ({ page }) => {
    await completeOnboarding(page)
  })

  test('profile tab shows the release notes button', async ({ page }) => {
    await openProfileTab(page)
    await expect(page.getByRole('button', { name: /Was ist neu/i })).toBeVisible()
  })

  test('clicking release notes button opens the modal', async ({ page }) => {
    await openProfileTab(page)
    await page.getByRole('button', { name: /Was ist neu/i }).click()
    await expect(page.locator('.release-notes-modal')).toBeVisible()
  })

  test('modal shows current version 1.6.0', async ({ page }) => {
    await openProfileTab(page)
    await page.getByRole('button', { name: /Was ist neu/i }).click()
    await expect(page.locator('.release-notes-modal')).toBeVisible()
    await expect(page.locator('.release-notes-entry--current')).toContainText('1.6.0')
  })

  test('modal closes via the close button', async ({ page }) => {
    await openProfileTab(page)
    await page.getByRole('button', { name: /Was ist neu/i }).click()
    await expect(page.locator('.release-notes-modal')).toBeVisible()
    await page.locator('.release-notes-modal__close').click()
    await expect(page.locator('.release-notes-modal')).not.toBeVisible()
  })
})

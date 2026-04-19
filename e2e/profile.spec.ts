import { test, expect, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rm-install-dismissed', '1')
  })
})

async function completeOnboarding(page: Page, name = 'Profil') {
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

test.describe('Remember Me – Profile', () => {
  test('renders the tree progress logo with an empty archive', async ({ page }) => {
    await completeOnboarding(page)
    await openProfileTab(page)

    const tree = page.locator('.tree-progress-logo')
    await expect(tree).toBeVisible()
    await expect(tree).toHaveAttribute('aria-label', /0%\s*Fortschritt/)

    const fill = page.locator('.tree-progress-logo__fill')
    await expect(fill).toHaveAttribute('style', /height:\s*0%/)
  })

  test('switches between the four theme cards and persists the choice', async ({ page }) => {
    await completeOnboarding(page)
    await openProfileTab(page)

    // Sepia is the default
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'sepia')

    await page.getByRole('button', { name: /Nacht/ }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'nacht')

    // Survive a reload
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'nacht')
  })

  test('shows the "not yet backed up" status on a fresh profile', async ({ page }) => {
    await completeOnboarding(page)
    await openProfileTab(page)

    const status = page.locator('.backup-status')
    await expect(status).toBeVisible()
    await expect(status).toHaveClass(/backup-status--none/)
    await expect(status).toContainText(/noch nicht gesichert/i)
  })

  test('exposes the Markdown and JSON export buttons', async ({ page }) => {
    await completeOnboarding(page)
    await openProfileTab(page)

    await expect(page.locator('.backup-btn', { hasText: 'Markdown' })).toBeVisible()
    await expect(page.locator('.backup-btn', { hasText: 'JSON' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Archiv oder Backup laden/ })).toBeVisible()
  })
})

import { test, expect, type Page } from '@playwright/test'

// Suppress the PWA install modal so the onboarding "Loslegen" button isn't
// covered by an aria-modal overlay on mobile-safari / mobile-chrome.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rm-install-dismissed', '1')
    // E2E: only seed on first navigation so legacy tests skip the new
    // mode-choice step. Tests that build up state via __rmState.save
    // between gotos must not be reset by a re-run init script. The
    // dedicated mode-choice spec block below clears the key explicitly.
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

test.describe('Storyhold – Onboarding & Home', () => {
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
    await completeOnboarding(page, 'Testuser')

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
    await completeOnboarding(page, 'Persistence')

    await page.reload()

    await expect(page.getByText(/Hallo,\s*Persistence/)).toBeVisible()
    await expect(page.getByLabel('Wie heißt du?')).toHaveCount(0)
  })
})

test.describe('Storyhold – Bottom navigation', () => {
  test.beforeEach(async ({ page }) => {
    await completeOnboarding(page, 'Navigator')
  })

  // Scope to the <nav aria-label="Hauptnavigation"> so labels like "Vermächtnis"
  // don't collide with the "Wünsche & Vermächtnis" category card.
  for (const label of ['Freunde', 'Vermächtnis', 'Sync', 'Profil', 'Lebensweg']) {
    test(`bottom nav opens "${label}" tab`, async ({ page }) => {
      const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
      const tab = nav.getByRole('button', { name: label, exact: true })
      await tab.click()
      await expect(tab).toHaveAttribute('aria-current', 'page')
    })
  }
})

test.describe('Storyhold – Simple Mode (mode-choice flow)', () => {
  // Override the parent pre-seed so the mode-choice step is actually shown
  // on the FIRST navigation – but preserve any state the test itself has
  // produced (mode pick, name, profile) on subsequent navigations like
  // page.reload(). Otherwise reloads would always drop the user back to
  // mode-choice, which is not what these specs assert.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('rm-install-dismissed', '1')
      const raw = localStorage.getItem('remember-me-state')
      if (!raw) return
      try {
        const parsed = JSON.parse(raw)
        const isPreSeed =
          parsed.profile === null &&
          parsed.appMode === 'full' &&
          (!parsed.answers || Object.keys(parsed.answers).length === 0)
        if (isPreSeed) localStorage.removeItem('remember-me-state')
      } catch {
        localStorage.removeItem('remember-me-state')
      }
    })
  })

  test('first-time visitor sees mode-choice before name entry', async ({ page }) => {
    await page.goto('/')

    // Mode-choice screen should be visible
    await expect(page.getByText(/Wie möchtest du die App nutzen\?/)).toBeVisible()
    await expect(page.getByTestId('onboarding-mode-simple')).toBeVisible()
    await expect(page.getByTestId('onboarding-mode-full')).toBeVisible()

    // Name input should NOT be visible yet
    await expect(page.getByLabel('Wie heißt du?')).toHaveCount(0)
  })

  test('picking "Vollständig" continues to the name step and shows all 5 tabs', async ({ page }) => {
    await page.goto('/')

    await page.getByTestId('onboarding-mode-full').click()

    // Now the name step should be visible
    await expect(page.getByLabel('Wie heißt du?')).toBeVisible()
    await page.getByLabel('Wie heißt du?').fill('Voll')
    await page.getByRole('button', { name: /Loslegen/ }).click()

    await expect(page.getByText(/Hallo,\s*Voll/)).toBeVisible()

    // All 5 main tabs visible in full mode
    const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
    for (const label of ['Lebensweg', 'Freunde', 'Vermächtnis', 'Sync', 'Profil']) {
      await expect(nav.getByRole('button', { name: label, exact: true })).toBeVisible()
    }
  })

  test('picking "Einfach" continues to name and reduces UI to 3 tabs + no custom card', async ({ page }) => {
    await page.goto('/')

    await page.getByTestId('onboarding-mode-simple').click()

    await expect(page.getByLabel('Wie heißt du?')).toBeVisible()
    await page.getByLabel('Wie heißt du?').fill('Oma')
    await page.getByRole('button', { name: /Loslegen/ }).click()

    await expect(page.getByText(/Hallo,\s*Oma/)).toBeVisible()

    // Only 3 tabs in simple mode
    const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
    await expect(nav.getByRole('button', { name: 'Lebensweg', exact: true })).toBeVisible()
    await expect(nav.getByRole('button', { name: 'Vermächtnis', exact: true })).toBeVisible()
    await expect(nav.getByRole('button', { name: 'Profil', exact: true })).toBeVisible()
    // Friends + Sync hidden
    await expect(nav.getByRole('button', { name: 'Freunde', exact: true })).toHaveCount(0)
    await expect(nav.getByRole('button', { name: 'Sync', exact: true })).toHaveCount(0)

    // Custom-questions card hidden
    await expect(page.getByRole('heading', { name: 'Eigene Erinnerung' })).toHaveCount(0)

    // Visual marker: data-app-mode set on <html>
    await expect(page.locator('html')).toHaveAttribute('data-app-mode', 'simple')
  })

  test('Simple Mode is switchable from profile and survives reload', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('onboarding-mode-simple').click()
    await page.getByLabel('Wie heißt du?').fill('Switcher')
    await page.getByRole('button', { name: /Loslegen/ }).click()

    // Confirm Simple Mode is actually active
    await expect(page.locator('html')).toHaveAttribute('data-app-mode', 'simple')

    // Open profile
    const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
    await nav.getByRole('button', { name: 'Profil', exact: true }).click()

    // Switch to "Vollständig"
    const fullCard = page.getByTestId('profile-mode-full')
    await expect(fullCard).toBeVisible()
    await fullCard.scrollIntoViewIfNeeded()
    await fullCard.click()

    // The button itself flips to aria-pressed=true – this confirms the state
    // mutation reached React. We then reload to verify the mode is persisted
    // and the BottomNav comes up with all 5 tabs from a fresh mount.
    await expect(fullCard).toHaveAttribute('aria-pressed', 'true')

    await page.reload()
    await expect(page.locator('html')).not.toHaveAttribute('data-app-mode', 'simple')
    await expect(nav.getByRole('button', { name: 'Freunde', exact: true })).toBeVisible()
  })
})

test.describe('Storyhold – Eigene Erinnerung (custom questions)', () => {
  test('user can add a custom question and see it listed', async ({ page }) => {
    await completeOnboarding(page, 'Custom')

    await page.getByRole('heading', { name: 'Eigene Erinnerung' }).click()

    const titleInput = page.getByPlaceholder('Titel der Erinnerung...')
    await expect(titleInput).toBeVisible()

    await titleInput.fill('Mein erster Schultag')
    await page.getByRole('button', { name: /Hinzufügen/ }).click()

    await expect(page.getByText('Mein erster Schultag')).toBeVisible()
    await expect(page.getByText(/Noch nichts eingetragen/)).toBeVisible()
  })
})

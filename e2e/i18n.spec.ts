import { test, expect, type Page } from '@playwright/test'

// ── shared helpers ────────────────────────────────────────────────────────────

/** Suppress install banner; optionally clear the stored language preference. */
function initScript(clearLang = false) {
  return () => {
    localStorage.setItem('rm-install-dismissed', '1')
    if (clearLang) localStorage.removeItem('rm-lang')
  }
}

async function completeOnboarding(page: Page, name = 'TestUser') {
  await page.goto('/')
  // Label is locale-dependent – match either language
  const label = page.getByLabel(/Wie heißt du\?|What's your name\?/i)
  await label.fill(name)
  await page.getByRole('button', { name: /Loslegen|Get started/i }).click()
  await expect(page.locator('.home-view')).toBeVisible()
}

async function openProfileTab(page: Page) {
  await page.locator('.bottom-nav').getByRole('button', { name: /Profil|Profile/i }).click()
  await expect(page.getByRole('heading', { name: /Fortschritt|Progress/i })).toBeVisible()
}

async function switchLanguage(page: Page, lang: 'de' | 'en') {
  await page.getByRole('button', { name: lang === 'en' ? /English/ : /Deutsch/ }).click()
}

// ─────────────────────────────────────────────────────────────────────────────
// Part 1 – Manual language switcher (de-DE browser, Berlin timezone)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Sprachauswahl – manueller Wechsel', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(initScript())
  })

  test('zeigt standardmäßig deutschen Text (de-DE + Berlin)', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    await expect(page.getByLabel('Wie heißt du?')).toBeVisible()
  })

  test('wechselt zu Englisch und setzt html[lang]', async ({ page }) => {
    await completeOnboarding(page)
    await openProfileTab(page)
    await expect(page.getByRole('heading', { name: 'Sprache' })).toBeVisible()
    await switchLanguage(page, 'en')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('heading', { name: /Progress/ })).toBeVisible()
  })

  test('Sprachpräferenz überlebt einen Reload', async ({ page }) => {
    await completeOnboarding(page)
    await openProfileTab(page)
    await switchLanguage(page, 'en')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.locator('.profile-view')).toBeVisible()
  })

  test('Nav-Labels wechseln nach Sprachwechsel auf Englisch', async ({ page }) => {
    await completeOnboarding(page)
    await openProfileTab(page)
    await switchLanguage(page, 'en')
    await expect(page.locator('.bottom-nav').getByRole('button', { name: 'Profile', exact: true })).toBeVisible()
  })

  test('wechselt zurück zu Deutsch', async ({ page }) => {
    await completeOnboarding(page)
    await openProfileTab(page)
    await switchLanguage(page, 'en')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await switchLanguage(page, 'de')
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    await expect(page.getByRole('heading', { name: /Fortschritt/ })).toBeVisible()
  })

  test('Kategorien zeigen englische Titel nach Sprachwechsel', async ({ page }) => {
    await completeOnboarding(page)
    await openProfileTab(page)
    await switchLanguage(page, 'en')
    await page.locator('.bottom-nav').getByRole('button', { name: /Journey/i }).click()
    await expect(page.locator('.categories-grid')).toBeVisible()
    await expect(page.getByText('Childhood & Youth')).toBeVisible()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Part 2 – Automatische Spracherkennung (kein rm-lang in localStorage)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Automatische Erkennung – de-DE Browser + Europe/Berlin', () => {
  test.use({ locale: 'de-DE', timezoneId: 'Europe/Berlin' })

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(initScript(true))
  })

  test('erkennt Deutsch', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    await expect(page.getByLabel('Wie heißt du?')).toBeVisible()
  })
})

test.describe('Automatische Erkennung – en-US Browser + America/New_York', () => {
  test.use({ locale: 'en-US', timezoneId: 'America/New_York' })

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(initScript(true))
  })

  test('erkennt Englisch', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByLabel("What's your name?")).toBeVisible()
  })
})

test.describe('Automatische Erkennung – fr-FR Browser + Europe/Vienna (Zeitzone gewinnt)', () => {
  test.use({ locale: 'fr-FR', timezoneId: 'Europe/Vienna' })

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(initScript(true))
  })

  test('erkennt Deutsch wegen Wiener Zeitzone trotz französischem Browser', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    await expect(page.getByLabel('Wie heißt du?')).toBeVisible()
  })
})

test.describe('Automatische Erkennung – fr-FR Browser + America/Chicago (Fallback)', () => {
  test.use({ locale: 'fr-FR', timezoneId: 'America/Chicago' })

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(initScript(true))
  })

  test('Fallback auf Englisch wenn weder Sprache noch Zeitzone passen', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByLabel("What's your name?")).toBeVisible()
  })
})

test.describe('localStorage schlägt Browser-Locale', () => {
  test.use({ locale: 'en-US', timezoneId: 'America/New_York' })

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('rm-install-dismissed', '1')
      localStorage.setItem('rm-lang', 'de') // gespeicherte Präferenz
    })
  })

  test('zeigt Deutsch obwohl Browser auf Englisch steht', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    await expect(page.getByLabel('Wie heißt du?')).toBeVisible()
  })
})

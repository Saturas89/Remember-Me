import { test, expect, type Page } from '@playwright/test'
import { UI_DE as de } from '../src/locales/de/ui'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rm-install-dismissed', '1')
  })
})

async function completeOnboarding(page: Page, name = 'Test User') {
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

test.describe('REQ-016 – Reminder housekeeping (FR-16.13)', () => {
  test('legacy rm-reminder-pref is removed on first useReminder mount', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem('rm-reminder-pref', 'enabled')
    })

    await completeOnboarding(page)
    await openProfileTab(page)

    const legacyValue = await page.evaluate(() =>
      localStorage.getItem('rm-reminder-pref'),
    )
    expect(legacyValue).toBeNull()
  })
})

test.describe('REQ-016 – Welcome-Back-Banner (FR-16.8)', () => {
  // Diese Tests setzen voraus, dass die Anzeige des Banners deterministisch
  // über localStorage-State gesteuert werden kann. Die genaue Trigger-Logik
  // (welcher Key, welche Schwelle) ist impl-seitig zu klären — Tests bleiben
  // bis dahin pending.
  test.fixme(
    'banner appears after simulated absence ≥3 days',
    async ({ page }) => {
      await page.addInitScript(() => {
        const fourDaysAgo = Date.now() - 4 * 24 * 60 * 60 * 1000
        const state = {
          streak: {
            current: 0,
            longest: 0,
            lastAnswerDate: new Date(fourDaysAgo).toISOString().split('T')[0],
          },
        }
        localStorage.setItem('remember-me-state', JSON.stringify(state))
      })

      await completeOnboarding(page)
      await expect(page.getByTestId('welcome-back-banner')).toBeVisible()
    },
  )

  test.fixme(
    'banner can be dismissed via aria-labelled button',
    async ({ page }) => {
      await completeOnboarding(page)
      // Setup banner-visible state, then dismiss
      const dismiss = page.getByRole('button', {
        name: de.reminder.welcomeBack.dismiss,
      })
      await dismiss.click()
      await expect(page.getByTestId('welcome-back-banner')).not.toBeVisible()
    },
  )

  test.fixme(
    'continue button navigates to next open question',
    async ({ page }) => {
      await completeOnboarding(page)
      const continueBtn = page.getByTestId('welcome-back-continue')
      await continueBtn.click()
      // Expect navigation away from home
      await expect(page).not.toHaveURL(/\/$/)
    },
  )
})

test.describe('REQ-016 – Milestone Notifications (FR-16.7)', () => {
  // Milestone-Logik triggert OS-Notifications, nicht UI-Toasts. Verifikation
  // braucht Service-Worker-Mock — hier als pending gekennzeichnet.
  test.fixme('triggers milestone after 10th answer', async () => {
    // Implementation pending — requires SW notification interception.
  })
})

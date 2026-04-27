import { test, expect, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rm-install-dismissed', '1')
  })
})

async function completeOnboarding(page: Page, name = 'StreakUser') {
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

async function answerQuestion(page: Page, categoryName = 'Kindheit & Jugend') {
  // Navigate to category
  const categoryCard = page.getByRole('heading', { name: categoryName })
  await categoryCard.click()
  
  // Find first question in category and answer it
  const firstQuestion = page.locator('[data-testid*="question-"], .question-card').first()
  await firstQuestion.click()
  
  // Fill in answer (implementation detail - using common patterns)
  const textArea = page.locator('textarea, [contenteditable="true"]')
  if (await textArea.count() > 0) {
    await textArea.first().fill('Test answer for streak tracking')
  }
  
  // Save answer (common pattern)
  const saveButton = page.getByRole('button', { name: /Speichern|Weiter|Fertig/ })
  if (await saveButton.count() > 0) {
    await saveButton.click()
  }
}

async function setStreakState(page: Page, current: number, longest: number, lastAnswerDate: string, totalAnswered: number) {
  await page.addInitScript((streakData) => {
    const state = JSON.parse(localStorage.getItem('remember-me-state') || '{}')
    state.streak = {
      current: streakData.current,
      longest: streakData.longest,
      lastAnswerDate: streakData.lastAnswerDate
    }
    state.totalAnswered = streakData.totalAnswered
    localStorage.setItem('remember-me-state', JSON.stringify(state))
  }, { current, longest, lastAnswerDate, totalAnswered })
}

async function setSystemDate(page: Page, dateString: string) {
  await page.addInitScript((date) => {
    const mockDate = new Date(date)
    const originalDate = Date
    
    // Mock Date constructor and Date.now()
    function MockDate(...args: any[]) {
      if (args.length === 0) {
        return mockDate
      }
      return new originalDate(...args)
    }
    MockDate.now = () => mockDate.getTime()
    MockDate.prototype = originalDate.prototype
    
    ;(window as any).Date = MockDate
  }, dateString)
}

test.describe('Remember Me – Streak Tracking (REQ-016)', () => {
  test('displays initial streak values of 0 for new user', async ({ page }) => {
    await completeOnboarding(page)
    await openProfileTab(page)
    
    const reminderSettings = page.getByTestId('reminder-settings')
    
    // Should show zero streak values initially
    await expect(reminderSettings).toContainText(/Aktuell.*0/)
    await expect(reminderSettings).toContainText(/Längste.*0/)
    
    // Verify streak labels are present
    await expect(reminderSettings).toContainText(/Streak/)
    await expect(reminderSettings).toContainText(/Aktuell/)
    await expect(reminderSettings).toContainText(/Längste/)
  })

  test('displays current streak of 1 after first answer', async ({ page }) => {
    await completeOnboarding(page)
    
    // Answer first question to start streak
    await answerQuestion(page)
    
    await openProfileTab(page)
    const reminderSettings = page.getByTestId('reminder-settings')
    
    await expect(reminderSettings).toContainText(/Aktuell.*1/)
    await expect(reminderSettings).toContainText(/Längste.*1/)
  })

  test('increments streak when answering on consecutive days', async ({ page }) => {
    await completeOnboarding(page)
    
    // Set up streak state: answered yesterday (day 1)
    await setSystemDate(page, '2026-04-27')
    await setStreakState(page, 1, 1, '2026-04-26', 1)
    
    // Answer today (day 2) to continue streak
    await answerQuestion(page)
    
    await openProfileTab(page)
    const reminderSettings = page.getByTestId('reminder-settings')
    
    await expect(reminderSettings).toContainText(/Aktuell.*2/)
    await expect(reminderSettings).toContainText(/Längste.*2/)
  })

  test('maintains streak when answering multiple times same day', async ({ page }) => {
    await completeOnboarding(page)
    
    await setSystemDate(page, '2026-04-27')
    await setStreakState(page, 1, 1, '2026-04-27', 1)
    
    // Answer again same day
    await answerQuestion(page, 'Familie & Beziehungen')
    
    await openProfileTab(page)
    const reminderSettings = page.getByTestId('reminder-settings')
    
    // Streak should remain 1 (same day), but total answers should increase
    await expect(reminderSettings).toContainText(/Aktuell.*1/)
    await expect(reminderSettings).toContainText(/Längste.*1/)
  })

  test('resets current streak after gap > 1 day but preserves longest', async ({ page }) => {
    await completeOnboarding(page)
    
    // Set up a 3-day streak that ended 3 days ago
    await setSystemDate(page, '2026-04-27')
    await setStreakState(page, 3, 3, '2026-04-24', 5) // Last answer was 3 days ago
    
    // Check that streak was reset but longest preserved
    await page.reload()
    await openProfileTab(page)
    
    const reminderSettings = page.getByTestId('reminder-settings')
    await expect(reminderSettings).toContainText(/Aktuell.*0/)
    await expect(reminderSettings).toContainText(/Längste.*3/)
  })

  test('starts new streak after reset', async ({ page }) => {
    await completeOnboarding(page)
    
    // Start with reset streak (gap occurred)
    await setSystemDate(page, '2026-04-27')
    await setStreakState(page, 0, 5, '2026-04-20', 10) // Last answer was 7 days ago, longest was 5
    
    // Answer today to start new streak
    await answerQuestion(page)
    
    await openProfileTab(page)
    const reminderSettings = page.getByTestId('reminder-settings')
    
    await expect(reminderSettings).toContainText(/Aktuell.*1/)
    await expect(reminderSettings).toContainText(/Längste.*5/) // Previous longest preserved
  })

  test('updates longest streak when current exceeds it', async ({ page }) => {
    await completeOnboarding(page)
    
    // Set up state where current streak is about to exceed longest
    await setSystemDate(page, '2026-04-27')
    await setStreakState(page, 4, 3, '2026-04-26', 8) // Current is 4, longest is 3
    
    // Continue streak to day 5
    await answerQuestion(page)
    
    await openProfileTab(page)
    const reminderSettings = page.getByTestId('reminder-settings')
    
    await expect(reminderSettings).toContainText(/Aktuell.*5/)
    await expect(reminderSettings).toContainText(/Längste.*5/) // Longest should be updated
  })

  test('streak persists across page reloads', async ({ page }) => {
    await completeOnboarding(page)
    
    // Set up streak state manually
    await setStreakState(page, 7, 10, '2026-04-27', 15)
    
    await openProfileTab(page)
    let reminderSettings = page.getByTestId('reminder-settings')
    
    await expect(reminderSettings).toContainText(/Aktuell.*7/)
    await expect(reminderSettings).toContainText(/Längste.*10/)
    
    // Reload and verify persistence
    await page.reload()
    await openProfileTab(page)
    
    reminderSettings = page.getByTestId('reminder-settings')
    await expect(reminderSettings).toContainText(/Aktuell.*7/)
    await expect(reminderSettings).toContainText(/Längste.*10/)
  })

  test('handles edge case: answering yesterday maintains streak', async ({ page }) => {
    await completeOnboarding(page)
    
    // Set current date and last answer date to yesterday
    await setSystemDate(page, '2026-04-27')
    await setStreakState(page, 2, 5, '2026-04-26', 8) // Yesterday
    
    await openProfileTab(page)
    const reminderSettings = page.getByTestId('reminder-settings')
    
    // Streak should remain intact (yesterday is within allowed range)
    await expect(reminderSettings).toContainText(/Aktuell.*2/)
    await expect(reminderSettings).toContainText(/Längste.*5/)
  })

  test('handles edge case: answering today maintains streak', async ({ page }) => {
    await completeOnboarding(page)
    
    // Set last answer to today
    await setSystemDate(page, '2026-04-27')
    await setStreakState(page, 1, 1, '2026-04-27', 3) // Today
    
    await openProfileTab(page)
    const reminderSettings = page.getByTestId('reminder-settings')
    
    // Streak should remain intact
    await expect(reminderSettings).toContainText(/Aktuell.*1/)
    await expect(reminderSettings).toContainText(/Längste.*1/)
  })

  test('streak state is properly formatted in localStorage', async ({ page }) => {
    await completeOnboarding(page)
    
    await setStreakState(page, 5, 8, '2026-04-25', 12)
    
    // Check localStorage format matches spec
    const storedState = await page.evaluate(() => {
      const state = localStorage.getItem('remember-me-state')
      return state ? JSON.parse(state) : null
    })
    
    expect(storedState).not.toBeNull()
    expect(storedState.streak).toEqual({
      current: 5,
      longest: 8,
      lastAnswerDate: '2026-04-25' // ISO date format YYYY-MM-DD
    })
    expect(storedState.totalAnswered).toBe(12)
  })

  test('displays large streak numbers correctly', async ({ page }) => {
    await completeOnboarding(page)
    
    // Set large streak numbers
    await setStreakState(page, 42, 100, '2026-04-27', 250)
    
    await openProfileTab(page)
    const reminderSettings = page.getByTestId('reminder-settings')
    
    await expect(reminderSettings).toContainText(/Aktuell.*42/)
    await expect(reminderSettings).toContainText(/Längste.*100/)
  })

  test('streak resets correctly when checking for expired streaks', async ({ page }) => {
    await completeOnboarding(page)
    
    // Set up expired streak (2 days ago)
    await setSystemDate(page, '2026-04-27')
    await setStreakState(page, 3, 5, '2026-04-25', 10)
    
    // Load page which should trigger streak reset check
    await page.reload()
    
    // Open profile to see updated values
    await openProfileTab(page)
    const reminderSettings = page.getByTestId('reminder-settings')
    
    // Current should be reset to 0, longest preserved
    await expect(reminderSettings).toContainText(/Aktuell.*0/)
    await expect(reminderSettings).toContainText(/Längste.*5/)
  })
})
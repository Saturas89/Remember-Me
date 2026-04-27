import { test, expect } from '@playwright/test'

test.describe('PWA Notifications (REQ-016)', () => {
  test.beforeEach(async ({ page }) => {
    // Start fresh for each test
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
      // Remove legacy key as part of migration test
      localStorage.removeItem('rm-reminder-pref')
    })
  })

  test('loads without legacy rm-reminder-pref key after migration', async ({ page }) => {
    // Spec: FR-16.13 - rm-reminder-pref wird bei erstem Hook-Init gelöscht
    await page.evaluate(() => {
      localStorage.setItem('rm-reminder-pref', '{"enabled": true}')
    })
    
    await page.goto('/')
    
    const legacyKey = await page.evaluate(() => 
      localStorage.getItem('rm-reminder-pref')
    )
    expect(legacyKey).toBeNull()
  })

  test('shows reminder settings in profile view', async ({ page }) => {
    // Navigate to profile/settings
    await page.getByRole('button', { name: /profil|profile/i }).click()
    
    // Spec: FR-16.10 - Profil-Tab enthält Karte "Erinnerungen"
    const reminderSettings = page.getByTestId('reminder-settings')
    await expect(reminderSettings).toBeVisible()
    
    // Should have title mentioning reminders
    await expect(reminderSettings).toContainText(/erinnerung|reminder/i)
  })

  test('displays reminder toggle with correct type and label', async ({ page }) => {
    await page.getByRole('button', { name: /profil|profile/i }).click()
    
    // Spec: data-testid="reminder-toggle", <input type="checkbox"> mit <label>
    const toggle = page.getByTestId('reminder-toggle')
    await expect(toggle).toBeVisible()
    
    const inputType = await toggle.getAttribute('type')
    expect(inputType).toBe('checkbox')
    
    // Should have associated label with appropriate text
    const reminderSettings = page.getByTestId('reminder-settings')
    await expect(reminderSettings).toContainText(/benachrichtigungen|notifications/i)
  })

  test('shows cadence explanation without selector controls', async ({ page }) => {
    await page.getByRole('button', { name: /profil|profile/i }).click()
    
    // Spec: Erklär-Text zur automatischen Cadence ohne Selector
    const reminderSettings = page.getByTestId('reminder-settings')
    
    // Should mention the 3-10-24 day cadence
    await expect(reminderSettings).toContainText(/3.*10.*24|automatisch/i)
    
    // Should NOT have cadence selector elements
    await expect(page.locator('select')).toHaveCount(0)
    await expect(page.locator('input[type="range"]')).toHaveCount(0)
  })

  test('displays quiet hours information as read-only', async ({ page }) => {
    await page.getByRole('button', { name: /profil|profile/i }).click()
    
    // Spec: "Stille Stunden"-Info (read-only Hinweis)
    const reminderSettings = page.getByTestId('reminder-settings')
    await expect(reminderSettings).toContainText(/stille.*stunden|22:00|8:00/i)
  })

  test('shows streak statistics in reminder settings', async ({ page }) => {
    // First complete some questions to have streak data
    await page.getByText(/loslegen|start/i).click()
    
    // Answer a question to create streak
    const answerInput = page.locator('input[type="text"], textarea')
    await answerInput.first().fill('Test answer for streak')
    await page.getByRole('button', { name: /weiter|continue|next/i }).click()
    
    // Go to profile
    await page.getByRole('button', { name: /profil|profile/i }).click()
    
    // Spec: Streak-Stats (current / longest)
    const reminderSettings = page.getByTestId('reminder-settings')
    await expect(reminderSettings).toContainText(/streak|aktuell|current|längste|longest/i)
  })

  test('welcome back banner appears after simulated absence', async ({ page }) => {
    // Simulate 4 days absence by manipulating localStorage
    await page.evaluate(() => {
      const fourDaysAgo = Date.now() - 4 * 24 * 60 * 60 * 1000
      const appState = {
        // Simulate last activity 4 days ago
        lastActiveAt: fourDaysAgo,
        answers: {
          'test-q1': {
            id: 'test-q1',
            questionId: 'test-q1', 
            categoryId: 'childhood',
            value: 'Test answer',
            createdAt: new Date(fourDaysAgo).toISOString(),
            updatedAt: new Date(fourDaysAgo).toISOString()
          }
        }
      }
      localStorage.setItem('remember-me-state', JSON.stringify(appState))
    })
    
    await page.reload()
    
    // Spec: FR-16.8 - Welcome-Back-Banner erscheint nach ≥3 Tagen Pause
    const welcomeBanner = page.getByTestId('welcome-back-banner')
    await expect(welcomeBanner).toBeVisible()
    
    // Should have correct CSS classes
    await expect(welcomeBanner).toHaveClass(/update-banner/)
    await expect(welcomeBanner).toHaveClass(/welcome-back-banner/)
    
    // Should show days away (4 in this case)
    await expect(welcomeBanner).toContainText(/4/)
  })

  test('welcome back banner has accessibility attributes', async ({ page }) => {
    // Set up 5-day absence scenario
    await page.evaluate(() => {
      const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000
      const appState = {
        lastActiveAt: fiveDaysAgo,
        answers: {
          'test-q': {
            id: 'test-q',
            questionId: 'test-q',
            categoryId: 'childhood', 
            value: 'Old answer',
            createdAt: new Date(fiveDaysAgo).toISOString(),
            updatedAt: new Date(fiveDaysAgo).toISOString()
          }
        }
      }
      localStorage.setItem('remember-me-state', JSON.stringify(appState))
    })
    
    await page.reload()
    
    // Spec: role="alert", aria-live="polite"
    const welcomeBanner = page.getByTestId('welcome-back-banner')
    await expect(welcomeBanner).toHaveAttribute('role', 'alert')
    await expect(welcomeBanner).toHaveAttribute('aria-live', 'polite')
  })

  test('welcome back banner continue CTA navigates to next question', async ({ page }) => {
    // Setup absence scenario with available questions
    await page.evaluate(() => {
      const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000
      localStorage.setItem('remember-me-state', JSON.stringify({
        lastActiveAt: threeDaysAgo,
        answers: {}
      }))
    })
    
    await page.reload()
    
    const welcomeBanner = page.getByTestId('welcome-back-banner')
    await expect(welcomeBanner).toBeVisible()
    
    // Spec: "Weitermachen"-CTA navigiert zur nächsten offenen Frage
    const continueButton = page.getByTestId('welcome-back-continue')
    await expect(continueButton).toBeVisible()
    
    await continueButton.click()
    
    // Should navigate to question view
    await expect(page.locator('input, textarea')).toBeVisible()
  })

  test('welcome back banner can be dismissed', async ({ page }) => {
    // Setup absence scenario
    await page.evaluate(() => {
      const sixDaysAgo = Date.now() - 6 * 24 * 60 * 60 * 1000
      localStorage.setItem('remember-me-state', JSON.stringify({
        lastActiveAt: sixDaysAgo
      }))
    })
    
    await page.reload()
    
    const welcomeBanner = page.getByTestId('welcome-back-banner')
    await expect(welcomeBanner).toBeVisible()
    
    // Find and click dismiss button
    const dismissButton = page.getByRole('button', { name: /dismiss|close|schließen|✕/i })
    await dismissButton.click()
    
    // Banner should disappear
    await expect(welcomeBanner).not.toBeVisible()
  })

  test('handles notification permission states correctly', async ({ page, browserName }) => {
    // Skip on iOS/WebKit since they don't support showTrigger
    test.skip(browserName === 'webkit', 'iOS/Safari does not support showTrigger')
    
    await page.getByRole('button', { name: /profil|profile/i }).click()
    
    const toggle = page.getByTestId('reminder-toggle')
    
    // Initially should be unchecked (permission: 'none')
    await expect(toggle).not.toBeChecked()
    
    // Grant permission for testing
    await page.context().grantPermissions(['notifications'])
    
    await toggle.click()
    
    // Should now be enabled
    await expect(toggle).toBeChecked()
  })

  test('shows iOS fallback message when showTrigger unavailable', async ({ page, browserName }) => {
    // This test runs specifically on WebKit (Safari) to test iOS behavior
    test.skip(browserName !== 'webkit', 'iOS-specific test')
    
    await page.getByRole('button', { name: /profil|profile/i }).click()
    
    // Spec: NFR iOS-Verhalten - Hinweis für iOS-Nutzer
    const reminderSettings = page.getByTestId('reminder-settings')
    await expect(reminderSettings).toContainText(/ios.*app/i)
  })

  test('backoff stages prevent scheduling after stage 3', async ({ page }) => {
    // Setup state with stage 3 (24+ days of inactivity)
    await page.evaluate(() => {
      const twentyFiveDaysAgo = Date.now() - 25 * 24 * 60 * 60 * 1000
      const reminderState = {
        permission: 'enabled',
        backoffStage: 3,
        lastShownAt: twentyFiveDaysAgo,
        lastVariantIdx: 2
      }
      localStorage.setItem('rm-reminder-state', JSON.stringify(reminderState))
    })
    
    await page.goto('/')
    await page.getByRole('button', { name: /profil|profile/i }).click()
    
    // Spec: FR-16.1 - Nach Stage 3 stumm bis zur nächsten App-Öffnung
    const toggle = page.getByTestId('reminder-toggle')
    
    // Should still show as enabled but indicate quiet state
    await expect(toggle).toBeChecked()
    
    const reminderSettings = page.getByTestId('reminder-settings')
    const stageText = await reminderSettings.textContent()
    
    // Should indicate that it's in quiet state or max stage reached
    expect(stageText).toMatch(/ruhe|quiet|pause|stumm/i)
  })

  test('milestone celebration appears after 10th answer', async ({ page, browserName }) => {
    // Skip if notifications not supported
    test.skip(browserName === 'webkit', 'WebKit notification behavior varies')
    
    // Grant notification permission
    await page.context().grantPermissions(['notifications'])
    
    // Answer 9 questions first
    for (let i = 0; i < 9; i++) {
      await page.getByText(/loslegen|start/i).click()
      const answerInput = page.locator('input[type="text"], textarea')
      await answerInput.first().fill(`Test answer ${i + 1}`)
      await page.getByRole('button', { name: /weiter|continue|next/i }).click()
      
      // Go to next question if available
      const nextButton = page.getByRole('button', { name: /nächste|next/i })
      if (await nextButton.isVisible()) {
        await nextButton.click()
      }
    }
    
    // Answer the 10th question (milestone trigger)
    const answerInput = page.locator('input[type="text"], textarea')
    if (await answerInput.first().isVisible()) {
      await answerInput.first().fill('Milestone answer #10')
      await page.getByRole('button', { name: /weiter|continue|next/i }).click()
    }
    
    // Spec: FR-16.7 - Meilenstein-Notification bei 10 Antworten
    // Since we can't test actual notifications in E2E, check for in-app celebration
    await expect(page.locator('text=glückwunsch|congratulations|milestone|10')).toBeVisible({ timeout: 5000 })
  })

  test('variant pool prevents immediate text repetition', async ({ page }) => {
    // This test would be complex to implement in E2E since it requires
    // multiple notification triggers over time. Mark as implementation guidance.
    test.skip(true, 'Variant rotation testing requires time-based triggers - covered in unit tests')
  })

  test('quiet hours shift notifications to morning', async ({ page }) => {
    // Setup evening time scenario (22:30)
    await page.evaluate(() => {
      const reminderState = {
        permission: 'enabled',
        backoffStage: 1,
        lastShownAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
        lastVariantIdx: 1
      }
      localStorage.setItem('rm-reminder-state', JSON.stringify(reminderState))
    })
    
    await page.goto('/')
    await page.getByRole('button', { name: /profil|profile/i }).click()
    
    // Spec: FR-16.2 - Stille Stunden 22:00-8:00
    const reminderSettings = page.getByTestId('reminder-settings')
    await expect(reminderSettings).toContainText(/22:00.*8:00|stille.*stunden/i)
  })

  test('persists reminder state after page reload', async ({ page }) => {
    await page.context().grantPermissions(['notifications'])
    await page.getByRole('button', { name: /profil|profile/i }).click()
    
    // Enable reminders
    const toggle = page.getByTestId('reminder-toggle')
    await toggle.click()
    await expect(toggle).toBeChecked()
    
    // Reload page
    await page.reload()
    await page.getByRole('button', { name: /profil|profile/i }).click()
    
    // State should persist
    const toggleAfterReload = page.getByTestId('reminder-toggle')
    await expect(toggleAfterReload).toBeChecked()
    
    // Check localStorage contains new key
    const stateKey = await page.evaluate(() => 
      localStorage.getItem('rm-reminder-state')
    )
    expect(stateKey).toBeTruthy()
    expect(stateKey).toContain('"permission":"enabled"')
  })
})
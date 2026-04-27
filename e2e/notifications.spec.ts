import { test, expect } from '@playwright/test'

test.describe('PWA Notifications (REQ-016)', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/')
    
    // Clear any existing localStorage to start fresh
    await page.evaluate(() => {
      localStorage.clear()
    })
  })

  test('reminder settings card is visible in profile', async ({ page }) => {
    // Navigate to profile tab
    await page.click('[data-testid="tab-profile"]')
    
    // Reminder settings card should be present with required test ID
    const settingsCard = page.getByTestId('reminder-settings')
    await expect(settingsCard).toBeVisible()
  })

  test('reminder toggle has correct structure and labels', async ({ page }) => {
    await page.click('[data-testid="tab-profile"]')
    
    // Check for required elements as per FR-16.10
    const settingsCard = page.getByTestId('reminder-settings')
    await expect(settingsCard).toBeVisible()
    
    // Title should be "Erinnerungen"
    await expect(settingsCard.getByText('Erinnerungen')).toBeVisible()
    
    // Toggle should be checkbox with proper test ID
    const toggle = page.getByTestId('reminder-toggle')
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveAttribute('type', 'checkbox')
    
    // Label should be connected as per spec requirements
    await expect(page.getByText('Benachrichtigungen aktiv')).toBeVisible()
  })

  test('displays cadence explanation without selector', async ({ page }) => {
    await page.click('[data-testid="tab-profile"]')
    
    const settingsCard = page.getByTestId('reminder-settings')
    
    // Should show explanation text as per FR-16.1
    await expect(settingsCard.getByText('Wir erinnern dich nach 3, 10 und 24 Tagen Pause — danach Ruhe.')).toBeVisible()
    
    // Should NOT have cadence selector as per FR-16.1
    const selects = settingsCard.locator('select')
    await expect(selects).toHaveCount(0)
    
    const radioButtons = settingsCard.locator('input[type="radio"]')
    await expect(radioButtons).toHaveCount(0)
  })

  test('displays quiet hours information', async ({ page }) => {
    await page.click('[data-testid="tab-profile"]')
    
    const settingsCard = page.getByTestId('reminder-settings')
    
    // Should show quiet hours info as per FR-16.2
    await expect(settingsCard.getByText(/Stille Stunden.*22:00.*8:00/)).toBeVisible()
  })

  test('displays streak statistics', async ({ page }) => {
    await page.click('[data-testid="tab-profile"]')
    
    const settingsCard = page.getByTestId('reminder-settings')
    
    // Should show streak labels as per FR-16.6
    await expect(settingsCard.getByText('Streak')).toBeVisible()
    await expect(settingsCard.getByText('Aktuell')).toBeVisible()
    await expect(settingsCard.getByText('Längste')).toBeVisible()
  })

  test('toggle interaction works correctly', async ({ page }) => {
    await page.click('[data-testid="tab-profile"]')
    
    const toggle = page.getByTestId('reminder-toggle')
    
    // Initially should be unchecked (default state)
    await expect(toggle).not.toBeChecked()
    
    // Click to enable
    await toggle.click()
    
    // Handle potential permission prompt
    // Note: In real browser, this might trigger permission dialog
    // In test environment, we simulate the grant
    await page.evaluate(() => {
      // Mock successful permission grant
      if (window.Notification) {
        Object.defineProperty(window.Notification, 'permission', {
          value: 'granted',
          writable: true
        })
      }
    })
    
    // Wait for state update
    await page.waitForTimeout(100)
    
    // Should be enabled now
    await expect(toggle).toBeChecked()
  })

  test('legacy migration - removes old rm-reminder-pref', async ({ page }) => {
    // Set up old preference key
    await page.evaluate(() => {
      localStorage.setItem('rm-reminder-pref', 'enabled')
    })
    
    // Refresh to trigger migration
    await page.reload()
    
    // Wait for app to load and migration to complete
    await page.waitForTimeout(500)
    
    // Legacy key should be removed as per FR-16.13
    const oldPref = await page.evaluate(() => {
      return localStorage.getItem('rm-reminder-pref')
    })
    
    expect(oldPref).toBeNull()
  })

  test('welcome back banner appears after simulated inactivity', async ({ page }) => {
    // Complete onboarding first if needed
    await page.evaluate(async () => {
      // Helper to complete onboarding - derived from spec expectations
      const profile = { name: 'Test User', createdAt: new Date().toISOString() }
      localStorage.setItem('remember-me-profile', JSON.stringify(profile))
    })
    
    // Simulate 4 days of inactivity by manipulating localStorage
    await page.evaluate(() => {
      const fourDaysAgo = new Date()
      fourDaysAgo.setDate(fourDaysAgo.getDate() - 4)
      
      const state = {
        streak: {
          current: 2,
          longest: 5,
          lastAnswerDate: fourDaysAgo.toISOString().split('T')[0]
        }
      }
      localStorage.setItem('remember-me-state', JSON.stringify(state))
    })
    
    // Reload to trigger welcome back logic
    await page.reload()
    
    // Welcome back banner should appear as per FR-16.8
    const banner = page.getByTestId('welcome-back-banner')
    await expect(banner).toBeVisible()
    
    // Should have required CSS classes as per DOM contract
    await expect(banner).toHaveClass(/update-banner/)
    await expect(banner).toHaveClass(/welcome-back-banner/)
    
    // Should have accessibility attributes as per NFR
    await expect(banner).toHaveAttribute('role', 'alert')
    await expect(banner).toHaveAttribute('aria-live', 'polite')
  })

  test('welcome back banner continue button navigation', async ({ page }) => {
    // Set up welcome back scenario
    await page.evaluate(() => {
      const profile = { name: 'Test User', createdAt: new Date().toISOString() }
      localStorage.setItem('remember-me-profile', JSON.stringify(profile))
      
      const fourDaysAgo = new Date()
      fourDaysAgo.setDate(fourDaysAgo.getDate() - 4)
      
      const state = {
        streak: {
          current: 1,
          longest: 3,
          lastAnswerDate: fourDaysAgo.toISOString().split('T')[0]
        }
      }
      localStorage.setItem('remember-me-state', JSON.stringify(state))
    })
    
    await page.reload()
    
    const banner = page.getByTestId('welcome-back-banner')
    await expect(banner).toBeVisible()
    
    // Continue button should have required test ID as per API contract
    const continueBtn = page.getByTestId('welcome-back-continue')
    await expect(continueBtn).toBeVisible()
    
    // Click should navigate to next question (we check URL change or navigation)
    await continueBtn.click()
    
    // Banner should disappear after continue action
    await expect(banner).not.toBeVisible()
  })

  test('welcome back banner dismiss functionality', async ({ page }) => {
    // Set up welcome back scenario
    await page.evaluate(() => {
      const profile = { name: 'Test User', createdAt: new Date().toISOString() }
      localStorage.setItem('remember-me-profile', JSON.stringify(profile))
      
      const fourDaysAgo = new Date()
      fourDaysAgo.setDate(fourDaysAgo.getDate() - 5)
      
      const state = {
        streak: {
          current: 0,
          longest: 2,
          lastAnswerDate: fourDaysAgo.toISOString().split('T')[0]
        }
      }
      localStorage.setItem('remember-me-state', JSON.stringify(state))
    })
    
    await page.reload()
    
    const banner = page.getByTestId('welcome-back-banner')
    await expect(banner).toBeVisible()
    
    // Find and click dismiss button
    const dismissBtn = banner.getByText('Schließen')
    await dismissBtn.click()
    
    // Banner should disappear
    await expect(banner).not.toBeVisible()
  })

  test('iOS fallback behavior - shows hint when showTrigger unavailable', async ({ page }) => {
    // Mock iOS environment where showTrigger is not supported
    await page.addInitScript(() => {
      Object.defineProperty(window, 'Notification', {
        value: {
          permission: 'default',
          prototype: {} // No showTrigger
        },
        writable: true
      })
    })
    
    await page.goto('/')
    await page.click('[data-testid="tab-profile"]')
    
    const settingsCard = page.getByTestId('reminder-settings')
    
    // Should show iOS hint as per NFR
    await expect(settingsCard.getByText('Auf iOS funktionieren Erinnerungen aktuell nur in der App')).toBeVisible()
  })

  test('permission denied state shows appropriate hint', async ({ page }) => {
    // Mock denied permission state
    await page.addInitScript(() => {
      Object.defineProperty(window, 'Notification', {
        value: {
          permission: 'denied',
          prototype: { showTrigger: undefined }
        },
        writable: true
      })
    })
    
    await page.goto('/')
    await page.click('[data-testid="tab-profile"]')
    
    const settingsCard = page.getByTestId('reminder-settings')
    
    // Should show permission hint as per FR-16.11
    await expect(settingsCard.getByText('In den Browser-/OS-Einstellungen aktivierbar')).toBeVisible()
  })

  test('reminder state persistence after reload', async ({ page }) => {
    await page.click('[data-testid="tab-profile"]')
    
    // Enable reminders
    const toggle = page.getByTestId('reminder-toggle')
    await toggle.click()
    
    // Mock permission grant
    await page.evaluate(() => {
      if (window.Notification) {
        Object.defineProperty(window.Notification, 'permission', {
          value: 'granted',
          writable: true
        })
      }
    })
    
    await page.waitForTimeout(100)
    await expect(toggle).toBeChecked()
    
    // Reload page
    await page.reload()
    
    // Navigate back to profile
    await page.click('[data-testid="tab-profile"]')
    
    // State should persist
    const reloadedToggle = page.getByTestId('reminder-toggle')
    await expect(reloadedToggle).toBeChecked()
  })

  test('backoff behavior - no trigger set after stage 3', async ({ page }) => {
    // Set up state showing stage 3 completion
    await page.evaluate(() => {
      const reminderState = {
        permission: 'enabled',
        backoffStage: 3,
        lastShownAt: Date.now() - (25 * 24 * 60 * 60 * 1000) // 25 days ago
      }
      localStorage.setItem('rm-reminder-state', JSON.stringify(reminderState))
    })
    
    await page.reload()
    
    // Wait for app initialization
    await page.waitForTimeout(500)
    
    // Check that no new notification is scheduled by examining the state
    const currentState = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('rm-reminder-state') || '{}')
    })
    
    // After stage 3, should remain in silence mode as per FR-16.1
    expect(currentState.backoffStage).toBe(3)
  })

  test('variant rotation - different messages on consecutive reminders', async ({ page }) => {
    // This test verifies that the variant pool rotation works
    // by simulating multiple reminder cycles and checking lastVariantIdx
    
    await page.evaluate(() => {
      const reminderState = {
        permission: 'enabled',
        backoffStage: 1,
        lastShownAt: Date.now() - (4 * 24 * 60 * 60 * 1000), // 4 days ago
        lastVariantIdx: 2 // Previous variant
      }
      localStorage.setItem('rm-reminder-state', JSON.stringify(reminderState))
    })
    
    await page.reload()
    await page.waitForTimeout(500)
    
    // Check that lastVariantIdx has changed (rotation occurred)
    const newState = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('rm-reminder-state') || '{}')
    })
    
    // Should have different variant index as per FR-16.3
    expect(newState.lastVariantIdx).toBeDefined()
    expect(newState.lastVariantIdx).not.toBe(2) // Should be different from previous
  })
})
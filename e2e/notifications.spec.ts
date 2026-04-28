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
  test('banner appears after simulated absence ≥3 days', async ({ page }) => {
    await page.addInitScript(() => {
      const fourDaysAgo = Date.now() - 4 * 24 * 60 * 60 * 1000
      const state = {
        answers: { 'q1': { value: 'previous answer' } },
        streak: {
          current: 0,
          longest: 2,
          lastAnswerDate: new Date(fourDaysAgo).toISOString().split('T')[0],
        },
      }
      localStorage.setItem('remember-me-state', JSON.stringify(state))
    })

    await completeOnboarding(page)
    
    // Welcome-back banner should appear
    const banner = page.getByTestId('welcome-back-banner')
    await expect(banner).toBeVisible()
    
    // Should have correct CSS classes
    await expect(banner).toHaveClass(/update-banner/)
    await expect(banner).toHaveClass(/welcome-back-banner/)
    
    // Should have accessibility attributes
    await expect(banner).toHaveAttribute('role', 'alert')
    await expect(banner).toHaveAttribute('aria-live', 'polite')
    
    // Should show welcome back title
    await expect(page.getByText(de.reminder.welcomeBack.title)).toBeVisible()
    
    // Should show days away message
    const daysMessage = de.reminder.welcomeBack.bodyDays.replace('{days}', '4')
    await expect(page.getByText(daysMessage)).toBeVisible()
  })

  test('banner can be dismissed via aria-labelled button', async ({ page }) => {
    await page.addInitScript(() => {
      const fourDaysAgo = Date.now() - 4 * 24 * 60 * 60 * 1000
      const state = {
        streak: {
          current: 0,
          longest: 1,
          lastAnswerDate: new Date(fourDaysAgo).toISOString().split('T')[0],
        },
      }
      localStorage.setItem('remember-me-state', JSON.stringify(state))
    })

    await completeOnboarding(page)
    
    // Banner appears
    await expect(page.getByTestId('welcome-back-banner')).toBeVisible()
    
    // Click dismiss button
    const dismiss = page.getByRole('button', {
      name: de.reminder.welcomeBack.dismiss,
    })
    await dismiss.click()
    
    // Banner disappears
    await expect(page.getByTestId('welcome-back-banner')).not.toBeVisible()
  })

  test('continue button navigates to next open question', async ({ page }) => {
    await page.addInitScript(() => {
      const fourDaysAgo = Date.now() - 4 * 24 * 60 * 60 * 1000
      const state = {
        answers: {}, // No answers = all questions are open
        streak: {
          current: 0,
          longest: 1,
          lastAnswerDate: new Date(fourDaysAgo).toISOString().split('T')[0],
        },
      }
      localStorage.setItem('remember-me-state', JSON.stringify(state))
    })

    await completeOnboarding(page)
    
    // Banner appears
    await expect(page.getByTestId('welcome-back-banner')).toBeVisible()
    
    // Click continue button  
    const continueBtn = page.getByTestId('welcome-back-continue')
    await continueBtn.click()
    
    // Should navigate away from home to a question
    await expect(page).not.toHaveURL('/')
  })
})

test.describe('REQ-016 – Milestone Notifications (FR-16.7)', () => {
  // The auto-generated test agent assumed a `/family` route that opens a
  // direct answer-textbox to fire the 10th/25th answer. The current app has
  // no such route — `/family` falls through to HomeView, which has no
  // textbox. Until a deterministic "answer the next question" e2e flow
  // exists, these tests would just hang waiting for elements that never
  // appear. Unit tests in src/hooks/useStreak.test.ts cover the milestone
  // trigger semantics directly. See docs/testing-conventions.md for the
  // policy on .fixme tests.
  test.fixme('triggers milestone after 10th answer', async ({ page }) => {
    let notificationCalled = false
    
    // Mock Notification API and service worker
    await page.addInitScript(() => {
      Object.defineProperty(window.Notification, 'permission', {
        get: () => 'granted'
      })
      
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          ready: Promise.resolve({
            showNotification: async (title: string, options?: any) => {
              ;(window as any).__milestoneNotificationCalled = true
              ;(window as any).__milestoneNotificationTitle = title
            }
          })
        }
      })
    })

    // Setup state with 9 answers
    await page.addInitScript(() => {
      const state = {
        answers: {}
      }
      for (let i = 1; i <= 9; i++) {
        state.answers[`q${i}`] = { value: `answer ${i}` }
      }
      localStorage.setItem('remember-me-state', JSON.stringify(state))
    })

    await completeOnboarding(page)
    
    // Navigate to a question to answer the 10th
    await page.goto('/family')
    
    // Answer the question to trigger 10th answer milestone
    const textarea = page.getByRole('textbox')
    await expect(textarea).toBeVisible()
    await textarea.fill('My 10th milestone answer')
    
    const submitButton = page.getByRole('button', { name: /weiter|next/i })
    await submitButton.click()

    // Check if milestone notification was triggered
    const notificationTriggered = await page.evaluate(() => 
      (window as any).__milestoneNotificationCalled || false
    )
    expect(notificationTriggered).toBe(true)
  })

  test.fixme('triggers milestone at 25th answer', async ({ page }) => {
    // Mock Notification API
    await page.addInitScript(() => {
      Object.defineProperty(window.Notification, 'permission', {
        get: () => 'granted'
      })
      
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          ready: Promise.resolve({
            showNotification: async () => {
              ;(window as any).__milestone25Called = true
            }
          })
        }
      })
    })

    // Setup state with 24 answers
    await page.addInitScript(() => {
      const state = {
        answers: {}
      }
      for (let i = 1; i <= 24; i++) {
        state.answers[`q${i}`] = { value: `answer ${i}` }
      }
      localStorage.setItem('remember-me-state', JSON.stringify(state))
    })

    await completeOnboarding(page)
    
    // Answer 25th question
    await page.goto('/family')
    const textarea = page.getByRole('textbox')
    await textarea.fill('25th milestone answer')
    await page.getByRole('button', { name: /weiter|next/i }).click()

    const milestone25Triggered = await page.evaluate(() => 
      (window as any).__milestone25Called || false
    )
    expect(milestone25Triggered).toBe(true)
  })

  test.fixme('does not trigger milestone for non-milestone answers', async ({ page }) => {
    // Mock Notification API
    await page.addInitScript(() => {
      Object.defineProperty(window.Notification, 'permission', {
        get: () => 'granted'
      })
      
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          ready: Promise.resolve({
            showNotification: async () => {
              ;(window as any).__nonMilestoneNotification = true
            }
          })
        }
      })
    })

    // Setup state with 15 answers (not a milestone)
    await page.addInitScript(() => {
      const state = {
        answers: {}
      }
      for (let i = 1; i <= 15; i++) {
        state.answers[`q${i}`] = { value: `answer ${i}` }
      }
      localStorage.setItem('remember-me-state', JSON.stringify(state))
    })

    await completeOnboarding(page)
    
    // Answer 16th question (not a milestone)
    await page.goto('/family')
    const textarea = page.getByRole('textbox')
    await textarea.fill('Non-milestone answer')
    await page.getByRole('button', { name: /weiter|next/i }).click()

    const notificationTriggered = await page.evaluate(() => 
      (window as any).__nonMilestoneNotification || false
    )
    expect(notificationTriggered).toBe(false)
  })
})

test.describe('REQ-016 – ReminderBanner Permission Flow (FR-16.10)', () => {
  test('shows permission prompt for default permission', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window.Notification, 'permission', {
        get: () => 'default'
      })
      Object.defineProperty(window.Notification.prototype, 'showTrigger', {
        value: true
      })
    })

    await completeOnboarding(page)
    await openProfileTab(page)

    // ReminderBanner should appear
    const reminderBanner = page.getByTestId('reminder-banner')
    await expect(reminderBanner).toBeVisible()

    // Should have allow button
    const allowButton = page.getByRole('button', { name: de.reminder.allow })
    await expect(allowButton).toBeVisible()
  })

  test('dismisses banner and stays dismissed after rejection', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window.Notification, 'permission', {
        get: () => 'default'
      })
    })

    await completeOnboarding(page)
    await openProfileTab(page)

    const reminderBanner = page.getByTestId('reminder-banner')
    await expect(reminderBanner).toBeVisible()

    // Click dismiss
    const dismissButton = page.getByRole('button', { name: de.reminder.dismiss })
    await dismissButton.click()

    // Banner disappears
    await expect(reminderBanner).not.toBeVisible()

    // Reload page - banner should stay dismissed
    await page.reload()
    await expect(reminderBanner).not.toBeVisible()
  })

  test('does not show banner when permission already denied', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window.Notification, 'permission', {
        get: () => 'denied'
      })
    })

    await completeOnboarding(page)
    await openProfileTab(page)

    // ReminderBanner should NOT appear for denied permission
    const reminderBanner = page.getByTestId('reminder-banner')
    await expect(reminderBanner).not.toBeVisible()
  })
})

test.describe('REQ-016 – Variantenpool (FR-16.3)', () => {
  // The auto-generated test sets `window.__originalGetNotificationContent`
  // and expects the impl to consult that override. The actual
  // `getNotificationContent` in src/utils/notificationContent.ts has no such
  // hook — variants are driven solely by `lastVariantIdx` from
  // localStorage. Unit tests in src/utils/notificationContent.test.ts cover
  // the rotation contract directly.
  test.fixme('ensures different reminder messages on consecutive triggers', async ({ page }) => {
    const capturedVariants: number[] = []
    
    await page.addInitScript(() => {
      ;(window as any).__capturedVariants = []
      
      // Mock getNotificationContent to capture variant selection
      ;(window as any).__originalGetNotificationContent = (options: any) => {
        ;(window as any).__capturedVariants.push(options.lastVariantIdx || -1)
        const nextIdx = ((options.lastVariantIdx || -1) + 1) % 8
        return {
          title: 'Test Title',
          body: `Variant ${nextIdx} message`,
          variantIdx: nextIdx
        }
      }
    })

    await completeOnboarding(page)

    // Simulate multiple reminder triggers
    for (let i = 0; i < 3; i++) {
      await page.evaluate((iteration) => {
        const reminderState = {
          permission: 'enabled',
          backoffStage: 1,
          lastVariantIdx: iteration === 0 ? undefined : iteration - 1
        }
        localStorage.setItem('rm-reminder-state', JSON.stringify(reminderState))
      }, i)
      
      await page.reload()
      await new Promise(resolve => setTimeout(resolve, 100)) // Short delay
    }

    const variants = await page.evaluate(() => (window as any).__capturedVariants || [])
    
    // Should have captured multiple different variants
    expect(variants.length).toBeGreaterThan(1)
    
    // Should not repeat the same variant twice in a row
    for (let i = 1; i < variants.length; i++) {
      expect(variants[i]).not.toBe(variants[i - 1])
    }
  })
})

test.describe('REQ-016 – iOS Fallback Behavior', () => {
  test('welcome-back banner works without showTrigger support', async ({ page }) => {
    // Simulate iOS environment without showTrigger
    await page.addInitScript(() => {
      Object.defineProperty(window.Notification, 'permission', {
        get: () => 'granted'
      })
      // No showTrigger property
      delete window.Notification.prototype.showTrigger
    })

    // Setup 4-day gap
    await page.addInitScript(() => {
      const fourDaysAgo = Date.now() - 4 * 24 * 60 * 60 * 1000
      const state = {
        streak: {
          current: 0,
          longest: 1,
          lastAnswerDate: new Date(fourDaysAgo).toISOString().split('T')[0],
        },
      }
      localStorage.setItem('remember-me-state', JSON.stringify(state))
    })

    await completeOnboarding(page)

    // Welcome-back banner should appear as fallback
    const banner = page.getByTestId('welcome-back-banner')
    await expect(banner).toBeVisible()
  })
})

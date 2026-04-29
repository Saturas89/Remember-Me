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
  // Setup that mocks Notification + serviceWorker AND pre-seeds the app
  // state so the next answer crosses the given milestone count. The original
  // auto-generated tests navigated to a non-existent `/family` route — this
  // version uses the real quiz flow (category-card → textarea-fill).
  async function seedMilestoneFixture(
    page: Page,
    options: { existingAnswers: number; tagSink: string },
  ) {
    await page.addInitScript(([n, sink]) => {
      // Replace window.Notification (read-only `permission` makes a getter
      // override unreliable across browsers; full replacement always works).
      const proto = window.Notification?.prototype ?? {}
      ;(window as unknown as { Notification: unknown }).Notification = Object.assign(
        function Notification() { /* noop */ },
        {
          permission: 'granted' as NotificationPermission,
          requestPermission: async () => 'granted' as NotificationPermission,
          prototype: proto,
        },
      )

      // Override navigator.serviceWorker so milestone-trigger goes to our stub.
      // Vite-plugin-pwa calls `register()` on boot — keep it harmless.
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          ready: Promise.resolve({
            showNotification: async (title: string, opts: { tag?: string } = {}) => {
              const w = window as unknown as Record<string, unknown>
              if (opts.tag === 'rm-milestone') {
                w[sink] = { title, tag: opts.tag }
              }
            },
            getNotifications: async () => [],
          }),
          register: async () => ({}),
          addEventListener: () => {},
          removeEventListener: () => {},
        },
        configurable: true,
        writable: true,
      })

      // Pre-seed app state: profile + N answers under fake IDs that don't
      // collide with real category questions.
      const state: {
        profile: { name: string; createdAt: string }
        answers: Record<string, {
          id: string
          questionId: string
          categoryId: string
          value: string
          createdAt: string
          updatedAt: string
        }>
        friends: never[]
        friendAnswers: never[]
        customQuestions: never[]
      } = {
        profile: { name: 'Milestoner', createdAt: '2026-01-01T00:00:00.000Z' },
        answers: {},
        friends: [],
        friendAnswers: [],
        customQuestions: [],
      }
      for (let i = 1; i <= n; i++) {
        const id = `seed-${i}`
        state.answers[id] = {
          id,
          questionId: id,
          categoryId: 'seed',
          value: `seed answer ${i}`,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }
      }
      localStorage.setItem('remember-me-state', JSON.stringify(state))
      // Skip the OS reminder banner so it can't intercept clicks on the
      // category card in any browser.
      localStorage.setItem(
        'rm-reminder-state',
        JSON.stringify({ permission: 'dismissed', backoffStage: 0 }),
      )
    }, [options.existingAnswers, options.tagSink])
  }

  async function fillFirstAnswerInValuesCategory(page: Page, text: string) {
    // The pre-seed sets a profile, so onboarding is skipped — App lands on
    // HomeView directly. Click the category heading to enter QuizView.
    await page.goto('/')
    await page.getByRole('heading', { name: 'Werte & Überzeugungen' }).click()
    const textarea = page.locator('textarea.input-textarea').first()
    await expect(textarea).toBeVisible()
    await textarea.fill(text)
  }

  test('triggers milestone after 10th answer', async ({ page }) => {
    await seedMilestoneFixture(page, { existingAnswers: 9, tagSink: '__ms10' })
    await fillFirstAnswerInValuesCategory(page, 'Mein zehnter Eintrag.')

    await page.waitForFunction(
      () => Boolean((window as unknown as { __ms10?: unknown }).__ms10),
      undefined,
      { timeout: 5_000 },
    )

    const fired = await page.evaluate(
      () => (window as unknown as { __ms10?: { title: string } }).__ms10,
    )
    expect(fired?.title).toMatch(/Meilenstein|Milestone/)
  })

  test('triggers milestone at 25th answer', async ({ page }) => {
    await seedMilestoneFixture(page, { existingAnswers: 24, tagSink: '__ms25' })
    await fillFirstAnswerInValuesCategory(page, '25. Antwort.')

    await page.waitForFunction(
      () => Boolean((window as unknown as { __ms25?: unknown }).__ms25),
      undefined,
      { timeout: 5_000 },
    )

    const fired = await page.evaluate(
      () => (window as unknown as { __ms25?: { title: string } }).__ms25,
    )
    expect(fired?.title).toMatch(/Meilenstein|Milestone/)
  })

  test('does not trigger milestone for non-milestone answers', async ({ page }) => {
    await seedMilestoneFixture(page, { existingAnswers: 15, tagSink: '__msNo' })
    await fillFirstAnswerInValuesCategory(page, 'Antwort #16.')

    // Give the milestone path a chance to fire if it would.
    await page.waitForTimeout(500)

    const fired = await page.evaluate(
      () => (window as unknown as { __msNo?: unknown }).__msNo,
    )
    expect(fired).toBeUndefined()
  })
})

test.describe('REQ-016 – ReminderBanner Permission Flow (FR-16.10)', () => {
  test('shows permission prompt for default permission', async ({ page }) => {
    await page.addInitScript(() => {
      // Mobile Safari has no window.Notification — full replacement (instead
      // of `Object.defineProperty(window.Notification, ...)` on possibly-
      // undefined Notification) makes the test work across all browser
      // projects.
      const proto: Record<string, unknown> = window.Notification?.prototype ?? {}
      proto.showTrigger = true
      ;(window as unknown as { Notification: unknown }).Notification = Object.assign(
        function Notification() { /* noop */ },
        {
          permission: 'default' as NotificationPermission,
          requestPermission: async () => 'default' as NotificationPermission,
          prototype: proto,
        },
      )
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
      const proto: Record<string, unknown> = window.Notification?.prototype ?? {}
      proto.showTrigger = true
      ;(window as unknown as { Notification: unknown }).Notification = Object.assign(
        function Notification() { /* noop */ },
        {
          permission: 'default' as NotificationPermission,
          requestPermission: async () => 'default' as NotificationPermission,
          prototype: proto,
        },
      )
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
  // The auto-generated test set a `window.__originalGetNotificationContent`
  // override and assumed the impl would consult it — `notificationContent.ts`
  // has no such hook. This rewrite exercises the real path:
  // saveAnswer → handleSaveAnswer → reschedule → scheduleNextNotification →
  // getNotificationContent → saveState({lastVariantIdx, …}) — and inspects
  // the persisted lastVariantIdx in `rm-reminder-state` between iterations.
  test('writes a different lastVariantIdx on each consecutive reschedule', async ({ page }) => {
    await page.addInitScript(() => {
      // Notification + serviceWorker stubs so reschedule survives.
      const proto = window.Notification?.prototype ?? {}
      // showTrigger has to be present on prototype for the canPrompt path
      // and the scheduleNextNotification path to proceed.
      ;(proto as Record<string, unknown>).showTrigger = true
      ;(window as unknown as { Notification: unknown }).Notification = Object.assign(
        function Notification() { /* noop */ },
        {
          permission: 'granted' as NotificationPermission,
          requestPermission: async () => 'granted' as NotificationPermission,
          prototype: proto,
        },
      )

      ;(window as unknown as { TimestampTrigger: unknown }).TimestampTrigger =
        class TimestampTrigger {
          timestamp: number
          constructor(ts: number) { this.timestamp = ts }
        }

      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          ready: Promise.resolve({
            showNotification: async () => {},
            getNotifications: async () => [],
          }),
          register: async () => ({}),
          addEventListener: () => {},
          removeEventListener: () => {},
        },
        configurable: true,
        writable: true,
      })

      // Profile + permission already enabled so reschedule advances stages.
      localStorage.setItem('remember-me-state', JSON.stringify({
        profile: { name: 'Var', createdAt: '2026-01-01T00:00:00.000Z' },
        answers: {},
        friends: [],
        friendAnswers: [],
        customQuestions: [],
      }))
      localStorage.setItem(
        'rm-reminder-state',
        JSON.stringify({ permission: 'enabled', backoffStage: 0 }),
      )
    })

    await page.goto('/')

    await page.goto('/')
    await page.getByRole('heading', { name: 'Werte & Überzeugungen' }).click()

    async function saveAnswerAndReadVariant(
      text: string,
      previousVariantIdx: number | undefined,
    ): Promise<number | undefined> {
      const textarea = page.locator('textarea.input-textarea').first()
      await expect(textarea).toBeVisible()
      await textarea.fill(text)

      // Wait for the reschedule path to land a fresh lastVariantIdx in
      // localStorage that differs from the previous iteration's value.
      await page.waitForFunction(
        (prev) => {
          const raw = localStorage.getItem('rm-reminder-state')
          if (!raw) return false
          const parsed = JSON.parse(raw) as { lastVariantIdx?: number }
          return (
            typeof parsed.lastVariantIdx === 'number' &&
            parsed.lastVariantIdx !== prev
          )
        },
        previousVariantIdx,
        { timeout: 3_000 },
      )
      return await page.evaluate(() => {
        const raw = localStorage.getItem('rm-reminder-state')
        return raw ? (JSON.parse(raw) as { lastVariantIdx?: number }).lastVariantIdx : undefined
      })
    }

    // FR-16.3 only requires that two consecutive variants don't repeat.
    // Stage 3 is silent (no rotation) — within one session we can produce at
    // most two distinct rotations (stages 0→1 and 1→2) before reschedule
    // hits silent, so we don't try a third here.
    const v1 = await saveAnswerAndReadVariant('Erste Antwort.', undefined)
    // Advance to next question so the next fill is a NEW save (not an edit
    // of the same answer) — recordAnswer needs the totalAnswered count to
    // grow for QuizView's onChange to fire reschedule again.
    await page.getByRole('button', { name: /Weiter/ }).click()
    const v2 = await saveAnswerAndReadVariant('Zweite Antwort.', v1)

    expect(v1).toBeDefined()
    expect(v2).toBeDefined()
    expect(v2).not.toBe(v1)
  })
})

test.describe('REQ-016 – iOS Fallback Behavior', () => {
  test('welcome-back banner works without showTrigger support', async ({ page }) => {
    // Simulate iOS environment without showTrigger. Full Notification
    // replacement (rather than defineProperty on a possibly-undefined
    // window.Notification) is needed for Mobile Safari, where the API is
    // absent entirely.
    await page.addInitScript(() => {
      ;(window as unknown as { Notification: unknown }).Notification = Object.assign(
        function Notification() { /* noop */ },
        {
          permission: 'granted' as NotificationPermission,
          requestPermission: async () => 'granted' as NotificationPermission,
          // Empty prototype — no showTrigger ⇒ canPrompt is false, this is the
          // iOS-fallback path the test is asserting.
          prototype: {},
        },
      )
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

import { test, expect, type Page } from '@playwright/test'
import { UI_DE as de } from '../src/locales/de/ui'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rm-install-dismissed', '1')
    // E2E: only seed on first navigation – tests that build state via
    // __rmState.save between gotos must not be reset by a re-run init script.
    if (!localStorage.getItem('remember-me-state')) {
      localStorage.setItem('remember-me-state', JSON.stringify({
        profile: null, answers: {}, friends: [], friendAnswers: [],
        customQuestions: [], appMode: 'full',
      }))
    }
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
        appMode: 'full', // skip Simple-Mode mode-choice step
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
        { timeout: 8_000 },
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


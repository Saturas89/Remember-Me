import { test, expect, type BrowserContext, type Page } from '@playwright/test'

// ─────────────────────────────────────────────────────────────────────────────
// Sandra-Flow E2E (#/ask) — v2.5.0 feature.
//
// Sandra, the tech-savvy buyer, lands on `#/ask`, formulates 2–10 personal
// questions, and sends them via a question-pack URL (`?qp-plain=…`) to a
// relative (Ingrid, the receiver).
//
// Coverage:
//   1. DE happy path: Sandra composes one relationship question and shares
//      → Web-Share-API stub is invoked with the share URL
//   2. EN happy path: same flow with English locale
//   3. Receiver: opens a `?qp-plain=…` URL in a fresh context, sees the
//      simple-mode prompt + one-question-at-a-time view + big mic button
//   4. Mixed-group pack → relationship hint visibility
//   5. Draft persistence in sessionStorage (reload-keeps, new-tab-drops)
//   6. Web-Share-API stub captures URL + title cleanly (mobile-safari safe)
// ─────────────────────────────────────────────────────────────────────────────

const STATE_FULL_NO_PROFILE = JSON.stringify({
  profile: null, answers: {}, friends: [], friendAnswers: [],
  customQuestions: [], appMode: 'full',
})

const STATE_FULL_SANDRA = JSON.stringify({
  profile: { name: 'Sandra', createdAt: '2026-01-01T00:00:00.000Z' },
  answers: {}, friends: [], friendAnswers: [],
  customQuestions: [], appMode: 'full',
})

/** Suppress install banner + set lang + seed a profile so the app is past
 *  onboarding immediately. */
async function seedContext(
  context: BrowserContext,
  opts: { lang: 'de' | 'en'; profile?: 'sandra' | 'none' } = { lang: 'de', profile: 'sandra' },
) {
  await context.addInitScript(([lang, stateJson]) => {
    localStorage.setItem('rm-install-dismissed', '1')
    localStorage.setItem('rm-lang', lang as string)
    if (!localStorage.getItem('remember-me-state')) {
      localStorage.setItem('remember-me-state', stateJson as string)
    }
  }, [opts.lang, opts.profile === 'none' ? STATE_FULL_NO_PROFILE : STATE_FULL_SANDRA])
}

/**
 * Install a deterministic `navigator.share` stub so the native share-sheet
 * never appears. This is mandatory for mobile-safari and mobile-chrome
 * — otherwise the test hangs on the OS UI.
 *
 * The shared payload is captured on `window.__sharedPayloads__` so tests
 * can later assert URL + title.
 */
async function stubWebShare(context: BrowserContext) {
  await context.addInitScript(() => {
    interface SharePayload { title?: string; text?: string; url?: string }
    interface SharedWindow extends Window {
      __sharedPayloads__?: SharePayload[]
    }
    const w = window as SharedWindow
    w.__sharedPayloads__ = []
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      writable: true,
      value: (payload: SharePayload) => {
        w.__sharedPayloads__!.push(payload)
        return Promise.resolve()
      },
    })
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      writable: true,
      value: () => true,
    })
  })
}

async function getSharedPayloads(page: Page): Promise<Array<{ title?: string; text?: string; url?: string }>> {
  return page.evaluate(() => {
    interface SharePayload { title?: string; text?: string; url?: string }
    interface SharedWindow extends Window { __sharedPayloads__?: SharePayload[] }
    return (window as SharedWindow).__sharedPayloads__ ?? []
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 1 — DE Happy Path
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Sandra-Flow – DE Happy Path', () => {
  test.beforeEach(async ({ context }) => {
    await seedContext(context, { lang: 'de', profile: 'sandra' })
    await stubWebShare(context)
  })

  test('Sandra composes one question and shares via Web-Share-API', async ({ page }) => {
    await page.goto('/#/ask')

    // ── Screen 1: hero text matches DE spec exactly ─────────────────────────
    await expect(
      page.getByText('Was wolltest du deine Mutter schon immer fragen?'),
    ).toBeVisible()
    await expect(
      page.getByText('In 2 Minuten formulierst du deine eigenen Fragen.'),
    ).toBeVisible()

    // Tap the landing CTA → anchor step
    await page.getByTestId('sandra-landing-cta').click()

    // ── Screen 2: anchor (relation chip + anrede) ──────────────────────────
    await page.getByTestId('sandra-anchor-chip-mama').click()
    await expect(page.getByTestId('sandra-anchor-anrede')).toHaveValue('Mama')
    await page.getByTestId('sandra-anchor-next').click()

    // ── Screen 3: pick first trigger ────────────────────────────────────────
    // The trigger list is data-driven; we use the first available trigger
    // rather than pinning a fragile id. Triggers are exposed as
    // `sandra-trigger-<id>` test-ids.
    const triggerButtons = page.locator('[data-testid^="sandra-trigger-"]')
    await expect(triggerButtons.first()).toBeVisible()
    await triggerButtons.first().click()

    // ── Screen 4: composer ─────────────────────────────────────────────────
    // Suggestions appear when `withoutSeed` exists OR the seed is non-empty.
    // We type a short seed to make suggestions appear deterministically.
    await page.getByTestId('sandra-composer-seed').fill('Schulzeit')
    const firstSuggestion = page.locator('[data-testid^="sandra-suggestion-"]').first()
    await expect(firstSuggestion).toBeVisible({ timeout: 10_000 })
    await firstSuggestion.click()
    // Confirm the suggestion via the "use" button → question gets added.
    const useBtn = page.locator('[data-testid^="sandra-suggestion-use-"]').first()
    await useBtn.click()

    // ── Screen 5: list shows 1 card, send enabled, NO private toggle ───────
    const send = page.getByTestId('sandra-list-send')
    await expect(send).toBeEnabled()
    await expect(send).toContainText(/Mama/)
    expect(await page.locator('[data-testid*="private"]').count()).toBe(0)
    expect(await page.locator('input[type="checkbox"]').count()).toBe(0)
    await send.click()

    // ── Screen 6: share CTA → Web-Share-API stub captures the call ─────────
    const shareCta = page.getByTestId('sandra-share-cta')
    await expect(shareCta).toBeVisible()
    await shareCta.click()

    // Web-Share-API was invoked. Assert the captured payload has a URL.
    await expect.poll(async () => (await getSharedPayloads(page)).length).toBeGreaterThanOrEqual(1)
    const payloads = await getSharedPayloads(page)
    const url = payloads[0].url ?? ''
    expect(url).toMatch(/^https?:\/\//)
    // Pack-code lives in the query string (?qp-plain=…), not as visible text.
    expect(url).toContain('qp')

    // ── Pack code is NOT shown as visible text in the DOM ──────────────────
    const codeFromUrl = url.split('=').pop() ?? ''
    if (codeFromUrl.length > 20) {
      const bodyText = await page.locator('body').innerText()
      expect(bodyText).not.toContain(codeFromUrl)
    }

    // ── No QR-code element ────────────────────────────────────────────────
    expect(await page.locator('[data-testid="qr-code"]').count()).toBe(0)
    expect(await page.locator('canvas[data-qr]').count()).toBe(0)
    expect(await page.locator('[class*="qrcode"]').count()).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 2 — EN Happy Path
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Sandra-Flow – EN Happy Path', () => {
  test.beforeEach(async ({ context }) => {
    await seedContext(context, { lang: 'en', profile: 'sandra' })
    await stubWebShare(context)
  })

  test('the hero text and labels switch to English', async ({ page }) => {
    await page.goto('/#/ask')

    // ── Screen 1: English hero text ──────────────────────────────────────────
    await expect(
      page.getByText('What have you always wanted to ask your mother?'),
    ).toBeVisible()
    await expect(
      page.getByText("In 2 minutes, you'll compose your own questions."),
    ).toBeVisible()

    // ── Screen 2 ─────────────────────────────────────────────────────────────
    await page.getByTestId('sandra-landing-cta').click()
    await page.getByTestId('sandra-anchor-chip-mama').click()
    await page.getByTestId('sandra-anchor-next').click()

    // ── Screen 3: triggers ──────────────────────────────────────────────────
    const triggerButtons = page.locator('[data-testid^="sandra-trigger-"]')
    await expect(triggerButtons.first()).toBeVisible()
    await triggerButtons.first().click()

    // ── Screen 4: composer with an English seed ─────────────────────────────
    await page.getByTestId('sandra-composer-seed').fill('school')
    const firstSuggestion = page.locator('[data-testid^="sandra-suggestion-"]').first()
    await expect(firstSuggestion).toBeVisible({ timeout: 10_000 })
    const suggestionText = (await firstSuggestion.innerText()).trim()
    expect(suggestionText.length).toBeGreaterThan(0)
    // The English bank must NOT spit out obvious German fillers like „hast du".
    expect(suggestionText.toLowerCase()).not.toMatch(/\bhast du\b/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 3 — Receiver (Ingrid) opens the personal-pack URL
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Sandra-Flow – Receiver Path (Ingrid)', () => {
  test('shared `?qp-plain=…` URL triggers simple-mode prompt + one-question view', async ({ browser }) => {
    // ── Step 1: Sandra builds the URL (drive the real flow) ────────────────
    const senderContext = await browser.newContext()
    await seedContext(senderContext, { lang: 'de', profile: 'sandra' })
    await stubWebShare(senderContext)
    const sender = await senderContext.newPage()

    await sender.goto('/#/ask')
    await sender.getByTestId('sandra-landing-cta').click()
    await sender.getByTestId('sandra-anchor-chip-mama').click()
    await sender.getByTestId('sandra-anchor-next').click()
    await sender.locator('[data-testid^="sandra-trigger-"]').first().click()
    await sender.getByTestId('sandra-composer-seed').fill('Schulzeit')
    await sender.locator('[data-testid^="sandra-suggestion-"]').first().click()
    await sender.locator('[data-testid^="sandra-suggestion-use-"]').first().click()
    await sender.getByTestId('sandra-list-send').click()
    await sender.getByTestId('sandra-share-cta').click()
    await expect.poll(async () => (await getSharedPayloads(sender)).length).toBeGreaterThanOrEqual(1)
    const payloads = await getSharedPayloads(sender)
    const shareUrl = payloads[0].url ?? ''
    expect(shareUrl).toMatch(/qp/)
    await senderContext.close()

    // ── Step 2: Open the URL in a fresh context (Ingrid, no profile) ───────
    const ingridContext = await browser.newContext()
    await seedContext(ingridContext, { lang: 'de', profile: 'none' })
    const ingrid = await ingridContext.newPage()
    await ingrid.goto(shareUrl)

    // ── Modal prompts Vereinfachter Bedienmodus ─────────────────────────────
    const acceptSimple = ingrid.getByTestId('sandra-receive-simple-yes')
    await expect(acceptSimple).toBeVisible({ timeout: 15_000 })
    await acceptSimple.click()

    // ── Welcome screen header: "{senderName} hat dir {n} Fragen geschickt" ─
    await expect(ingrid.getByText(/Sandra hat dir/i)).toBeVisible()
    // Fill the name and proceed into the quiz.
    await ingrid.getByTestId('sandra-receive-name').fill('Ingrid')
    await ingrid.getByTestId('sandra-receive-start').click()

    // ── One-question-at-a-time view ─────────────────────────────────────────
    // The textarea is the receiver's answer input, and the mic button must be
    // ≥ 80×80 px. We assert via `boundingBox`.
    await expect(ingrid.getByTestId('sandra-receive-answer')).toBeVisible()
    const mic = ingrid.getByTestId('sandra-receive-next')
    await expect(mic).toBeVisible()
    const micBox = await mic.boundingBox()
    expect(micBox).not.toBeNull()
    expect(micBox!.width).toBeGreaterThanOrEqual(80)
    expect(micBox!.height).toBeGreaterThanOrEqual(80)

    // ── Dot-progress indicator present, no "%" digit ───────────────────────
    const dots = ingrid.locator('.sandra-receive__dots')
    await expect(dots).toBeVisible()
    expect((await dots.innerText()).trim()).not.toMatch(/%/)

    // ── Simple mode was actually activated ─────────────────────────────────
    await expect(ingrid.locator('html')).toHaveAttribute('data-app-mode', 'simple')

    await ingridContext.close()
  })

  test('receiver can DECLINE simple mode and still see the welcome', async ({ browser }) => {
    // Pre-build a URL via the sender flow (compact version).
    const sCtx = await browser.newContext()
    await seedContext(sCtx, { lang: 'de', profile: 'sandra' })
    await stubWebShare(sCtx)
    const sPage = await sCtx.newPage()
    await sPage.goto('/#/ask')
    await sPage.getByTestId('sandra-landing-cta').click()
    await sPage.getByTestId('sandra-anchor-chip-mama').click()
    await sPage.getByTestId('sandra-anchor-next').click()
    await sPage.locator('[data-testid^="sandra-trigger-"]').first().click()
    await sPage.getByTestId('sandra-composer-seed').fill('Schulzeit')
    await sPage.locator('[data-testid^="sandra-suggestion-"]').first().click()
    await sPage.locator('[data-testid^="sandra-suggestion-use-"]').first().click()
    await sPage.getByTestId('sandra-list-send').click()
    await sPage.getByTestId('sandra-share-cta').click()
    await expect.poll(async () => (await getSharedPayloads(sPage)).length).toBeGreaterThanOrEqual(1)
    const shareUrl = (await getSharedPayloads(sPage))[0].url ?? ''
    await sCtx.close()

    const iCtx = await browser.newContext()
    await seedContext(iCtx, { lang: 'de', profile: 'none' })
    const i = await iCtx.newPage()
    await i.goto(shareUrl)
    await expect(i.getByTestId('sandra-receive-simple-no')).toBeVisible({ timeout: 15_000 })
    await i.getByTestId('sandra-receive-simple-no').click()
    // Simple mode should NOT be active after decline.
    await expect(i.locator('html')).not.toHaveAttribute('data-app-mode', 'simple')
    // Welcome header still appears.
    await expect(i.getByText(/Sandra hat dir/i)).toBeVisible()
    await iCtx.close()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 4 — Relationship-send hint (mixed-group vs biography-only)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Sandra-Flow – Relationship-send hint', () => {
  test.beforeEach(async ({ context }) => {
    await seedContext(context, { lang: 'de', profile: 'sandra' })
    await stubWebShare(context)
  })

  test('hint is visible on the share screen when ≥1 relationship question exists', async ({ page }) => {
    await page.goto('/#/ask')
    await page.getByTestId('sandra-landing-cta').click()
    await page.getByTestId('sandra-anchor-chip-mama').click()
    await page.getByTestId('sandra-anchor-next').click()

    // Pick the last relationship trigger: the bank renders biography (6) →
    // relationship (4) → freeform (1). The absolute last trigger is the
    // freeform card, which has its own input path and does NOT lead to the
    // composer-seed textarea. We therefore exclude `sandra-trigger-freeform`
    // and pick the actual last relationship card.
    const triggers = page.locator(
      '[data-testid^="sandra-trigger-"]:not([data-testid="sandra-trigger-freeform"])',
    )
    const count = await triggers.count()
    expect(count).toBeGreaterThan(1)
    await triggers.nth(count - 1).click()

    await page.getByTestId('sandra-composer-seed').fill('uns zwei')
    await page.locator('[data-testid^="sandra-suggestion-"]').first().click()
    await page.locator('[data-testid^="sandra-suggestion-use-"]').first().click()
    await page.getByTestId('sandra-list-send').click()

    // The share screen renders the relationship hint as a `.friends-hint`
    // paragraph containing the localized text. We check the stem of the
    // DE phrase: „Ein paar Fragen sind sehr persönlich."
    await expect(page.getByText(/sehr persönlich/i)).toBeVisible()
  })

  test('hint is hidden when all questions are biography-only', async ({ page }) => {
    await page.goto('/#/ask')
    await page.getByTestId('sandra-landing-cta').click()
    await page.getByTestId('sandra-anchor-chip-mama').click()
    await page.getByTestId('sandra-anchor-next').click()

    // First trigger should be biography (Section A).
    await page.locator('[data-testid^="sandra-trigger-"]').first().click()
    await page.getByTestId('sandra-composer-seed').fill('Schulzeit')
    await page.locator('[data-testid^="sandra-suggestion-"]').first().click()
    await page.locator('[data-testid^="sandra-suggestion-use-"]').first().click()
    await page.getByTestId('sandra-list-send').click()

    // No relationship hint text.
    expect(await page.getByText(/sehr persönlich/i).count()).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 5 — Draft persistence in sessionStorage
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Sandra-Flow – Draft persistence', () => {
  test.beforeEach(async ({ context }) => {
    await seedContext(context, { lang: 'de', profile: 'sandra' })
    await stubWebShare(context)
  })

  test('reload preserves draft; new context discards it', async ({ page, browser }) => {
    await page.goto('/#/ask')
    await page.getByTestId('sandra-landing-cta').click()
    await page.getByTestId('sandra-anchor-chip-papa').click()
    await expect(page.getByTestId('sandra-anchor-anrede')).toHaveValue('Papa')
    await page.getByTestId('sandra-anchor-next').click()

    // We're now on the trigger step; the draft has been saved.
    const draftAfterAnchor = await page.evaluate(() => sessionStorage.getItem('rm-sandra-draft'))
    expect(draftAfterAnchor).not.toBeNull()
    expect(draftAfterAnchor!).toContain('Papa')

    // ── Reload the tab — sessionStorage survives ──────────────────────────
    await page.reload()
    const draftAfterReload = await page.evaluate(() => sessionStorage.getItem('rm-sandra-draft'))
    expect(draftAfterReload).not.toBeNull()
    expect(draftAfterReload!).toContain('Papa')

    // ── Open the URL in a fresh context — sessionStorage MUST be gone ─────
    const fresh = await browser.newContext()
    await seedContext(fresh, { lang: 'de', profile: 'sandra' })
    const freshPage = await fresh.newPage()
    await freshPage.goto('/#/ask')
    const draftInFresh = await freshPage.evaluate(() => sessionStorage.getItem('rm-sandra-draft'))
    expect(draftInFresh).toBeNull()
    await fresh.close()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 6 — Web-Share-API stub captures URL + title (Mobile Safari safe)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Sandra-Flow – Web-Share-API stub', () => {
  test.beforeEach(async ({ context }) => {
    await seedContext(context, { lang: 'de', profile: 'sandra' })
    await stubWebShare(context)
  })

  test('the stub captures the share-sheet payload (URL + title + text)', async ({ page }) => {
    await page.goto('/#/ask')
    await page.getByTestId('sandra-landing-cta').click()
    await page.getByTestId('sandra-anchor-chip-mama').click()
    await page.getByTestId('sandra-anchor-next').click()
    await page.locator('[data-testid^="sandra-trigger-"]').first().click()
    await page.getByTestId('sandra-composer-seed').fill('Schulzeit')
    await page.locator('[data-testid^="sandra-suggestion-"]').first().click()
    await page.locator('[data-testid^="sandra-suggestion-use-"]').first().click()
    await page.getByTestId('sandra-list-send').click()
    await page.getByTestId('sandra-share-cta').click()

    await expect.poll(async () => (await getSharedPayloads(page)).length).toBeGreaterThanOrEqual(1)
    const payloads = await getSharedPayloads(page)
    const p = payloads[0]
    expect(typeof p.url).toBe('string')
    expect(p.url ?? '').toMatch(/^https?:\/\//)

    // Title or text MUST mention Mama (the anrede) so the share-sheet preview
    // is informative for Sandra in the OS share menu.
    const combined = (p.title ?? '') + ' ' + (p.text ?? '')
    expect(combined).toMatch(/Mama/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 7 — Full two-person integration: Sandra builds, Ingrid answers, submits
//
// This is the "first interaction between the two people" guarantee. It
// covers the receiver-side beyond just landing — full answer-loop and the
// post-submit state, with the senderName roundtrip through `decodeQuestionPack`.
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Sandra-Flow – Two-person integration', () => {
  test('Ingrid answers every question and submits → archive landing', async ({ browser }) => {
    // ── Sandra builds the share URL via the real flow ──────────────────────
    const senderContext = await browser.newContext()
    await seedContext(senderContext, { lang: 'de', profile: 'sandra' })
    await stubWebShare(senderContext)
    const sender = await senderContext.newPage()

    await sender.goto('/#/ask')
    await sender.getByTestId('sandra-landing-cta').click()
    await sender.getByTestId('sandra-anchor-chip-mama').click()
    await sender.getByTestId('sandra-anchor-next').click()
    await sender.locator('[data-testid^="sandra-trigger-"]').first().click()
    await sender.getByTestId('sandra-composer-seed').fill('Schulzeit')
    await sender.locator('[data-testid^="sandra-suggestion-"]').first().click()
    await sender.locator('[data-testid^="sandra-suggestion-use-"]').first().click()
    await sender.getByTestId('sandra-list-send').click()
    await sender.getByTestId('sandra-share-cta').click()

    await expect.poll(async () => (await getSharedPayloads(sender)).length).toBeGreaterThanOrEqual(1)
    const shareUrl = (await getSharedPayloads(sender))[0].url ?? ''
    expect(shareUrl).toMatch(/qp/)
    await senderContext.close()

    // ── Ingrid opens the URL in a fresh context ────────────────────────────
    const ingridContext = await browser.newContext()
    await seedContext(ingridContext, { lang: 'de', profile: 'none' })
    const ingrid = await ingridContext.newPage()
    await ingrid.goto(shareUrl)

    // Simple-mode prompt → accept (FR-020.9 happy path).
    const acceptSimple = ingrid.getByTestId('sandra-receive-simple-yes')
    await expect(acceptSimple).toBeVisible({ timeout: 15_000 })
    await acceptSimple.click()

    // Regression for the decodeQuestionPack metadata-roundtrip bug:
    // the welcome header MUST contain Sandra's name (not "undefined").
    await expect(ingrid.getByText(/Sandra hat dir/i)).toBeVisible()
    await expect(ingrid.locator('.sandra-receive__title')).not.toContainText('undefined')

    // ── Ingrid types her name and starts ───────────────────────────────────
    await ingrid.getByTestId('sandra-receive-name').fill('Ingrid')
    await ingrid.getByTestId('sandra-receive-start').click()

    // ── Answer every question (the sender flow above produced 1 question;
    // we loop defensively so a future flow change with more questions is
    // automatically covered). After the final continue-click the quiz phase
    // transitions to "done" and the answer textarea is unmounted. ──────────
    const continueBtn = ingrid.getByTestId('sandra-receive-continue')
    const answerBox = ingrid.getByTestId('sandra-receive-answer')
    const submitBtn = ingrid.getByTestId('sandra-receive-submit')
    let safety = 10
    while (safety-- > 0) {
      if (await submitBtn.isVisible().catch(() => false)) break
      await expect(answerBox).toBeVisible()
      await answerBox.fill('Eine schöne Erinnerung an damals.')
      await continueBtn.click()
    }
    expect(safety).toBeGreaterThan(0)
    await expect(submitBtn).toBeVisible()

    // ── Submit → personal-pack view unmounts, URL cleaned ──────────────────
    await ingrid.getByTestId('sandra-receive-submit').click()

    // URL no longer carries the pack code (history.replaceState to '/').
    await expect.poll(async () => ingrid.url()).not.toMatch(/qp/)

    // Receiver view is gone (no more sandra-receive-* test-ids in the DOM).
    // This is the minimal "submit transitioned away" guarantee that doesn't
    // depend on Ingrid's profile state — she may land on the archive (when
    // she has a profile) or on onboarding (first-time receiver). Both are
    // valid post-submit destinations per App.tsx render gates.
    await expect.poll(
      async () => ingrid.locator('[data-testid^="sandra-receive-"]').count(),
      { timeout: 10_000 },
    ).toBe(0)

    await ingridContext.close()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 8 — FriendsView entry card (FR-020.10)
//
// Sandra's first touchpoint: she opens the Friends tab and taps the
// "Eigene Fragen für jemanden formulieren" card. The card must navigate
// directly into `#/ask`.
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Sandra-Flow – Friends-tab entry card (FR-020.10)', () => {
  test.beforeEach(async ({ context }) => {
    await seedContext(context, { lang: 'de', profile: 'sandra' })
  })

  test('card is visible in /friends and the CTA navigates to #/ask', async ({ page }) => {
    await page.goto('/friends')

    // The section title is the spec wording verbatim (FR-020.10).
    await expect(
      page.getByRole('heading', { name: 'Eigene Fragen für jemanden formulieren' }),
    ).toBeVisible()

    const cta = page.getByTestId('sandra-entry-cta')
    await expect(cta).toBeVisible()
    await expect(cta).toHaveText(/Loslegen/i)
    await cta.click()

    // After clicking, we're on the Sandra-flow landing — assert the hero
    // text (which is unique to the landing step) is visible.
    await expect(
      page.getByText('Was wolltest du deine Mutter schon immer fragen?'),
    ).toBeVisible()
    expect(page.url()).toContain('#/ask')
  })
})

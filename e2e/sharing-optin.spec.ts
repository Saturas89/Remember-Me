import { test, expect, type Page, type Request } from '@playwright/test'

// E2E contract for the opt-in guarantee:
//
//   Users who never flip the "Online teilen" switch must see the app behave
//   exactly as before. No request to *.supabase.co (or the configured URL),
//   no missing UI, no broken invite / answer-import / memory-share / ZIP flow.
//
// The existing e2e suites (friends.spec.ts, quiz.spec.ts, …) already cover the
// happy paths; here we add negative assertions on network traffic and the
// visibility of the new online-sharing entry point.

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

async function completeOnboarding(page: Page, name: string) {
  await page.goto('/')
  await page.getByLabel('Wie heißt du?').fill(name)
  await page.getByRole('button', { name: /Loslegen/ }).click()
  await expect(page.getByText(new RegExp(`Hallo,\\s*${name}`))).toBeVisible()
}

async function openFriendsTab(page: Page) {
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  await nav.getByRole('button', { name: 'Freunde', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Laufend verbunden bleiben', exact: true })).toBeVisible()
}

function attachNetworkSpy(page: Page): Request[] {
  const offending: Request[] = []
  page.on('request', req => {
    const url = req.url()
    // We consider any request to *.supabase.co or *.supabase.in a violation
    // of the offline guarantee. (A self-hosted build can set
    // VITE_SUPABASE_URL to a different host, but the default dev build has
    // neither the env var set nor any reason to touch supabase hosts.)
    if (/supabase\.(co|in)\b/.test(url)) offending.push(req)
  })
  return offending
}

test.describe('Online sharing – opt-in contract', () => {
  test('no supabase network traffic without opt-in', async ({ page }) => {
    const offending = attachNetworkSpy(page)
    await completeOnboarding(page, 'Anna')
    await openFriendsTab(page)
    // Interact with the page enough that any eager bootstrap would have fired.
    await page.waitForTimeout(500)
    await expect.poll(() => offending.length).toBe(0)
  })

  test('Freunde-Tab zeigt direkt Intro-Screen ohne Supabase-Traffic', async ({ page }) => {
    // Freunde-Tab leitet direkt zur OnlineSharingIntroView weiter.
    // Kein Netzwerkverkehr darf entstehen bevor der Nutzer aktiv "Aktivieren" klickt.
    const offending = attachNetworkSpy(page)
    await completeOnboarding(page, 'Anna')
    await openFriendsTab(page)
    await expect(page.getByRole('button', { name: 'Aktivieren', exact: true })).toBeVisible()
    await page.waitForTimeout(500)
    await expect.poll(() => offending.length).toBe(0)
  })

  test('Intro-Screen erscheint ohne Supabase-Traffic', async ({ page }) => {
    const offending = attachNetworkSpy(page)
    await completeOnboarding(page, 'Anna')
    await openFriendsTab(page)
    await expect(page.getByRole('heading', { name: 'Laufend verbunden bleiben', exact: true })).toBeVisible()
    await page.waitForTimeout(500)
    await expect.poll(() => offending.length).toBe(0)
  })

  test('first load never loads @supabase/supabase-js chunk', async ({ page }) => {
    const chunkRequests: string[] = []
    page.on('request', req => {
      const url = req.url()
      // Match both the lazy sharingService-*.js chunk name and any stray
      // supabase-*.js filename (defensive).
      if (/(supabase|sharingService)/i.test(url) && /\.(js|mjs)(\?|$)/.test(url)) {
        chunkRequests.push(url)
      }
    })
    await completeOnboarding(page, 'Anna')
    await openFriendsTab(page)
    // Poke a couple more tabs to surface any lazy import. Tab label comes
    // from the German locale (t.nav.archive === 'Vermächtnis').
    const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
    await nav.getByRole('button', { name: 'Vermächtnis', exact: true }).click()
    await page.waitForTimeout(300)
    expect(chunkRequests).toEqual([])
  })
})

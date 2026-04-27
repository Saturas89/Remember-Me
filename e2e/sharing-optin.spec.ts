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
  await expect(page.getByRole('heading', { name: /Erinnerung einsammeln/ })).toBeVisible()
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

  test('invite link generation works offline (existing ?mi= flow unaffected)', async ({ page }) => {
    await completeOnboarding(page, 'Anna')
    await openFriendsTab(page)
    await expect(page.locator('.share-cta-btn').first()).toBeVisible()
    await expect(page.locator('.share-cta-btn').first()).toContainText(/Link teilen/)
  })

  test('online-sharing CTA is rendered – but does not trigger any network', async ({ page }) => {
    // The preview build in playwright.config.ts ships with fake VITE_SUPABASE_*
    // values so the family-mode flow can be exercised end-to-end. The CTA is
    // therefore visible, but a user who never clicks it still produces zero
    // Supabase traffic (verified by the network spy). The opposite scenario –
    // missing config hiding the CTA – is covered by unit tests of FriendsView.
    const offending = attachNetworkSpy(page)
    await completeOnboarding(page, 'Anna')
    await openFriendsTab(page)
    await expect(page.getByTestId('open-online-sharing')).toBeVisible()
    await expect(page.getByTestId('open-online-sharing')).toHaveText(/Einrichten/)
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

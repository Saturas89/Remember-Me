// Nightly tests for contact-removal cleanup against the production Supabase.
//
// These tests verify the fix from PR contact-removal-cleanup:
//   • Client-side FeedTab filter hides removed contact's memories immediately
//   • unshareAllWithFriend() cleans up share_recipients rows server-side
//
// Three scenarios are covered:
//   feed-hidden-after-remove      Alice shares → Bob sees → Bob removes Alice → feed empty
//   share-recipients-db-cleanup   Bob shares with Alice → Bob removes Alice → Alice's ACL row gone
//   own-memories-unaffected       Bob's own shares remain visible after removing Alice
//
// All three use real Supabase (no mock). afterEach deletes all auth users created
// by the test; FK ON DELETE CASCADE removes devices, shares, annotations etc.

import { test, expect } from '@playwright/test'
import {
  completeOnboarding,
  openFamilyHub,
  readDeviceIdentity,
  injectOnlineFriend,
  reopenFamilyHub,
  seedAnswer,
} from '../helpers/family-mode-helpers'
import {
  cleanupUsers,
  spawnRealDevice,
  supabaseAdmin,
  waitForRealShares,
} from './helpers'

// ── Shared swipe helper (mirrors family-mode-swipe-remove.spec.ts) ────────────

async function openContactsTab(page: import('@playwright/test').Page) {
  await page.getByRole('tab', { name: 'Kontakte' }).click()
  await expect(page.getByText('Verbundene Kontakte')).toBeVisible({ timeout: 10_000 })
}

async function swipeContactLeft(page: import('@playwright/test').Page) {
  const swipeEl = page.locator('.online-contact-swipe').first()
  await expect(swipeEl).toBeVisible({ timeout: 10_000 })
  const box = await swipeEl.boundingBox()
  if (!box) throw new Error('swipe element has no bounding box')
  const startX = box.x + 100
  const endX   = box.x - 20
  const midY   = box.y + box.height / 2
  await page.mouse.move(startX, midY)
  await page.mouse.down()
  await page.mouse.move(endX, midY, { steps: 10 })
  await page.mouse.up()
  // Allow the 260 ms fly-out animation + onRemoveContact async call to settle.
  await page.waitForTimeout(500)
}

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe('Kontakt entfernen – Feed & DB-Cleanup (Real-DB)', () => {
  const createdUsers: string[] = []
  const admin = supabaseAdmin()

  test.afterEach(async () => {
    await cleanupUsers(admin, createdUsers.splice(0))
  })

  // ── Test 1 ──────────────────────────────────────────────────────────────────
  test('feed-hidden-after-remove: Alices Memory verschwindet sofort aus Bobs Feed', async ({ browser }) => {
    test.setTimeout(120_000)

    const { ctx: aliceCtx, page: alice } = await spawnRealDevice(browser)
    const { ctx: bobCtx,   page: bob   } = await spawnRealDevice(browser)

    // Onboarding + Familienmodus für beide
    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)
    createdUsers.push(aliceId.deviceId)

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)
    createdUsers.push(bobId.deviceId)

    // Gegenseitig verlinken
    await injectOnlineFriend(alice, 'Bob',   bobId.deviceId,   bobId.publicKey)
    await injectOnlineFriend(bob,   'Alice', aliceId.deviceId, aliceId.publicKey)

    // Alice teilt eine Erinnerung
    await seedAnswer(alice, 'cr-q1', 'childhood', 'Kindheitserinnerung für Bob.')
    await reopenFamilyHub(alice)
    await waitForRealShares(admin, aliceId.deviceId, 1, 30_000)

    // Bob lädt neu → sieht Alices Memory im Feed
    await reopenFamilyHub(bob)
    const feedTab = bob.getByRole('tab', { name: /^Feed/ })
    await feedTab.click()
    const feedItem = bob.getByTestId('feed-item').first()
    await expect(feedItem).toBeVisible({ timeout: 30_000 })

    // Bob entfernt Alice per Swipe
    await openContactsTab(bob)
    await expect(bob.locator('.online-contact-swipe')).toHaveCount(1)
    await swipeContactLeft(bob)
    await expect(bob.locator('[data-testid="no-contacts-hint"]')).toBeVisible({ timeout: 5_000 })

    // Feed-Tab: Alices Memory darf nicht mehr angezeigt werden
    await bob.getByRole('tab', { name: /^Feed/ }).click()
    await expect(bob.getByTestId('feed-item')).toHaveCount(0, { timeout: 5_000 })

    // Empty-State-Hint sichtbar
    await expect(bob.getByTestId('feed-empty-hint')).toBeVisible({ timeout: 5_000 })

    await aliceCtx.close()
    await bobCtx.close()
  })

  // ── Test 2 ──────────────────────────────────────────────────────────────────
  test('share-recipients-db-cleanup: Bobs Share entfernt Alice als Empfängerin', async ({ browser }) => {
    test.setTimeout(120_000)

    const { ctx: aliceCtx, page: alice } = await spawnRealDevice(browser)
    const { ctx: bobCtx,   page: bob   } = await spawnRealDevice(browser)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)
    createdUsers.push(aliceId.deviceId)

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)
    createdUsers.push(bobId.deviceId)

    await injectOnlineFriend(alice, 'Bob',   bobId.deviceId,   bobId.publicKey)
    await injectOnlineFriend(bob,   'Alice', aliceId.deviceId, aliceId.publicKey)

    // Bob teilt eine Erinnerung (mit Alice als Empfängerin)
    await seedAnswer(bob, 'cr-q2', 'family', 'Bobs Erinnerung für Alice.')
    await reopenFamilyHub(bob)
    await waitForRealShares(admin, bobId.deviceId, 1, 30_000)

    // Verifizieren: Alice ist als Empfängerin in share_recipients eingetragen
    const { data: sharesBefore } = await admin
      .from('shares')
      .select('id')
      .eq('owner_id', bobId.deviceId)
    expect(sharesBefore?.length ?? 0).toBeGreaterThan(0)
    const shareId = sharesBefore![0].id

    const { data: recipientsBefore } = await admin
      .from('share_recipients')
      .select('recipient_id')
      .eq('share_id', shareId)
    expect(recipientsBefore?.map(r => r.recipient_id)).toContain(aliceId.deviceId)

    // Bob entfernt Alice per Swipe → unshareAllWithFriend() läuft im Hintergrund
    await openContactsTab(bob)
    await swipeContactLeft(bob)
    await expect(bob.locator('[data-testid="no-contacts-hint"]')).toBeVisible({ timeout: 8_000 })

    // Give the background unshareAllWithFriend() network request time to land
    // before the DB poll starts – important on slower CI runners (Samsung S23).
    await bob.waitForTimeout(1_500)

    // DB-Poll: Alice darf nicht mehr als Empfängerin in Bobs Share stehen.
    // Timeout raised to 40 s to handle CI network latency on real Supabase.
    await expect.poll(
      async () => {
        const { data } = await admin
          .from('share_recipients')
          .select('recipient_id')
          .eq('share_id', shareId)
          .eq('recipient_id', aliceId.deviceId)
        return data?.length ?? -1
      },
      { timeout: 40_000, intervals: [2_000] },
    ).toBe(0)

    await aliceCtx.close()
    await bobCtx.close()
  })

  // ── Test 3 ──────────────────────────────────────────────────────────────────
  test('own-memories-unaffected: Eigene Memories bleiben nach Kontakt-Entfernung sichtbar', async ({ browser }) => {
    test.setTimeout(120_000)

    const { ctx: aliceCtx, page: alice } = await spawnRealDevice(browser)
    const { ctx: bobCtx,   page: bob   } = await spawnRealDevice(browser)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)
    createdUsers.push(aliceId.deviceId)

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)
    createdUsers.push(bobId.deviceId)

    await injectOnlineFriend(alice, 'Bob',   bobId.deviceId,   bobId.publicKey)
    await injectOnlineFriend(bob,   'Alice', aliceId.deviceId, aliceId.publicKey)

    // Bob teilt eine eigene Erinnerung (bleibt sichtbar, da er selbst Eigentümer ist)
    await seedAnswer(bob, 'cr-q3', 'childhood', 'Bobs eigene Erinnerung.')
    await reopenFamilyHub(bob)
    await waitForRealShares(admin, bobId.deviceId, 1, 30_000)

    // The hub fetched its initial share list before the auto-share upload
    // completed.  Re-open the hub so fetchIncomingShares() runs again now
    // that the share is confirmed in the DB.
    await reopenFamilyHub(bob)

    // Bobs eigene Memory im Feed prüfen
    await bob.getByRole('tab', { name: /^Feed/ }).click()
    await expect(bob.getByTestId('feed-item').first()).toBeVisible({ timeout: 30_000 })

    // Bob entfernt Alice
    await openContactsTab(bob)
    await swipeContactLeft(bob)
    await expect(bob.locator('[data-testid="no-contacts-hint"]')).toBeVisible({ timeout: 5_000 })

    // Bobs eigene Memory muss noch im Feed stehen
    await bob.getByRole('tab', { name: /^Feed/ }).click()
    await expect(bob.getByTestId('feed-item').first()).toBeVisible({ timeout: 10_000 })
    const text = await bob.getByTestId('feed-item').first().textContent()
    expect(text).toContain('Bobs eigene Erinnerung.')

    await aliceCtx.close()
    await bobCtx.close()
  })
})

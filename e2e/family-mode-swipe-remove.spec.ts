import { test, expect } from '@playwright/test'
import {
  completeOnboarding,
  createMockState,
  injectOnlineFriend,
  openFamilyHub,
  readOnlineFriends,
  reopenFamilyHub,
  spawnDevice,
} from './helpers/family-mode-helpers'

// REQ-015 §4.2 – Kontakt per Swipe entfernen (FR-15.30).
//
// Verifies that a user can remove a linked contact by swiping the contact
// row fully to the left – no extra button tap required.

async function openContactsTab(page: import('@playwright/test').Page) {
  await page.getByRole('tab', { name: 'Einladen' }).click()
  await expect(page.getByText('Verbundene Kontakte')).toBeVisible()
}

async function swipeContactLeft(page: import('@playwright/test').Page) {
  const swipeEl = page.locator('.online-contact-swipe').first()
  await expect(swipeEl).toBeVisible()
  const box = await swipeEl.boundingBox()
  if (!box) throw new Error('swipe element has no bounding box')
  const startX = box.x + box.width - 20
  const endX = box.x + 10
  const midY = box.y + box.height / 2
  await page.mouse.move(startX, midY)
  await page.mouse.down()
  await page.mouse.move(endX, midY, { steps: 10 })
  await page.mouse.up()
}

test.describe('Familienmodus – Kontakt per Swipe entfernen (FR-15.30)', () => {
  test('vollständiger Swipe entfernt den Kontakt sofort ohne Button-Tap', async ({ browser }) => {
    const state = createMockState()
    const { ctx: aliceCtx, page: alice } = await spawnDevice(browser, state)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    await injectOnlineFriend(alice, 'Bob', 'device-bob', 'pubKeyBob')
    await reopenFamilyHub(alice)
    await openContactsTab(alice)

    await expect(alice.locator('.online-contact-swipe')).toHaveCount(1)

    await swipeContactLeft(alice)

    // After swipe: row flies out, hub falls back to onboarding (0 contacts)
    await expect(alice.getByRole('heading', { name: 'Jemanden einladen' })).toBeVisible({ timeout: 1500 })
    await expect(alice.locator('.online-contact-swipe')).toHaveCount(0)

    await aliceCtx.close()
  })

  test('Kontakt ist nach Reload dauerhaft entfernt (localStorage bereinigt)', async ({ browser }) => {
    const state = createMockState()
    const { ctx: aliceCtx, page: alice } = await spawnDevice(browser, state)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    await injectOnlineFriend(alice, 'Bob', 'device-bob', 'pubKeyBob')
    await reopenFamilyHub(alice)
    await openContactsTab(alice)

    await swipeContactLeft(alice)

    await expect(alice.locator('.online-contact-swipe')).toHaveCount(0, { timeout: 1500 })

    // Verify localStorage is clean
    const onlineFriends = await readOnlineFriends(alice)
    expect(onlineFriends).toHaveLength(0)

    await aliceCtx.close()
  })

  test('Mehrere Kontakte – nur geswiped Kontakt wird entfernt', async ({ browser }) => {
    const state = createMockState()
    const { ctx: aliceCtx, page: alice } = await spawnDevice(browser, state)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    await injectOnlineFriend(alice, 'Bob', 'device-bob', 'pubKeyBob')
    await injectOnlineFriend(alice, 'Clara', 'device-clara', 'pubKeyClara')
    await reopenFamilyHub(alice)
    await openContactsTab(alice)

    // Two contacts visible
    await expect(alice.locator('.online-contact-swipe')).toHaveCount(2)

    // Swipe the first one
    await swipeContactLeft(alice)

    // One contact remains
    await expect(alice.locator('.online-contact-swipe')).toHaveCount(1, { timeout: 1500 })

    await aliceCtx.close()
  })

  test('kurzer Swipe entfernt den Kontakt nicht', async ({ browser }) => {
    const state = createMockState()
    const { ctx: aliceCtx, page: alice } = await spawnDevice(browser, state)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    await injectOnlineFriend(alice, 'Bob', 'device-bob', 'pubKeyBob')
    await reopenFamilyHub(alice)
    await openContactsTab(alice)

    // Short swipe: only 30px to the left
    const swipeEl = alice.locator('.online-contact-swipe').first()
    await expect(swipeEl).toBeVisible()
    const box = await swipeEl.boundingBox()
    if (!box) throw new Error('swipe element has no bounding box')
    const midY = box.y + box.height / 2
    const startX = box.x + box.width / 2
    await alice.mouse.move(startX, midY)
    await alice.mouse.down()
    await alice.mouse.move(startX - 30, midY, { steps: 5 })
    await alice.mouse.up()

    // Contact still present
    await expect(alice.locator('.online-contact-swipe')).toHaveCount(1)

    await aliceCtx.close()
  })
})

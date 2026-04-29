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
// row to the left in the Contacts tab and confirming the removal.

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
  test('Entfernen-Button erscheint nach Swipe-left und verschwindet ohne Bestätigung', async ({ browser }) => {
    const state = createMockState()
    const { ctx: aliceCtx, page: alice } = await spawnDevice(browser, state)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    await injectOnlineFriend(alice, 'Bob', 'device-bob', 'pubKeyBob')
    await reopenFamilyHub(alice)
    await openContactsTab(alice)

    // Before swipe: remove button must be absent
    await expect(alice.locator('.online-contact-remove-btn')).toHaveCount(0)

    await swipeContactLeft(alice)

    // After swipe: remove button must be visible
    const removeBtn = alice.locator('.online-contact-remove-btn')
    await expect(removeBtn).toBeVisible()

    // Clicking the swipe area (not the button) resets the row
    await alice.locator('.online-contact-swipe').first().click()
    await expect(alice.locator('.online-contact-remove-btn')).toHaveCount(0)

    await aliceCtx.close()
  })

  test('Kontakt wird aus der Liste entfernt wenn Entfernen bestätigt wird', async ({ browser }) => {
    const state = createMockState()
    const { ctx: aliceCtx, page: alice } = await spawnDevice(browser, state)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    await injectOnlineFriend(alice, 'Bob', 'device-bob', 'pubKeyBob')
    await reopenFamilyHub(alice)
    await openContactsTab(alice)

    // Bob is listed
    await expect(alice.getByRole('listitem').filter({ hasText: 'Bob' })).toBeVisible()

    await swipeContactLeft(alice)
    await alice.locator('.online-contact-remove-btn').click()

    // Contact row is gone from the UI
    await expect(alice.locator('.online-contact-swipe')).toHaveCount(0)
    await expect(alice.getByText('Noch niemand verknüpft')).toBeVisible()

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
    await alice.locator('.online-contact-remove-btn').click()

    // After removal the hub falls back to the onboarding screen (0 contacts)
    // because onlineFriends.length drops to 0.
    await expect(alice.locator('.online-contact-swipe')).toHaveCount(0)

    // Verify localStorage is clean
    const onlineFriends = await readOnlineFriends(alice)
    expect(onlineFriends).toHaveLength(0)

    await aliceCtx.close()
  })

  test('Mehrere Kontakte – nur geswiped Kontakt hat Entfernen-Button', async ({ browser }) => {
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

    // Only one remove button
    await expect(alice.locator('.online-contact-remove-btn')).toHaveCount(1)

    // Confirm removal – one contact remains
    await alice.locator('.online-contact-remove-btn').click()
    await expect(alice.locator('.online-contact-swipe')).toHaveCount(1)

    await aliceCtx.close()
  })
})

import { test, expect } from '@playwright/test'
import {
  completeOnboarding,
  contactPath,
  createMockState,
  dismissInstallPrompt,
  installSupabaseMock,
  openFamilyHub,
  readDeviceIdentity,
  readOnlineFriends,
  spawnDevice,
} from './helpers/family-mode-helpers'

// REQ-015 §4.2 Kontakt-Handshake (FR-15.5 – FR-15.9).
//
// Two devices exchange `?contact=…` URLs and end up with each other in
// `friends[].online`. Also covers the case where the recipient has not yet
// opted in to online sharing — the screen offers the activation step first.

test.describe('Familienmodus – Kontakt-Handshake (FR-15.5 – FR-15.9)', () => {
  test('Empfänger sieht den Verbindungs-Screen mit Absendername', async ({ context, page }) => {
    await dismissInstallPrompt(context)
    await installSupabaseMock(context, createMockState())

    await page.goto(
      contactPath('Oma Erna', '00000000-0000-4000-8000-000000000001', 'PUBLIC_KEY_PLACEHOLDER'),
    )

    await expect(page.getByRole('heading', { name: 'Kontakt verknüpfen' })).toBeVisible()
    await expect(page.getByText(/Oma Erna/)).toBeVisible()
    await expect(page.getByRole('button', { name: /Online-Teilen einrichten/ })).toBeVisible()
  })

  test('Bidirektionale Verknüpfung zwischen zwei Geräten', async ({ browser }) => {
    const state = createMockState()
    const { ctx: aliceCtx, page: alice } = await spawnDevice(browser, state)
    const { ctx: bobCtx, page: bob } = await spawnDevice(browser, state)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)

    // Bob opens Alice's contact link → handshake auto-accepts on his side.
    await bob.goto(contactPath('Alice', aliceId.deviceId, aliceId.publicKey))
    await expect(bob.getByRole('heading', { name: 'Kontakt verknüpfen' })).toBeVisible()
    // The handshake screen mentions Alice's name twice (heading-line + the
    // post-accept "wurde in deiner Kontaktliste gespeichert" hint), so we
    // anchor on the first occurrence.
    await expect(bob.getByText(/Alice/).first()).toBeVisible()
    await expect(bob.getByRole('button', { name: /Meinen Link zurück senden/ })).toBeVisible()

    // REQ-022 §4.2: the share-all opt-in is visible AND checked by default.
    const shareAllCheckbox = bob.locator('[data-testid="contact-handshake-shareall"] input[type="checkbox"]')
    await expect(shareAllCheckbox).toBeVisible()
    await expect(shareAllCheckbox).toBeChecked()

    const bobsAlice = await readOnlineFriends(bob)
    expect(bobsAlice).toHaveLength(1)
    expect(bobsAlice[0]).toMatchObject({ name: 'Alice' })
    expect(bobsAlice[0].online?.deviceId).toBe(aliceId.deviceId)
    expect(bobsAlice[0].online?.shareAll).toBe(true)

    // Alice opens Bob's link → mirror-accept.
    await alice.goto(contactPath('Bob', bobId.deviceId, bobId.publicKey))
    await expect(alice.getByRole('heading', { name: 'Kontakt verknüpfen' })).toBeVisible()
    const alicesBob = await readOnlineFriends(alice)
    expect(alicesBob).toHaveLength(1)
    expect(alicesBob[0]).toMatchObject({ name: 'Bob' })
    expect(alicesBob[0].online?.deviceId).toBe(bobId.deviceId)
    expect(alicesBob[0].online?.shareAll).toBe(true)

    await aliceCtx.close()
    await bobCtx.close()
  })

  test('Checkbox abhaken speichert friend.online.shareAll = false', async ({ browser }) => {
    const state = createMockState()
    const { ctx: aliceCtx, page: alice } = await spawnDevice(browser, state)
    const { ctx: bobCtx, page: bob } = await spawnDevice(browser, state)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)

    await bob.goto(contactPath('Alice', aliceId.deviceId, aliceId.publicKey))
    const shareAllCheckbox = bob.locator('[data-testid="contact-handshake-shareall"] input[type="checkbox"]')
    await expect(shareAllCheckbox).toBeChecked()
    await shareAllCheckbox.uncheck()

    // ContactHandshakeView re-fires onAcceptContact on toggle so the friend
    // upsert path picks up the new shareAll value.
    await bob.waitForFunction(() => {
      type Bridge = { get: () => Record<string, unknown> | null }
      const bridge = (window as unknown as { __rmState?: Bridge }).__rmState
      const s = bridge?.get() ?? {}
      const friends = (s.friends as Array<{ online?: { shareAll?: boolean } }>) ?? []
      return friends.length > 0 && friends[0].online?.shareAll === false
    }, undefined, { timeout: 5_000 })

    const bobsAlice = await readOnlineFriends(bob)
    expect(bobsAlice[0].online?.shareAll).toBe(false)

    await aliceCtx.close()
    await bobCtx.close()
  })

  test('Handshake-Link ohne Opt-in bietet zuerst die Aktivierung an', async ({ browser }) => {
    const state = createMockState()
    const { ctx: aliceCtx, page: alice } = await spawnDevice(browser, state)
    const { ctx: bobCtx, page: bob } = await spawnDevice(browser, state)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)

    // Bob has onboarded but never opted in to online sharing.
    await completeOnboarding(bob, 'Bob')
    await bob.goto(contactPath('Alice', aliceId.deviceId, aliceId.publicKey))

    const enableBtn = bob.getByRole('button', { name: /Online-Teilen einrichten/ })
    await expect(enableBtn).toBeVisible()
    await expect(bob.getByRole('button', { name: /Meinen Link zurück senden/ })).toHaveCount(0)

    // Clicking it kicks off the bootstrap and the screen swaps to the
    // "send my link back" CTA – proving FR-15.9 wiring works.
    await enableBtn.click()
    await expect(
      bob.getByRole('button', { name: /Meinen Link zurück senden/ }),
    ).toBeVisible({ timeout: 15_000 })

    await aliceCtx.close()
    await bobCtx.close()
  })
})

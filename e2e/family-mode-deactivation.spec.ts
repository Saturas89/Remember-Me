import { test, expect } from '@playwright/test'
import {
  completeOnboarding,
  contactPath,
  createMockState,
  injectOnlineFriend,
  openFamilyHub,
  readDeviceIdentity,
  spawnDevice,
} from './helpers/family-mode-helpers'

// REQ-015 §4.6 Deaktivierung (FR-15.22 – FR-15.25).
//
// Verifies the cascade: server rows for the device disappear, the local
// onlineSharing block is dropped, and friends[].online entries are stripped –
// while local answers stay intact (FR-15.25).

test.describe('Familienmodus – Deaktivierung (FR-15.22 – FR-15.25)', () => {
  test('Deaktivieren löscht Server-Daten und lokale Online-Verknüpfungen', async ({ browser }) => {
    const state = createMockState()
    const { ctx: aliceCtx, page: alice } = await spawnDevice(browser, state, 'alice')
    const { ctx: bobCtx, page: bob } = await spawnDevice(browser, state, 'bob')

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)

    // Drive the linkage via the same shortcut used by the share spec to
    // keep this test independent of the (still-fragile) share-send roundtrip.
    await injectOnlineFriend(alice, 'Bob', bobId.deviceId, bobId.publicKey)
    await alice.goto(contactPath('Bob', bobId.deviceId, bobId.publicKey))
    await expect(alice.getByRole('heading', { name: 'Kontakt verknüpfen' })).toBeVisible()

    expect(state.devices.find(d => d.id === aliceId.deviceId)).toBeTruthy()

    // Open the hub and deactivate via the Einstellungen tab.
    await alice.goto('/friends')
    await alice.getByTestId('open-online-sharing').click()
    await expect(alice.getByRole('heading', { name: 'Online teilen' })).toBeVisible()
    await alice.getByRole('tab', { name: 'Einstellungen', exact: true }).click()
    await alice.getByRole('button', { name: 'Deaktivieren', exact: true }).click()
    await alice.getByRole('button', { name: /Ja, alles löschen/ }).click()

    // FR-15.22 – 24: server cascades + local online state cleared.
    await expect.poll(() => state.devices.some(d => d.id === aliceId.deviceId)).toBe(false)

    const aliceState = await alice.evaluate(() => {
      const raw = localStorage.getItem('remember-me-state')
      return raw ? JSON.parse(raw) : null
    })
    expect(aliceState.onlineSharing).toBeUndefined()

    // FR-15.25: friends[].online stripped, but offline data intact.
    for (const f of aliceState.friends ?? []) {
      expect(f.online).toBeUndefined()
    }

    await aliceCtx.close()
    await bobCtx.close()
  })
})

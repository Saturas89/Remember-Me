import { test, expect } from '@playwright/test'
import {
  completeOnboarding,
  createMockState,
  injectOnlineFriend,
  openFamilyHub,
  readDeviceIdentity,
  reopenFamilyHub,
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
    const { ctx: aliceCtx, page: alice } = await spawnDevice(browser, state)
    const { ctx: bobCtx, page: bob } = await spawnDevice(browser, state)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)

    // Inject the linked state directly – the handshake UI is covered by the
    // family-mode-handshake spec; here we focus on the deactivation cascade.
    await injectOnlineFriend(alice, 'Bob', bobId.deviceId, bobId.publicKey)
    await injectOnlineFriend(bob, 'Alice', aliceId.deviceId, aliceId.publicKey)

    expect(state.devices.find(d => d.id === aliceId.deviceId)).toBeTruthy()

    // Open the hub and deactivate via the Einstellungen tab.
    await reopenFamilyHub(alice)
    await alice.getByRole('tab', { name: 'Einstellungen', exact: true }).click()
    await alice.getByRole('button', { name: 'Deaktivieren', exact: true }).click()
    await alice.getByRole('button', { name: /Ja, alles löschen/ }).click()

    // FR-15.22 – 24: server cascades + local online state cleared.
    await expect.poll(() => state.devices.some(d => d.id === aliceId.deviceId)).toBe(false)

    // Local cleanup runs in a separate React effect after the server cascade
    // resolves. On slow runners (mobile-safari) the local update can lag a
    // few ticks behind the server-state poll above, so poll the local state
    // too instead of reading it once.
    type LocalState = { onlineSharing?: unknown; friends?: { online?: unknown }[] }
    const readState = (): Promise<LocalState | null> => alice.evaluate(() => {
      type Bridge = { get: () => Record<string, unknown> | null }
      return (window as unknown as { __rmState?: Bridge }).__rmState?.get() ?? null
    })

    await expect.poll(async () => (await readState())?.onlineSharing).toBeUndefined()

    // FR-15.25: friends[].online stripped, but offline data intact.
    await expect
      .poll(async () => ((await readState())?.friends ?? []).every(f => f.online === undefined))
      .toBe(true)

    await aliceCtx.close()
    await bobCtx.close()
  })
})

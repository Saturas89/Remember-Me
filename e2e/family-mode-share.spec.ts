import { test, expect } from '@playwright/test'
import {
  completeOnboarding,
  contactPath,
  createMockState,
  injectOnlineFriend,
  openFamilyHub,
  readDeviceIdentity,
  reopenFamilyHub,
  seedAnswer,
  spawnDevice,
  waitForOnlineFriend,
} from './helpers/family-mode-helpers'

// REQ-015 §4.3 – §4.5 Erinnerung teilen, empfangen, ergänzen
// (FR-15.10 – FR-15.21).
//
// Two specs:
//   • the share-tab guard rails (button enables only when both a memory and
//     at least one recipient are picked),
//   • the full Alice → Bob roundtrip: encrypt + upload, recipient fetches
//     and decrypts, recipient adds an Ergänzung, sender receives it back.
//
// The send-roundtrip uses `injectOnlineFriend` to skip the handshake reload
// dance (covered exhaustively in family-mode-handshake.spec.ts) and stay
// focused on the encryption / sync path.

test.describe('Familienmodus – Erinnerung teilen, empfangen, ergänzen (FR-15.10 – FR-15.21)', () => {
  test('Senden ist gesperrt, solange Empfänger oder Erinnerung fehlen', async ({ browser }) => {
    const state = createMockState()
    const { ctx: aliceCtx, page: alice } = await spawnDevice(browser, state)
    const { ctx: bobCtx, page: bob } = await spawnDevice(browser, state)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)
    await seedAnswer(alice, 'childhood-01', 'childhood', 'Eine kleine Erinnerung.')

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)

    await bob.goto(contactPath('Alice', aliceId.deviceId, aliceId.publicKey))
    await expect(bob.getByRole('heading', { name: 'Kontakt verknüpfen' })).toBeVisible()
    await alice.goto(contactPath('Bob', bobId.deviceId, bobId.publicKey))
    await expect(alice.getByRole('heading', { name: 'Kontakt verknüpfen' })).toBeVisible()
    await waitForOnlineFriend(alice)

    await reopenFamilyHub(alice)
    await alice.getByRole('tab', { name: 'Teilen', exact: true }).click()

    const send = alice.getByRole('button', { name: /Verschlüssele & sende/ })
    await expect(send).toBeDisabled()

    // Pick a memory only → still disabled (no recipient).
    await alice.getByText('Eine kleine Erinnerung.').click()
    await expect(send).toBeDisabled()

    // Pick a recipient → enabled.
    await alice.locator('.share-recipient-chip', { hasText: 'Bob' }).click()
    await expect(send).toBeEnabled()

    await aliceCtx.close()
    await bobCtx.close()
  })

  test('Alice teilt Erinnerung mit Bob, Bob ergänzt sie zurück', async ({ browser }) => {
    test.setTimeout(60_000)
    const state = createMockState()
    const { ctx: aliceCtx, page: alice } = await spawnDevice(browser, state)
    const { ctx: bobCtx, page: bob } = await spawnDevice(browser, state)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)
    await seedAnswer(alice, 'childhood-01', 'childhood', 'Ich bin in Cuxhaven am Meer aufgewachsen.')

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)

    // Skip the contact-handshake reload dance (covered by handshake spec).
    await injectOnlineFriend(alice, 'Bob', bobId.deviceId, bobId.publicKey)
    await injectOnlineFriend(bob, 'Alice', aliceId.deviceId, aliceId.publicKey)

    await reopenFamilyHub(alice)
    await alice.getByRole('tab', { name: 'Teilen', exact: true }).click()

    await alice.getByText('Ich bin in Cuxhaven am Meer aufgewachsen.').click()
    await alice.locator('.share-recipient-chip', { hasText: 'Bob' }).click()
    await alice.getByRole('button', { name: /Verschlüssele & sende/ }).click()
    await expect(alice.getByRole('button', { name: /Gesendet/ })).toBeVisible({ timeout: 10_000 })

    expect(state.shares).toHaveLength(1)
    expect(state.shares[0].owner_id).toBe(aliceId.deviceId)
    expect(typeof state.shares[0].ciphertext).toBe('string')
    expect((state.shares[0].ciphertext as string).startsWith('\\x')).toBe(true)
    expect(JSON.stringify(state.shares[0].ciphertext)).not.toContain('Cuxhaven')

    const recipients = state.share_recipients
      .filter(r => r.share_id === state.shares[0].id)
      .map(r => r.recipient_id)
    expect(recipients).toContain(aliceId.deviceId)
    expect(recipients).toContain(bobId.deviceId)

    await reopenFamilyHub(bob)
    await bob.getByRole('tab', { name: /^Feed\b/ }).click()
    await expect(bob.getByText('Ich bin in Cuxhaven am Meer aufgewachsen.')).toBeVisible({ timeout: 15_000 })
    await expect(bob.locator('.shared-memory-card')).toContainText('Alice')

    await bob.getByLabel('Ergänzung hinzufügen').fill('Ich erinnere mich noch an euer Reetdach!')
    await bob.getByRole('button', { name: 'Ergänzung senden' }).click()
    await expect(bob.getByRole('button', { name: /Gesendet/ })).toBeVisible({ timeout: 10_000 })

    expect(state.annotations).toHaveLength(1)
    expect(state.annotations[0].author_id).toBe(bobId.deviceId)

    await reopenFamilyHub(alice)
    await expect(alice.getByText('Ich erinnere mich noch an euer Reetdach!')).toBeVisible({ timeout: 15_000 })
    await expect(alice.locator('.shared-memory-annotations')).toContainText('Bob')

    await aliceCtx.close()
    await bobCtx.close()
  })
})

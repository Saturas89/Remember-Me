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
  waitForShares,
} from './helpers/family-mode-helpers'

// REQ-022 §4.3 / §4.4 – auto-share queue + per-contact pause.
//
// The legacy "Teilen" tab is gone. Sharing is now binary per contact and
// driven by useAutoShare: every saved Answer flows to every friend whose
// online.shareAll === true. Pausing a friend deletes the server ACL on shares
// we own and clears the local share-log so a later toggle-on backfills.

test.describe('Familienmodus – Auto-Share & Pause (REQ-022)', () => {
  test('Alice teilt automatisch mit Bob, Bob ergänzt sie zurück', async ({ browser }) => {
    test.setTimeout(60_000)
    const state = createMockState()
    const { ctx: aliceCtx, page: alice } = await spawnDevice(browser, state)
    const { ctx: bobCtx, page: bob } = await spawnDevice(browser, state)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)

    // Skip the contact-handshake reload dance (covered by handshake spec) but
    // mirror what the real flow puts into localStorage – including shareAll.
    await injectOnlineFriend(alice, 'Bob', bobId.deviceId, bobId.publicKey, true)
    await injectOnlineFriend(bob, 'Alice', aliceId.deviceId, aliceId.publicKey, true)

    // seedAnswer writes to localStorage but does NOT mutate React state in
    // the already-loaded page; seed BEFORE reopen so useAutoShare sees the
    // answer when the hub re-mounts.
    await seedAnswer(alice, 'childhood-01', 'childhood', 'Ich bin in Cuxhaven am Meer aufgewachsen.')
    await reopenFamilyHub(alice)

    // 2 recipients: Alice (owner, added implicitly) + Bob
    await waitForShares(state, 1, 20_000, 2)

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

  test('Alice pausiert Bob – Server-ACL für Bob ist weg, sein Feed leer', async ({ browser }) => {
    test.setTimeout(60_000)
    const state = createMockState()
    const { ctx: aliceCtx, page: alice } = await spawnDevice(browser, state)
    const { ctx: bobCtx, page: bob } = await spawnDevice(browser, state)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)

    await injectOnlineFriend(alice, 'Bob', bobId.deviceId, bobId.publicKey, true)
    await injectOnlineFriend(bob, 'Alice', aliceId.deviceId, aliceId.publicKey, true)

    await seedAnswer(alice, 'childhood-02', 'childhood', 'Sommer in den Alpen.')
    await reopenFamilyHub(alice)
    // 2 recipients: Alice (owner, implicit) + Bob
    await waitForShares(state, 1, 20_000, 2)

    // Initial: 2 ACL rows (Alice + Bob).
    expect(state.share_recipients.filter(r => r.share_id === state.shares[0].id)).toHaveLength(2)

    // Bob can see it.
    await reopenFamilyHub(bob)
    await bob.getByRole('tab', { name: /^Feed\b/ }).click()
    await expect(bob.getByText('Sommer in den Alpen.')).toBeVisible({ timeout: 15_000 })

    // Alice opens contacts, toggles Bob off, confirms.
    await reopenFamilyHub(alice)
    await alice.getByRole('tab', { name: /Kontakte/ }).click()
    const friendId = await alice.evaluate((bobDeviceId: string) => {
      type Bridge = { get: () => Record<string, unknown> | null }
      const bridge = (window as unknown as { __rmState?: Bridge }).__rmState
      const state = bridge?.get() ?? {}
      const friends = (state.friends as Array<{ id: string; online?: { deviceId: string } }>) ?? []
      return friends.find(f => f.online?.deviceId === bobDeviceId)!.id
    }, bobId.deviceId)
    await alice.locator(`[data-testid="shareall-toggle-${friendId}"] input`).click()
    await expect(alice.locator(`[data-testid="pause-confirm-${friendId}"]`)).toBeVisible()
    await alice.locator(`[data-testid="pause-confirm-yes-${friendId}"]`).click()
    await expect(alice.locator(`[data-testid="pause-confirm-${friendId}"]`)).toBeHidden({ timeout: 10_000 })

    // Bob is removed from the ACL; Alice's own ACL row stays. The Bob-sees-
    // empty-feed assertion lives in the nightly real-DB suite where Supabase
    // RLS is actually enforced – the in-memory mock doesn't filter shares
    // by recipient, so Bob would still decrypt locally even though his
    // server ACL row is gone.
    const remaining = state.share_recipients
      .filter(r => r.share_id === state.shares[0].id)
      .map(r => r.recipient_id)
    expect(remaining).toContain(aliceId.deviceId)
    expect(remaining).not.toContain(bobId.deviceId)

    await aliceCtx.close()
    await bobCtx.close()
  })
})

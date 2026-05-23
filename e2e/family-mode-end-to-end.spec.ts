import { test, expect } from '@playwright/test'
import {
  completeOnboarding,
  createMockState,
  injectOnlineFriend,
  invitePath,
  openFamilyHub,
  readDeviceIdentity,
  readOnlineFriends,
  reopenFamilyHub,
  seedAnswer,
  seedInvite,
  spawnDevice,
  waitForShares,
} from './helpers/family-mode-helpers'

// REQ-015 – komplette Einladungs- und Teilen-Kette in einem einzigen Lauf.
//
// Verkettet Aktivierung → Handshake (neuer /join/-Flow) → Erinnerung teilen
// → Ergänzen, ohne den `injectOnlineFriend`-Shortcut für den primären
// Invite-Flow (Bobs Seite). Sandras Auto-Add via usePendingInviteResponses
// wird mit injectOnlineFriend simuliert, da das 5-Minuten-Polling in E2E
// nicht praktikabel wartet – der Hook selbst wird separat unit-getestet.

test.describe('Familienmodus – Komplette Einladungs- und Teilen-Kette', () => {
  test('Alice lädt Bob ein, Bob nimmt an, Alice teilt, Bob ergänzt zurück', async ({ browser }) => {
    test.setTimeout(120_000)
    const state = createMockState()
    const { ctx: aliceCtx, page: alice } = await spawnDevice(browser, state)
    const { ctx: bobCtx, page: bob } = await spawnDevice(browser, state)

    // 1) Beide Geräte aktivieren den Familienmodus.
    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)
    await seedAnswer(alice, 'childhood-01', 'childhood', 'Ich bin in Cuxhaven am Meer aufgewachsen.')

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)

    // 2) Alice erstellt einen Einladungslink (direkt in Mock geseedet).
    //    Bob öffnet den /join/-Link → PersonalPackReceiveView → ContactHandshakeView.
    const inviteCode = seedInvite(state, {
      senderName: 'Alice',
      senderDeviceId: aliceId.deviceId,
      senderPublicKey: aliceId.publicKey,
    })
    await bob.goto(invitePath(inviteCode))

    // PersonalPackReceiveView: enter name and answer the pack question.
    await expect(bob.getByText(/Alice/i)).toBeVisible({ timeout: 15_000 })
    const nameInput = bob.getByTestId('sandra-receive-name')
    if (await nameInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await nameInput.fill('Bob')
      await bob.getByTestId('sandra-receive-start').click()
    } else {
      const existingStart = bob.getByTestId('sandra-receive-existing-start')
      if (await existingStart.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await existingStart.click()
      }
    }
    const answerBox = bob.getByTestId('sandra-receive-answer')
    if (await answerBox.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await answerBox.fill('Schöne Erinnerung!')
      await bob.getByTestId('sandra-receive-continue').click()
    }

    // ContactHandshakeView auto-accepts Alice (online sharing is active).
    await bob.waitForFunction(() => {
      type Bridge = { get: () => Record<string, unknown> | null }
      const bridge = (window as unknown as { __rmState?: Bridge }).__rmState
      const s = bridge?.get() ?? {}
      const friends = (s.friends as Array<{ online?: { deviceId: string } }>) ?? []
      return friends.some(f => f.online?.deviceId)
    }, undefined, { timeout: 20_000 })

    const bobsFriends = await readOnlineFriends(bob)
    expect(bobsFriends.map(f => f.name)).toContain('Alice')
    expect(bobsFriends[0].online?.deviceId).toBe(aliceId.deviceId)

    // 3) Bob's contact is written to invites.response.
    //    Alice's usePendingInviteResponses hook normally polls every 5 min –
    //    inject directly for test speed (the hook is unit-tested separately).
    await injectOnlineFriend(alice, 'Bob', bobId.deviceId, bobId.publicKey)

    // 4) Alice geht zurück in den Hub — die Erinnerung wird per Auto-Share
    //    automatisch an Bob verschickt (REQ-022). Kein Picker mehr.
    await reopenFamilyHub(alice)
    await waitForShares(state, 1, 20_000)

    // Wire-Encryption: der Klartext darf nicht unverschlüsselt im Share landen.
    expect(state.shares).toHaveLength(1)
    expect(typeof state.shares[0].ciphertext).toBe('string')
    expect((state.shares[0].ciphertext as string).startsWith('\\x')).toBe(true)
    expect(JSON.stringify(state.shares[0].ciphertext)).not.toContain('Cuxhaven')

    // 5) Bob entdeckt die Erinnerung im Feed und sieht den entschlüsselten Klartext.
    await reopenFamilyHub(bob)
    await bob.getByRole('tab', { name: /^Feed\b/ }).click()
    await expect(bob.getByText('Ich bin in Cuxhaven am Meer aufgewachsen.')).toBeVisible({ timeout: 15_000 })
    await expect(bob.locator('.shared-memory-card')).toContainText('Alice')

    // 6) Bob ergänzt eine eigene Erinnerung dazu.
    await bob.getByLabel('Ergänzung hinzufügen').fill('Ich erinnere mich noch an euer Reetdach!')
    await bob.getByRole('button', { name: 'Ergänzung senden' }).click()
    await expect(bob.getByRole('button', { name: /Gesendet/ })).toBeVisible({ timeout: 10_000 })

    expect(state.annotations).toHaveLength(1)
    expect(state.annotations[0].author_id).toBe(bobId.deviceId)

    // 7) Alice sieht Bobs Ergänzung zurück.
    await reopenFamilyHub(alice)
    await expect(alice.getByText('Ich erinnere mich noch an euer Reetdach!')).toBeVisible({ timeout: 15_000 })
    await expect(alice.locator('.shared-memory-annotations')).toContainText('Bob')

    await aliceCtx.close()
    await bobCtx.close()
  })
})

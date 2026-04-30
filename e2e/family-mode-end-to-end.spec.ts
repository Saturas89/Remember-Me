import { test, expect } from '@playwright/test'
import {
  completeOnboarding,
  contactPath,
  createMockState,
  openFamilyHub,
  readDeviceIdentity,
  readOnlineFriends,
  reopenFamilyHub,
  seedAnswer,
  spawnDevice,
} from './helpers/family-mode-helpers'

// REQ-015 – komplette Einladungs- und Teilen-Kette in einem einzigen Lauf.
//
// Verkettet Aktivierung → Handshake → Erinnerung teilen → Ergänzen,
// ohne den `injectOnlineFriend`-Shortcut, den die isolierten Specs zur
// Stabilisierung benutzen. Dadurch wird die echte UI-Pipeline End-to-End
// gegen den Supabase-Mock getrieben, statt nur die Teilstücke einzeln.

test.describe('Familienmodus – Komplette Einladungs- und Teilen-Kette', () => {
  test('Alice lädt Bob ein, Bob nimmt an, Alice teilt, Bob ergänzt zurück', async ({ browser }) => {
    test.setTimeout(90_000)
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

    // 2) Bob öffnet Alices Einladungslink → Auto-Accept auf Bobs Seite.
    await bob.goto(contactPath('Alice', aliceId.deviceId, aliceId.publicKey))
    await expect(bob.getByRole('heading', { name: 'Kontakt verknüpfen' })).toBeVisible()
    await expect(bob.getByText(/Alice/).first()).toBeVisible()
    await expect(bob.getByRole('button', { name: /Meinen Link zurück senden/ })).toBeVisible()

    const bobsAlice = await readOnlineFriends(bob)
    expect(bobsAlice).toHaveLength(1)
    expect(bobsAlice[0]).toMatchObject({ name: 'Alice' })
    expect(bobsAlice[0].online?.deviceId).toBe(aliceId.deviceId)

    // 3) Alice öffnet Bobs Rück-Link → Mirror-Accept.
    await alice.goto(contactPath('Bob', bobId.deviceId, bobId.publicKey))
    await expect(alice.getByRole('heading', { name: 'Kontakt verknüpfen' })).toBeVisible()
    await expect(alice.getByRole('button', { name: /Meinen Link zurück senden/ })).toBeVisible()
    const alicesBob = await readOnlineFriends(alice)
    expect(alicesBob).toHaveLength(1)
    expect(alicesBob[0]).toMatchObject({ name: 'Bob' })
    expect(alicesBob[0].online?.deviceId).toBe(bobId.deviceId)

    // 4) Alice geht zurück in den Hub und sendet die Erinnerung an Bob.
    await reopenFamilyHub(alice)
    await alice.getByRole('tab', { name: 'Teilen', exact: true }).click()
    await alice.getByText('Ich bin in Cuxhaven am Meer aufgewachsen.').click()
    await alice.locator('.share-recipient-chip', { hasText: 'Bob' }).click()
    await alice.getByRole('button', { name: /Verschlüssele & sende/ }).click()
    await expect(alice.getByRole('button', { name: /Gesendet/ })).toBeVisible({ timeout: 10_000 })

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

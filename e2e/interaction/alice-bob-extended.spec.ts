import { test, expect } from '@playwright/test'
import {
  completeOnboarding,
  createMockState,
  injectOnlineFriend,
  openFamilyHub,
  readDeviceIdentity,
  reopenFamilyHub,
  seedAnswer,
  spawnDevice,
} from '../helpers/family-mode-helpers'

// Extended two-/three-device interaction scenarios not covered by the isolated
// family-mode-*.spec.ts suite: multi-recipient sharing, sequential shares,
// bidirectional flow, and content integrity under rich Unicode payloads.

test.describe('Erweiterte Mehrgeräte-Szenarien', () => {
  test('Drei Geräte: Alice teilt mit Bob und Carol gleichzeitig', async ({ browser }) => {
    test.setTimeout(150_000)
    const state = createMockState()
    const { ctx: aliceCtx, page: alice } = await spawnDevice(browser, state)
    const { ctx: bobCtx, page: bob } = await spawnDevice(browser, state)
    const { ctx: carolCtx, page: carol } = await spawnDevice(browser, state)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)
    await seedAnswer(alice, 'childhood-01', 'childhood', 'Meine liebste Kindheitserinnerung.')

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)

    await completeOnboarding(carol, 'Carol')
    await openFamilyHub(carol)
    const carolId = await readDeviceIdentity(carol)

    await injectOnlineFriend(alice, 'Bob', bobId.deviceId, bobId.publicKey)
    await injectOnlineFriend(alice, 'Carol', carolId.deviceId, carolId.publicKey)
    await injectOnlineFriend(bob, 'Alice', aliceId.deviceId, aliceId.publicKey)
    await injectOnlineFriend(carol, 'Alice', aliceId.deviceId, aliceId.publicKey)

    await reopenFamilyHub(alice)
    await alice.getByRole('tab', { name: 'Teilen', exact: true }).click()
    await alice.getByText('Meine liebste Kindheitserinnerung.').click()
    await alice.locator('.share-recipient-chip', { hasText: 'Bob' }).click()
    await alice.locator('.share-recipient-chip', { hasText: 'Carol' }).click()
    await alice.getByRole('button', { name: /Verschlüssele & sende/ }).click()
    await expect(alice.getByRole('button', { name: /Gesendet/ })).toBeVisible({ timeout: 10_000 })

    expect(state.shares).toHaveLength(1)
    const recipients = state.share_recipients
      .filter(r => r.share_id === state.shares[0].id)
      .map(r => r.recipient_id as string)
    expect(recipients).toContain(aliceId.deviceId)
    expect(recipients).toContain(bobId.deviceId)
    expect(recipients).toContain(carolId.deviceId)

    await reopenFamilyHub(bob)
    await bob.getByRole('tab', { name: /^Feed\b/ }).click()
    await expect(bob.getByText('Meine liebste Kindheitserinnerung.')).toBeVisible({ timeout: 15_000 })

    await reopenFamilyHub(carol)
    await carol.getByRole('tab', { name: /^Feed\b/ }).click()
    await expect(carol.getByText('Meine liebste Kindheitserinnerung.')).toBeVisible({ timeout: 15_000 })

    await bob.getByLabel('Ergänzung hinzufügen').fill('Bobs Ergänzung.')
    await bob.getByRole('button', { name: 'Ergänzung senden' }).click()
    await expect(bob.getByRole('button', { name: /Gesendet/ })).toBeVisible({ timeout: 10_000 })

    await carol.getByLabel('Ergänzung hinzufügen').fill('Carols Ergänzung.')
    await carol.getByRole('button', { name: 'Ergänzung senden' }).click()
    await expect(carol.getByRole('button', { name: /Gesendet/ })).toBeVisible({ timeout: 10_000 })

    expect(state.annotations).toHaveLength(2)

    await reopenFamilyHub(alice)
    await expect(alice.getByText('Bobs Ergänzung.')).toBeVisible({ timeout: 15_000 })
    await expect(alice.getByText('Carols Ergänzung.')).toBeVisible({ timeout: 15_000 })

    await aliceCtx.close()
    await bobCtx.close()
    await carolCtx.close()
  })

  test('Drei aufeinanderfolgende Erinnerungen werden alle zugestellt', async ({ browser }) => {
    test.setTimeout(120_000)
    const state = createMockState()
    const { ctx: aliceCtx, page: alice } = await spawnDevice(browser, state)
    const { ctx: bobCtx, page: bob } = await spawnDevice(browser, state)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)

    await injectOnlineFriend(alice, 'Bob', bobId.deviceId, bobId.publicKey)
    await injectOnlineFriend(bob, 'Alice', aliceId.deviceId, aliceId.publicKey)

    const memories = [
      { id: 'seq-q1', cat: 'childhood', text: 'Sequenz-Erinnerung Nummer eins.' },
      { id: 'seq-q2', cat: 'family', text: 'Sequenz-Erinnerung Nummer zwei.' },
      { id: 'seq-q3', cat: 'love', text: 'Sequenz-Erinnerung Nummer drei.' },
    ]

    for (const m of memories) {
      await seedAnswer(alice, m.id, m.cat, m.text)
    }

    for (const m of memories) {
      await reopenFamilyHub(alice)
      await alice.getByRole('tab', { name: 'Teilen', exact: true }).click()
      await alice.getByText(m.text).click()
      await alice.locator('.share-recipient-chip', { hasText: 'Bob' }).click()
      await alice.getByRole('button', { name: /Verschlüssele & sende/ }).click()
      await expect(alice.getByRole('button', { name: /Gesendet/ })).toBeVisible({ timeout: 10_000 })
    }

    expect(state.shares).toHaveLength(3)

    await reopenFamilyHub(bob)
    await bob.getByRole('tab', { name: /^Feed\b/ }).click()
    for (const m of memories) {
      await expect(bob.getByText(m.text)).toBeVisible({ timeout: 20_000 })
    }

    await aliceCtx.close()
    await bobCtx.close()
  })

  test('Bidirektionales Teilen: Alice und Bob tauschen je eine Erinnerung aus', async ({ browser }) => {
    test.setTimeout(120_000)
    const state = createMockState()
    const { ctx: aliceCtx, page: alice } = await spawnDevice(browser, state)
    const { ctx: bobCtx, page: bob } = await spawnDevice(browser, state)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)
    await seedAnswer(alice, 'bi-q-alice', 'childhood', 'Alices persönliche Erinnerung.')

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)
    await seedAnswer(bob, 'bi-q-bob', 'family', 'Bobs persönliche Erinnerung.')

    await injectOnlineFriend(alice, 'Bob', bobId.deviceId, bobId.publicKey)
    await injectOnlineFriend(bob, 'Alice', aliceId.deviceId, aliceId.publicKey)

    await reopenFamilyHub(alice)
    await alice.getByRole('tab', { name: 'Teilen', exact: true }).click()
    await alice.getByText("Alices persönliche Erinnerung.").click()
    await alice.locator('.share-recipient-chip', { hasText: 'Bob' }).click()
    await alice.getByRole('button', { name: /Verschlüssele & sende/ }).click()
    await expect(alice.getByRole('button', { name: /Gesendet/ })).toBeVisible({ timeout: 10_000 })

    await reopenFamilyHub(bob)
    await bob.getByRole('tab', { name: 'Teilen', exact: true }).click()
    await bob.getByText("Bobs persönliche Erinnerung.").click()
    await bob.locator('.share-recipient-chip', { hasText: 'Alice' }).click()
    await bob.getByRole('button', { name: /Verschlüssele & sende/ }).click()
    await expect(bob.getByRole('button', { name: /Gesendet/ })).toBeVisible({ timeout: 10_000 })

    expect(state.shares).toHaveLength(2)
    const owners = state.shares.map(s => s.owner_id as string)
    expect(owners).toContain(aliceId.deviceId)
    expect(owners).toContain(bobId.deviceId)

    await reopenFamilyHub(bob)
    await bob.getByRole('tab', { name: /^Feed\b/ }).click()
    await expect(bob.getByText("Alices persönliche Erinnerung.")).toBeVisible({ timeout: 15_000 })

    await reopenFamilyHub(alice)
    await alice.getByRole('tab', { name: /^Feed\b/ }).click()
    await expect(alice.getByText("Bobs persönliche Erinnerung.")).toBeVisible({ timeout: 15_000 })

    await aliceCtx.close()
    await bobCtx.close()
  })

  test('Emojis, Umlaute und HTML-ähnliche Zeichen bleiben nach Verschlüsselung integer', async ({ browser }) => {
    test.setTimeout(90_000)
    const state = createMockState()
    const { ctx: aliceCtx, page: alice } = await spawnDevice(browser, state)
    const { ctx: bobCtx, page: bob } = await spawnDevice(browser, state)

    const richText =
      '🏖️ Sommer 1987 🌊: Ferien in der Lüneburger Heide. ' +
      'Spaß & Freude mit Ü-Ei, Käse, Öl — echte deutsche Küche äöüÄÖÜß. ' +
      '<b>Nicht fett</b> und <script>kein Skript</script>.'

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)
    await seedAnswer(alice, 'rich-q', 'childhood', richText)

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)

    await injectOnlineFriend(alice, 'Bob', bobId.deviceId, bobId.publicKey)
    await injectOnlineFriend(bob, 'Alice', aliceId.deviceId, aliceId.publicKey)

    await reopenFamilyHub(alice)
    await alice.getByRole('tab', { name: 'Teilen', exact: true }).click()
    await alice.getByText(/🏖️ Sommer 1987/).click()
    await alice.locator('.share-recipient-chip', { hasText: 'Bob' }).click()
    await alice.getByRole('button', { name: /Verschlüssele & sende/ }).click()
    await expect(alice.getByRole('button', { name: /Gesendet/ })).toBeVisible({ timeout: 10_000 })

    // Klartext darf nicht im Wire-Ciphertext stehen
    expect(JSON.stringify(state.shares[0].ciphertext)).not.toContain('Lüneburger')
    expect(JSON.stringify(state.shares[0].ciphertext)).not.toContain('kein Skript')

    await reopenFamilyHub(bob)
    await bob.getByRole('tab', { name: /^Feed\b/ }).click()
    const card = bob.locator('.shared-memory-card').first()
    await expect(card).toBeVisible({ timeout: 15_000 })

    await expect(card).toContainText('🏖️ Sommer 1987')
    await expect(card).toContainText('äöüÄÖÜß')
    // HTML-ähnliche Zeichen müssen als Text erscheinen, nicht gerendert werden
    await expect(card).toContainText('<b>Nicht fett</b>')
    await expect(card).toContainText('<script>kein Skript</script>')

    await aliceCtx.close()
    await bobCtx.close()
  })
})

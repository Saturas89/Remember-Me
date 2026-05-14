import { test, expect } from '@playwright/test'
import {
  completeOnboarding,
  contactPath,
  createMockState,
  injectOnlineFriend,
  openFamilyHub,
  readDeviceIdentity,
  readOnlineFriends,
  reopenFamilyHub,
  seedAnswer,
  spawnDevice,
} from '../helpers/family-mode-helpers'
import { installFaultOverlay } from './chaos-mock'
import { clickAndExpectNoSuccess } from './helpers'

// Fault-injection and race-condition tests. These run exclusively in the
// nightly interaction workflow (playwright.interaction.config.ts) and are
// deliberately excluded from the main e2e pipeline via testIgnore.

test.describe('Chaos – Fehlertoleranz und Race-Conditions', () => {
  test('Server 503 beim Share-Upload: kein falscher Erfolgsindikator', async ({ browser }) => {
    test.setTimeout(60_000)
    const state = createMockState()
    const { ctx: aliceCtx, page: alice } = await spawnDevice(browser, state)
    const { ctx: bobCtx, page: bob } = await spawnDevice(browser, state)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)
    await seedAnswer(alice, 'fault-q', 'childhood', 'Diese Erinnerung soll nicht ankommen.')

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)

    await injectOnlineFriend(alice, 'Bob', bobId.deviceId, bobId.publicKey)
    await injectOnlineFriend(bob, 'Alice', aliceId.deviceId, aliceId.publicKey)

    // Dauerhafte 503s auf dem Share-Endpunkt
    await installFaultOverlay(aliceCtx, state, [
      { urlContains: '/rest/v1/shares', method: 'POST', status: 503, count: 9999 },
    ])

    await reopenFamilyHub(alice)
    await alice.getByRole('tab', { name: 'Teilen', exact: true }).click()
    await alice.getByText('Diese Erinnerung soll nicht ankommen.').click()
    await alice.locator('.share-recipient-chip', { hasText: 'Bob' }).click()

    const noSuccess = await clickAndExpectNoSuccess(
      alice.getByRole('button', { name: /Verschlüssele & sende/ }),
      alice.getByRole('button', { name: /Gesendet/ }),
      8_000,
    )
    expect(noSuccess, '"Gesendet" darf bei Server-Fehler nicht erscheinen').toBe(true)
    expect(state.shares).toHaveLength(0)

    await aliceCtx.close()
    await bobCtx.close()
  })

  test('Server 503 bei Annotation: kein falscher Erfolg für Bob', async ({ browser }) => {
    test.setTimeout(90_000)
    const state = createMockState()
    const { ctx: aliceCtx, page: alice } = await spawnDevice(browser, state)
    const { ctx: bobCtx, page: bob } = await spawnDevice(browser, state)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)
    await seedAnswer(alice, 'ann-q', 'childhood', 'Erinnerung zum Annotieren.')

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)

    await injectOnlineFriend(alice, 'Bob', bobId.deviceId, bobId.publicKey)
    await injectOnlineFriend(bob, 'Alice', aliceId.deviceId, aliceId.publicKey)

    await reopenFamilyHub(alice)
    await alice.getByRole('tab', { name: 'Teilen', exact: true }).click()
    await alice.getByText('Erinnerung zum Annotieren.').click()
    await alice.locator('.share-recipient-chip', { hasText: 'Bob' }).click()
    await alice.getByRole('button', { name: /Verschlüssele & sende/ }).click()
    await expect(alice.getByRole('button', { name: /Gesendet/ })).toBeVisible({ timeout: 10_000 })

    await reopenFamilyHub(bob)
    await bob.getByRole('tab', { name: /^Feed\b/ }).click()
    await expect(bob.getByText('Erinnerung zum Annotieren.')).toBeVisible({ timeout: 15_000 })

    // Fault erst nach dem Share-Empfang installieren, damit Bob den Feed sieht
    await installFaultOverlay(bobCtx, state, [
      { urlContains: '/rest/v1/annotations', method: 'POST', status: 503, count: 9999 },
    ])

    await bob.getByLabel('Ergänzung hinzufügen').fill('Diese Ergänzung soll fehlschlagen.')

    const noSuccess = await clickAndExpectNoSuccess(
      bob.getByRole('button', { name: 'Ergänzung senden' }),
      bob.getByRole('button', { name: /Gesendet/ }),
      8_000,
    )
    expect(noSuccess, '"Gesendet" darf bei Server-Fehler nicht erscheinen').toBe(true)
    expect(state.annotations).toHaveLength(0)

    await aliceCtx.close()
    await bobCtx.close()
  })

  test('Gleichzeitiges Senden beider Geräte: kein Cross-Owner-Fehler', async ({ browser }) => {
    test.setTimeout(120_000)
    const state = createMockState()
    const { ctx: aliceCtx, page: alice } = await spawnDevice(browser, state)
    const { ctx: bobCtx, page: bob } = await spawnDevice(browser, state)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)
    await seedAnswer(alice, 'race-q-alice', 'childhood', 'Alices gleichzeitige Erinnerung.')

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)
    await seedAnswer(bob, 'race-q-bob', 'family', 'Bobs gleichzeitige Erinnerung.')

    await injectOnlineFriend(alice, 'Bob', bobId.deviceId, bobId.publicKey)
    await injectOnlineFriend(bob, 'Alice', aliceId.deviceId, aliceId.publicKey)

    // Beide bereiten den Teilen-Tab vor, bevor jemand sendet
    await reopenFamilyHub(alice)
    await alice.getByRole('tab', { name: 'Teilen', exact: true }).click()
    await alice.getByText("Alices gleichzeitige Erinnerung.").click()
    await alice.locator('.share-recipient-chip', { hasText: 'Bob' }).click()

    await reopenFamilyHub(bob)
    await bob.getByRole('tab', { name: 'Teilen', exact: true }).click()
    await bob.getByText("Bobs gleichzeitige Erinnerung.").click()
    await bob.locator('.share-recipient-chip', { hasText: 'Alice' }).click()

    // Gleichzeitiger Klick
    await Promise.all([
      alice.getByRole('button', { name: /Verschlüssele & sende/ }).click(),
      bob.getByRole('button', { name: /Verschlüssele & sende/ }).click(),
    ])

    await expect(alice.getByRole('button', { name: /Gesendet/ })).toBeVisible({ timeout: 15_000 })
    await expect(bob.getByRole('button', { name: /Gesendet/ })).toBeVisible({ timeout: 15_000 })

    expect(state.shares).toHaveLength(2)

    // Kein Share ist dem falschen Owner zugeordnet
    const aliceShare = state.shares.find(s => s.owner_id === aliceId.deviceId)
    const bobShare = state.shares.find(s => s.owner_id === bobId.deviceId)
    expect(aliceShare, 'Alices Share fehlt').toBeDefined()
    expect(bobShare, 'Bobs Share fehlt').toBeDefined()
    // Ciphertext darf keinen Klartext des jeweils anderen enthalten
    expect(JSON.stringify(aliceShare!.ciphertext)).not.toContain('Bobs')
    expect(JSON.stringify(bobShare!.ciphertext)).not.toContain('Alices')

    await aliceCtx.close()
    await bobCtx.close()
  })

  test('Kontakt-Link zweimal geöffnet: kein doppelter Eintrag in Freundesliste', async ({ browser }) => {
    test.setTimeout(90_000)
    const state = createMockState()
    const { ctx: aliceCtx, page: alice } = await spawnDevice(browser, state)
    const { ctx: bobCtx, page: bob } = await spawnDevice(browser, state)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)

    const link = contactPath('Alice', aliceId.deviceId, aliceId.publicKey)

    await bob.goto(link)
    await expect(bob.getByRole('heading', { name: 'Kontakt verknüpfen' })).toBeVisible()
    const afterFirst = await readOnlineFriends(bob)
    expect(afterFirst).toHaveLength(1)

    // Denselben Link ein zweites Mal öffnen (Replay)
    await bob.goto(link)
    await expect(bob.getByRole('heading', { name: 'Kontakt verknüpfen' })).toBeVisible()
    const afterSecond = await readOnlineFriends(bob)
    const aliceEntries = afterSecond.filter(f => f.online?.deviceId === aliceId.deviceId)
    expect(aliceEntries).toHaveLength(1)

    await aliceCtx.close()
    await bobCtx.close()
  })

  test('Transienter Server-Fehler (503 einmalig): Share gelingt beim nächsten Versuch', async ({ browser }) => {
    test.setTimeout(90_000)
    const state = createMockState()
    const { ctx: aliceCtx, page: alice } = await spawnDevice(browser, state)
    const { ctx: bobCtx, page: bob } = await spawnDevice(browser, state)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)
    await seedAnswer(alice, 'transient-q', 'childhood', 'Erinnerung mit transientem Fehler.')

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)

    await injectOnlineFriend(alice, 'Bob', bobId.deviceId, bobId.publicKey)
    await injectOnlineFriend(bob, 'Alice', aliceId.deviceId, aliceId.publicKey)

    // Einmaliger 503 – danach gibt der Mock grünes Licht
    const faults = await installFaultOverlay(aliceCtx, state, [
      { urlContains: '/rest/v1/shares', method: 'POST', status: 503, count: 1 },
    ])

    await reopenFamilyHub(alice)
    await alice.getByRole('tab', { name: 'Teilen', exact: true }).click()
    await alice.getByText('Erinnerung mit transientem Fehler.').click()
    await alice.locator('.share-recipient-chip', { hasText: 'Bob' }).click()

    // Erster Versuch schlägt fehl (Fault greift einmalig ein)
    await alice.getByRole('button', { name: /Verschlüssele & sende/ }).click()

    // Wenn die App einen automatischen Retry macht oder der Nutzer erneut klickt,
    // muss der zweite Versuch gelingen. Wir simulieren hier den manuellen Retry.
    // Falls der Button bereits "Gesendet" zeigt, hat die App auto-retry.
    const successAfterFirst = await alice
      .getByRole('button', { name: /Gesendet/ })
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false)

    if (!successAfterFirst) {
      // Manueller Retry: Button erneut klicken
      const sendBtn = alice.getByRole('button', { name: /Verschlüssele & sende/ })
      const isStillPresent = await sendBtn.isVisible()
      if (isStillPresent) {
        await sendBtn.click()
        await expect(alice.getByRole('button', { name: /Gesendet/ })).toBeVisible({ timeout: 10_000 })
      }
    }

    // Fault wurde genau einmal ausgelöst
    expect(faults[0].hits).toBe(1)
    // Sobald der Fault erschöpft ist, muss der Share im Mock landen
    expect(state.shares).toHaveLength(1)

    await aliceCtx.close()
    await bobCtx.close()
  })
})

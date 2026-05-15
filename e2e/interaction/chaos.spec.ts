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
//
// Chaos categories covered:
//   • HTTP-level errors (503) on share and annotation endpoints
//   • Network-level aborts (connectionreset) — hard TCP failure
//   • Race conditions: concurrent sends from both devices
//   • Replay attack: same contact link opened twice
//   • Transient server fault with subsequent recovery
//   • Media upload failure (graceful degradation)
//   • Multiple annotations from same author (idempotency)
//   • Clock skew: one device's clock is 1 hour ahead

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

  test('TCP-Abbruch (connectionreset) beim Teilen: kein falscher Erfolgsindikator', async ({ browser }) => {
    test.setTimeout(60_000)
    const state = createMockState()
    const { ctx: aliceCtx, page: alice } = await spawnDevice(browser, state)
    const { ctx: bobCtx, page: bob } = await spawnDevice(browser, state)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)
    await seedAnswer(alice, 'abort-q', 'childhood', 'Erinnerung mit TCP-Abbruch.')

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)

    await injectOnlineFriend(alice, 'Bob', bobId.deviceId, bobId.publicKey)
    await injectOnlineFriend(bob, 'Alice', aliceId.deviceId, aliceId.publicKey)

    // Kein HTTP-Error, sondern echtes TCP-Reset: Kein Response-Body, kein Status-Code
    await installFaultOverlay(aliceCtx, state, [
      { urlContains: '/rest/v1/shares', method: 'POST', abort: true, count: 9999 },
    ])

    await reopenFamilyHub(alice)
    await alice.getByRole('tab', { name: 'Teilen', exact: true }).click()
    await alice.getByText('Erinnerung mit TCP-Abbruch.').click()
    await alice.locator('.share-recipient-chip', { hasText: 'Bob' }).click()

    const noSuccess = await clickAndExpectNoSuccess(
      alice.getByRole('button', { name: /Verschlüssele & sende/ }),
      alice.getByRole('button', { name: /Gesendet/ }),
      8_000,
    )
    expect(noSuccess, '"Gesendet" darf bei TCP-Abbruch nicht erscheinen').toBe(true)
    expect(state.shares).toHaveLength(0)

    await aliceCtx.close()
    await bobCtx.close()
  })

  test('Medienupload-Fehler: Share-Text trotzdem übermittelt (graceful degradation)', async ({ browser }) => {
    test.setTimeout(90_000)
    const state = createMockState()
    const { ctx: aliceCtx, page: alice } = await spawnDevice(browser, state)
    const { ctx: bobCtx, page: bob } = await spawnDevice(browser, state)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)
    await seedAnswer(alice, 'media-q', 'childhood', 'Erinnerung mit fehlgeschlagenem Medienupload.')

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)

    await injectOnlineFriend(alice, 'Bob', bobId.deviceId, bobId.publicKey)
    await injectOnlineFriend(bob, 'Alice', aliceId.deviceId, aliceId.publicKey)

    // Storage-Uploads blockieren – Text-Shares laufen über /rest/v1/ und sind unberührt
    await installFaultOverlay(aliceCtx, state, [
      { urlContains: '/storage/v1/object/', method: 'POST', status: 503, count: 9999 },
      { urlContains: '/storage/v1/object/', method: 'PUT', status: 503, count: 9999 },
    ])

    await reopenFamilyHub(alice)
    await alice.getByRole('tab', { name: 'Teilen', exact: true }).click()
    await alice.getByText('Erinnerung mit fehlgeschlagenem Medienupload.').click()
    await alice.locator('.share-recipient-chip', { hasText: 'Bob' }).click()
    await alice.getByRole('button', { name: /Verschlüssele & sende/ }).click()
    await expect(alice.getByRole('button', { name: /Gesendet/ })).toBeVisible({ timeout: 10_000 })

    // Text-Share muss im Mock gelandet sein, trotz defektem Storage-Endpunkt
    expect(state.shares).toHaveLength(1)
    expect(state.storage.size).toBe(0)

    await reopenFamilyHub(bob)
    await bob.getByRole('tab', { name: /^Feed\b/ }).click()
    await expect(bob.getByText('Erinnerung mit fehlgeschlagenem Medienupload.')).toBeVisible({ timeout: 15_000 })

    await aliceCtx.close()
    await bobCtx.close()
  })

  test('Mehrere Annotationen vom selben Autor: beide ankommen, keine Überschreibung', async ({ browser }) => {
    test.setTimeout(90_000)
    const state = createMockState()
    const { ctx: aliceCtx, page: alice } = await spawnDevice(browser, state)
    const { ctx: bobCtx, page: bob } = await spawnDevice(browser, state)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)
    await seedAnswer(alice, 'multi-ann-q', 'childhood', 'Erinnerung mit mehreren Ergänzungen.')

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)

    await injectOnlineFriend(alice, 'Bob', bobId.deviceId, bobId.publicKey)
    await injectOnlineFriend(bob, 'Alice', aliceId.deviceId, aliceId.publicKey)

    await reopenFamilyHub(alice)
    await alice.getByRole('tab', { name: 'Teilen', exact: true }).click()
    await alice.getByText('Erinnerung mit mehreren Ergänzungen.').click()
    await alice.locator('.share-recipient-chip', { hasText: 'Bob' }).click()
    await alice.getByRole('button', { name: /Verschlüssele & sende/ }).click()
    await expect(alice.getByRole('button', { name: /Gesendet/ })).toBeVisible({ timeout: 10_000 })

    await reopenFamilyHub(bob)
    await bob.getByRole('tab', { name: /^Feed\b/ }).click()
    await expect(bob.getByText('Erinnerung mit mehreren Ergänzungen.')).toBeVisible({ timeout: 15_000 })

    // Erste Ergänzung
    await bob.getByLabel('Ergänzung hinzufügen').fill('Erste Ergänzung von Bob.')
    await bob.getByRole('button', { name: 'Ergänzung senden' }).click()
    await expect(bob.getByRole('button', { name: /Gesendet/ })).toBeVisible({ timeout: 10_000 })

    // Zweite Ergänzung – Hub neu öffnen (setzt Komponentenstatus zurück)
    await reopenFamilyHub(bob)
    await bob.getByRole('tab', { name: /^Feed\b/ }).click()
    await expect(bob.getByText('Erinnerung mit mehreren Ergänzungen.')).toBeVisible({ timeout: 15_000 })

    await bob.getByLabel('Ergänzung hinzufügen').fill('Zweite Ergänzung von Bob.')
    await bob.getByRole('button', { name: 'Ergänzung senden' }).click()
    await expect(bob.getByRole('button', { name: /Gesendet/ })).toBeVisible({ timeout: 10_000 })

    // Mock: beide Annotationen sind eigenständige Einträge, kein Overwrite
    expect(state.annotations).toHaveLength(2)
    expect(state.annotations.every(a => a.author_id === bobId.deviceId)).toBe(true)
    const bodies = state.annotations.map(a => JSON.stringify(a))
    expect(bodies.some(b => b.includes('Erste'))).toBe(true)
    // Zweite Annotation muss einen anderen Ciphertext haben als die erste
    expect(state.annotations[0].ciphertext).not.toBe(state.annotations[1].ciphertext)

    // Alice sieht beide Ergänzungen
    await reopenFamilyHub(alice)
    await expect(alice.getByText('Erste Ergänzung von Bob.')).toBeVisible({ timeout: 15_000 })
    await expect(alice.getByText('Zweite Ergänzung von Bob.')).toBeVisible({ timeout: 15_000 })

    await aliceCtx.close()
    await bobCtx.close()
  })

  test('Uhrzeitversatz (1 Stunde): Handshake und Teilen funktionieren trotzdem', async ({ browser }) => {
    test.setTimeout(120_000)
    const state = createMockState()

    // Bob's Gerät läuft mit einer um 1 Stunde vorgestellten Systemuhr
    const bobCtxRaw = await browser.newContext({ serviceWorkers: 'block' })
    await bobCtxRaw.addInitScript(() => {
      const OrigDate = globalThis.Date
      const OFFSET_MS = 3_600_000 // +1 Stunde
      // @ts-ignore – wir ersetzen Date nur im Browser-Kontext dieses Tests
      globalThis.Date = class extends OrigDate {
        constructor(...args: ConstructorParameters<typeof OrigDate>) {
          // @ts-ignore
          super(...args.length ? args : [OrigDate.now() + OFFSET_MS])
        }
        static now() { return OrigDate.now() + OFFSET_MS }
        static [Symbol.hasInstance](instance: unknown) {
          return instance instanceof OrigDate
        }
      }
      localStorage.setItem('rm-install-dismissed', '1')
      if (!localStorage.getItem('remember-me-state')) {
        localStorage.setItem('remember-me-state', JSON.stringify({
          profile: null, answers: {}, friends: [], friendAnswers: [],
          customQuestions: [], appMode: 'full',
        }))
      }
    })

    const { installSupabaseMock } = await import('../helpers/supabase-mock')
    await installSupabaseMock(bobCtxRaw, state)
    const bobPage = await bobCtxRaw.newPage()

    const { ctx: aliceCtx, page: alice } = await spawnDevice(browser, state)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)
    await seedAnswer(alice, 'skew-q', 'childhood', 'Erinnerung trotz Uhrzeitversatz.')

    await completeOnboarding(bobPage, 'Bob (Zukunft)')
    await openFamilyHub(bobPage)
    const bobId = await readDeviceIdentity(bobPage)

    // Handshake mit Uhrzeitversatz
    await bobPage.goto(contactPath('Alice', aliceId.deviceId, aliceId.publicKey))
    await expect(bobPage.getByRole('heading', { name: 'Kontakt verknüpfen' })).toBeVisible()
    // onAcceptContact runs in a useEffect after paint – poll until state is saved
    await bobPage.waitForFunction(
      () => ((window as any).__rmState?.get()?.friends ?? []).filter((f: any) => f.online).length >= 1,
      undefined,
      { timeout: 10_000 },
    )
    const bobFriends = await readOnlineFriends(bobPage)
    expect(bobFriends).toHaveLength(1)

    await alice.goto(contactPath('Bob (Zukunft)', bobId.deviceId, bobId.publicKey))
    await expect(alice.getByRole('heading', { name: 'Kontakt verknüpfen' })).toBeVisible()
    await alice.waitForFunction(
      () => ((window as any).__rmState?.get()?.friends ?? []).filter((f: any) => f.online).length >= 1,
      undefined,
      { timeout: 10_000 },
    )
    const aliceFriends = await readOnlineFriends(alice)
    expect(aliceFriends).toHaveLength(1)

    // Teilen trotz Uhrzeitversatz
    await reopenFamilyHub(alice)
    await alice.getByRole('tab', { name: 'Teilen', exact: true }).click()
    await alice.getByText('Erinnerung trotz Uhrzeitversatz.').click()
    await alice.locator('.share-recipient-chip').first().click()
    await alice.getByRole('button', { name: /Verschlüssele & sende/ }).click()
    await expect(alice.getByRole('button', { name: /Gesendet/ })).toBeVisible({ timeout: 10_000 })

    expect(state.shares).toHaveLength(1)

    await reopenFamilyHub(bobPage)
    await bobPage.getByRole('tab', { name: /^Feed\b/ }).click()
    await expect(bobPage.getByText('Erinnerung trotz Uhrzeitversatz.')).toBeVisible({ timeout: 15_000 })

    await aliceCtx.close()
    await bobCtxRaw.close()
  })
})

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
  waitForShares,
} from '../helpers/family-mode-helpers'
import { installFaultOverlay } from './chaos-mock'
import { clickAndExpectNoSuccess } from './helpers'

// Fault-injection and race-condition tests. These run exclusively in the
// nightly interaction workflow (playwright.interaction.config.ts) and are
// deliberately excluded from the main e2e pipeline via testIgnore.
//
// Under REQ-022 the manual "Teilen" tab no longer exists – every saved
// Answer is auto-shared by useAutoShare. Fault tests now assert on the
// server state directly (state.shares / state.annotations) instead of UI
// "Gesendet" badges. The annotation path still has an explicit UI submit
// because Ergänzungen aren't auto-broadcast.

test.describe('Chaos – Fehlertoleranz und Race-Conditions', () => {
  test('Server 503 beim Auto-Share: kein Share landet im Server, Queue gibt sauber auf', async ({ browser }) => {
    test.setTimeout(90_000)
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

    // Persistent 503 on the share endpoint – the auto-share queue will
    // burn through its 4 retry attempts and then surrender.
    await installFaultOverlay(aliceCtx, state, [
      { urlContains: '/rest/v1/shares', method: 'POST', status: 503, count: 9999 },
    ])

    await reopenFamilyHub(alice)
    await seedAnswer(alice, 'fault-q', 'childhood', 'Diese Erinnerung soll nicht ankommen.')

    // Wait through the retry window (2s + 4s + 8s + 16s + jitter) plus
    // some slack, then confirm nothing landed on the server.
    await alice.waitForTimeout(35_000)
    expect(state.shares, 'Share darf bei Server-Fehler nicht persistiert werden').toHaveLength(0)

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

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)

    await injectOnlineFriend(alice, 'Bob', bobId.deviceId, bobId.publicKey)
    await injectOnlineFriend(bob, 'Alice', aliceId.deviceId, aliceId.publicKey)

    await reopenFamilyHub(alice)
    await seedAnswer(alice, 'ann-q', 'childhood', 'Erinnerung zum Annotieren.')
    await waitForShares(state, 1, 20_000)

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

  test('Gleichzeitiges Auto-Share beider Geräte: kein Cross-Owner-Fehler', async ({ browser }) => {
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

    await reopenFamilyHub(alice)
    await reopenFamilyHub(bob)

    // Both seed answers near-simultaneously – useAutoShare on each device
    // independently encrypts and uploads.
    await Promise.all([
      seedAnswer(alice, 'race-q-alice', 'childhood', 'Alices gleichzeitige Erinnerung.'),
      seedAnswer(bob, 'race-q-bob', 'family', 'Bobs gleichzeitige Erinnerung.'),
    ])

    await waitForShares(state, 2, 30_000)

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

  test('Transienter Server-Fehler (503 einmalig): Auto-Share gelingt beim Retry', async ({ browser }) => {
    test.setTimeout(90_000)
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

    // Einmaliger 503 – danach gibt der Mock grünes Licht. useAutoShare
    // wartet 2s und versucht es erneut → 2. Versuch landet.
    const faults = await installFaultOverlay(aliceCtx, state, [
      { urlContains: '/rest/v1/shares', method: 'POST', status: 503, count: 1 },
    ])

    await reopenFamilyHub(alice)
    await seedAnswer(alice, 'transient-q', 'childhood', 'Erinnerung mit transientem Fehler.')

    await waitForShares(state, 1, 30_000)
    expect(faults[0].hits).toBe(1)
    expect(state.shares).toHaveLength(1)

    await aliceCtx.close()
    await bobCtx.close()
  })

  test('TCP-Abbruch (connectionreset) beim Auto-Share: kein Share im Mock', async ({ browser }) => {
    test.setTimeout(90_000)
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

    // Kein HTTP-Error, sondern echtes TCP-Reset: Kein Response-Body, kein Status-Code
    await installFaultOverlay(aliceCtx, state, [
      { urlContains: '/rest/v1/shares', method: 'POST', abort: true, count: 9999 },
    ])

    await reopenFamilyHub(alice)
    await seedAnswer(alice, 'abort-q', 'childhood', 'Erinnerung mit TCP-Abbruch.')

    await alice.waitForTimeout(35_000)
    expect(state.shares, 'Share darf bei TCP-Abbruch nicht persistiert werden').toHaveLength(0)

    await aliceCtx.close()
    await bobCtx.close()
  })

  test('Medienupload-Fehler: Text-Share trotzdem übermittelt (graceful degradation)', async ({ browser }) => {
    test.setTimeout(90_000)
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

    // Storage-Uploads blockieren – Auto-Share läuft Text-only (REQ-022 §9),
    // also ist der Text-Share von blockiertem Storage gar nicht betroffen.
    await installFaultOverlay(aliceCtx, state, [
      { urlContains: '/storage/v1/object/', method: 'POST', status: 503, count: 9999 },
      { urlContains: '/storage/v1/object/', method: 'PUT', status: 503, count: 9999 },
    ])

    await reopenFamilyHub(alice)
    await seedAnswer(alice, 'media-q', 'childhood', 'Erinnerung mit fehlgeschlagenem Medienupload.')

    await waitForShares(state, 1, 30_000)
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

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)

    await injectOnlineFriend(alice, 'Bob', bobId.deviceId, bobId.publicKey)
    await injectOnlineFriend(bob, 'Alice', aliceId.deviceId, aliceId.publicKey)

    await reopenFamilyHub(alice)
    await seedAnswer(alice, 'multi-ann-q', 'childhood', 'Erinnerung mit mehreren Ergänzungen.')
    await waitForShares(state, 1, 20_000)

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

    expect(state.annotations).toHaveLength(2)
    expect(state.annotations.every(a => a.author_id === bobId.deviceId)).toBe(true)
    expect(state.annotations[0].ciphertext).not.toBe(state.annotations[1].ciphertext)

    await reopenFamilyHub(alice)
    await expect(alice.getByText('Erste Ergänzung von Bob.')).toBeVisible({ timeout: 15_000 })
    await expect(alice.getByText('Zweite Ergänzung von Bob.')).toBeVisible({ timeout: 15_000 })

    await aliceCtx.close()
    await bobCtx.close()
  })

  test('Uhrzeitversatz (1 Stunde): Handshake und Auto-Share funktionieren trotzdem', async ({ browser }) => {
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

    await completeOnboarding(bobPage, 'Bob (Zukunft)')
    await openFamilyHub(bobPage)
    const bobId = await readDeviceIdentity(bobPage)

    // Handshake mit Uhrzeitversatz
    await bobPage.goto(contactPath('Alice', aliceId.deviceId, aliceId.publicKey))
    await expect(bobPage.getByRole('heading', { name: 'Kontakt verknüpfen' })).toBeVisible()
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

    // Auto-Share trotz Uhrzeitversatz
    await reopenFamilyHub(alice)
    await seedAnswer(alice, 'skew-q', 'childhood', 'Erinnerung trotz Uhrzeitversatz.')
    await waitForShares(state, 1, 25_000)

    await reopenFamilyHub(bobPage)
    await bobPage.getByRole('tab', { name: /^Feed\b/ }).click()
    await expect(bobPage.getByText('Erinnerung trotz Uhrzeitversatz.')).toBeVisible({ timeout: 15_000 })

    await aliceCtx.close()
    await bobCtxRaw.close()
  })
})

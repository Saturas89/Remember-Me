// Nightly edge-case tests for the auto-share / backfill flow (REQ-022).
//
// These tests run against the live production Supabase instance via the
// production-nightly job in .github/workflows/nightly-production.yml.
// They complement two-device-real.spec.ts (which covers the happy path)
// by explicitly exercising the corner cases that the mock-based specs skip:
//
//   backfill-existing     Answers written BEFORE a friend is connected are
//                         shared via backfill (no linkedAt filter in useAutoShare).
//   shareall-false        Friend connected with shareAll=false → zero shares go out.
//   toggle-false-to-true  Toggle shareAll off→on triggers backfill of all prior answers.
//   asymmetric            Alice→Bob=true, Bob→Alice=false → Bob sees Alice, Alice sees nothing.

import { test, expect } from '@playwright/test'
import {
  completeOnboarding,
  openFamilyHub,
  readDeviceIdentity,
  injectOnlineFriend,
  reopenFamilyHub,
  seedAnswer,
} from '../helpers/family-mode-helpers'
import { cleanupUsers, spawnRealDevice, supabaseAdmin, waitForRealShares } from './helpers'

test.describe('Real-DB: Auto-Share Edge Cases (REQ-022)', () => {
  const admin = supabaseAdmin()
  const createdUsers: string[] = []

  test.afterEach(async () => {
    await cleanupUsers(admin, createdUsers.splice(0))
  })

  // ── 1. Backfill bestehender Antworten ──────────────────────────────────────
  //
  // Alice schreibt 2 Antworten, BEVOR sie Bob als Kontakt hinzufügt.
  // useAutoShare darf keinen linkedAt-Filter anwenden – beide Antworten müssen
  // nachträglich geteilt werden.
  test('backfill-existing: vorhandene Antworten werden bei neuer Verbindung geteilt', async ({ browser }) => {
    test.setTimeout(120_000)

    const { ctx: aliceCtx, page: alice } = await spawnRealDevice(browser)
    const { ctx: bobCtx,   page: bob   } = await spawnRealDevice(browser)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)
    createdUsers.push(aliceId.deviceId)

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)
    createdUsers.push(bobId.deviceId)

    // Alice befüllt 2 Antworten BEVOR Bob als Freund injiziert wird
    await seedAnswer(alice, 'backfill-q-1', 'childhood', 'Erinnerung von früher – Nummer eins.')
    await seedAnswer(alice, 'backfill-q-2', 'family', 'Erinnerung von früher – Nummer zwei.')

    // Jetzt erst wird Bob als Kontakt hinzugefügt
    await injectOnlineFriend(alice, 'Bob', bobId.deviceId, bobId.publicKey, true)
    await injectOnlineFriend(bob, 'Alice', aliceId.deviceId, aliceId.publicKey, true)

    // reopenFamilyHub triggert useAutoShare mit dem neuen Freund – beide alten
    // Antworten müssen in die Queue aufgenommen werden
    await reopenFamilyHub(alice)
    await waitForRealShares(admin, aliceId.deviceId, 2, 60_000)

    // Bob öffnet den Feed und sieht beide rückwirkend geteilten Erinnerungen
    await reopenFamilyHub(bob)
    await expect(bob.getByTestId('feed-item').nth(1)).toBeVisible({ timeout: 30_000 })

    const texts = await bob.getByTestId('feed-item').allTextContents()
    const joined = texts.join(' ')
    expect(joined).toContain('Erinnerung von früher')

    await aliceCtx.close()
    await bobCtx.close()
  })

  // ── 2. shareAll=false → kein einziger Share ────────────────────────────────
  //
  // Wenn Alice Bob mit shareAll=false verknüpft, darf useAutoShare keine
  // Erinnerungen an Bob senden – auch nicht beim App-Start-Backfill.
  test('shareall-false: kein Share wenn shareAll=false', async ({ browser }) => {
    test.setTimeout(90_000)

    const { ctx: aliceCtx, page: alice } = await spawnRealDevice(browser)
    const { ctx: bobCtx,   page: bob   } = await spawnRealDevice(browser)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)
    createdUsers.push(aliceId.deviceId)

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)
    createdUsers.push(bobId.deviceId)

    // Bob mit shareAll=false injizieren
    await injectOnlineFriend(alice, 'Bob', bobId.deviceId, bobId.publicKey, false)
    await injectOnlineFriend(bob, 'Alice', aliceId.deviceId, aliceId.publicKey, true)

    await seedAnswer(alice, 'noShare-q-1', 'childhood', 'Soll nicht rausgehen.')
    await reopenFamilyHub(alice)

    // 10 Sekunden warten – ausreichend für useAutoShare bei einem einzigen Paar,
    // wenn keine Netzwerklatenz vorliegt
    await alice.waitForTimeout(10_000)

    const { data: shares } = await admin
      .from('shares')
      .select('id')
      .eq('owner_id', aliceId.deviceId)
    expect(shares?.length ?? 0).toBe(0)

    // Bob sieht erwartungsgemäß keinen Feed-Eintrag
    await reopenFamilyHub(bob)
    await bob.waitForTimeout(3_000)
    expect(await bob.getByTestId('feed-item').count()).toBe(0)

    await aliceCtx.close()
    await bobCtx.close()
  })

  // ── 3. Toggle false→true triggert Backfill ─────────────────────────────────
  //
  // Alice startet mit shareAll=false. Nach dem Toggle auf true müssen alle
  // bisherigen Antworten nachträglich geteilt werden (FR-22.9).
  test('toggle-false-to-true: Backfill nach Opt-in', async ({ browser }) => {
    test.setTimeout(120_000)

    const { ctx: aliceCtx, page: alice } = await spawnRealDevice(browser)
    const { ctx: bobCtx,   page: bob   } = await spawnRealDevice(browser)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)
    createdUsers.push(aliceId.deviceId)

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)
    createdUsers.push(bobId.deviceId)

    // Erst shareAll=false → keine Shares
    await injectOnlineFriend(alice, 'Bob', bobId.deviceId, bobId.publicKey, false)
    await injectOnlineFriend(bob, 'Alice', aliceId.deviceId, aliceId.publicKey, true)

    await seedAnswer(alice, 'toggle-q-1', 'childhood', 'Wartende Erinnerung.')
    await reopenFamilyHub(alice)
    await alice.waitForTimeout(8_000)

    const { data: sharesBefore } = await admin
      .from('shares')
      .select('id')
      .eq('owner_id', aliceId.deviceId)
    expect(sharesBefore?.length ?? 0).toBe(0)

    // Toggle auf true: Friend im State direkt aktualisieren
    await alice.evaluate(({ bobDeviceId }) => {
      type Bridge = { get: () => Record<string, unknown> | null; save: (s: unknown) => void }
      const bridge = (window as unknown as { __rmState?: Bridge }).__rmState
      const state: Record<string, unknown> = bridge?.get() ?? {}
      const friends = (state.friends as Array<Record<string, unknown>>) ?? []
      for (const f of friends) {
        const o = f.online as Record<string, unknown> | undefined
        if (o?.deviceId === bobDeviceId) o.shareAll = true
      }
      state.friends = friends
      bridge?.save(state)
    }, { bobDeviceId: bobId.deviceId })

    // Reload → useAutoShare erkennt Bob nun als shareAll=true und backfillt
    await reopenFamilyHub(alice)
    await waitForRealShares(admin, aliceId.deviceId, 1, 60_000)

    await reopenFamilyHub(bob)
    await expect(bob.getByTestId('feed-item').first()).toBeVisible({ timeout: 30_000 })

    const itemText = await bob.getByTestId('feed-item').first().textContent()
    expect(itemText).toContain('Wartende Erinnerung')

    await aliceCtx.close()
    await bobCtx.close()
  })

  // ── 4. Asymmetrisches Sharing ──────────────────────────────────────────────
  //
  // Alice teilt mit Bob (shareAll=true), Bob teilt nicht mit Alice (shareAll=false).
  // → Bob sieht Alices Erinnerungen; Alices Feed bleibt leer.
  test('asymmetric: Alice teilt mit Bob, Bob nicht mit Alice', async ({ browser }) => {
    test.setTimeout(120_000)

    const { ctx: aliceCtx, page: alice } = await spawnRealDevice(browser)
    const { ctx: bobCtx,   page: bob   } = await spawnRealDevice(browser)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)
    createdUsers.push(aliceId.deviceId)

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)
    createdUsers.push(bobId.deviceId)

    // Alice → Bob: shareAll=true | Bob → Alice: shareAll=false
    await injectOnlineFriend(alice, 'Bob',   bobId.deviceId,   bobId.publicKey,   true)
    await injectOnlineFriend(bob,   'Alice', aliceId.deviceId, aliceId.publicKey, false)

    await seedAnswer(alice, 'asym-q-1', 'childhood', 'Alices Erinnerung für Bob.')
    await seedAnswer(bob,   'asym-q-2', 'family',    'Bobs private Erinnerung.')

    // Beide öffnen den Hub → useAutoShare läuft
    await reopenFamilyHub(alice)
    await reopenFamilyHub(bob)

    // Nur Alices Shares kommen in die DB
    await waitForRealShares(admin, aliceId.deviceId, 1, 60_000)
    await bob.waitForTimeout(8_000)

    const { data: bobShares } = await admin
      .from('shares')
      .select('id')
      .eq('owner_id', bobId.deviceId)
    expect(bobShares?.length ?? 0).toBe(0)

    // Bob sieht Alices Erinnerung
    await reopenFamilyHub(bob)
    await expect(bob.getByTestId('feed-item').first()).toBeVisible({ timeout: 30_000 })
    expect(await bob.getByTestId('feed-item').first().textContent()).toContain('Alices Erinnerung')

    // Alice sieht nichts im Feed
    await reopenFamilyHub(alice)
    await alice.waitForTimeout(3_000)
    expect(await alice.getByTestId('feed-item').count()).toBe(0)

    await aliceCtx.close()
    await bobCtx.close()
  })
})

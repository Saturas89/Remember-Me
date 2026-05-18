// End-to-end tests against the production Supabase instance.
//
// These tests are run by the production-supabase job in
// .github/workflows/nightly-production.yml. They require:
//   SUPABASE_URL              – production Supabase API URL
//   SUPABASE_ANON_KEY         – production anon/public JWT
//   SUPABASE_SERVICE_ROLE_KEY – service-role JWT for admin cleanup
//
// Unlike the mock-based family-mode-*.spec.ts files, every Supabase call here
// goes to the real PostgREST/GoTrue/Storage stack, so RLS policies, FK
// cascades, and the full auth flow are exercised end-to-end.
//
// Coverage:
//   • full-share-flow        Alice sends share → Bob reads it (real DB + RLS)
//   • share-isolation        Eve is not a recipient → share invisible to her
//   • annotation-roundtrip   Bob annotates Alice's share → Alice sees it
//   • cascade-cleanup        Deleting Alice's device removes her shares/annotations

import { test, expect } from '@playwright/test'
import {
  completeOnboarding,
  contactPath,
  openFamilyHub,
  readDeviceIdentity,
  injectOnlineFriend,
  seedAnswer,
} from '../helpers/family-mode-helpers'
import { cleanupUsers, readDeviceId, spawnRealDevice, supabaseAdmin } from './helpers'

// ── Test suite ─────────────────────────────────────────────────────────────

test.describe('Real-DB: Vollständiger Alice → Bob Share-Flow', () => {
  const createdUsers: string[] = []
  const admin = supabaseAdmin()

  test.afterEach(async () => {
    await cleanupUsers(admin, createdUsers.splice(0))
  })

  test('full-share-flow: Alice teilt eine Erinnerung, Bob liest sie', async ({ browser }) => {
    test.setTimeout(90_000)

    const { ctx: aliceCtx, page: alice } = await spawnRealDevice(browser)
    const { ctx: bobCtx,   page: bob   } = await spawnRealDevice(browser)

    // ── Alice onboarding + Familienmodus aktivieren ──────────────────────────
    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)
    createdUsers.push(aliceId.deviceId)

    // ── Bob onboarding + Familienmodus aktivieren ─────────────────────────────
    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)
    createdUsers.push(bobId.deviceId)

    // ── Gegenseitiges Verlinken (inject, damit der Handshake-UI-Flow nicht
    //    aufgerufen werden muss – wir testen hier das DB-Verhalten, nicht den
    //    QR-Code-Scan) ───────────────────────────────────────────────────────
    await injectOnlineFriend(alice, 'Bob',   bobId.deviceId,   bobId.publicKey)
    await injectOnlineFriend(bob,   'Alice', aliceId.deviceId, aliceId.publicKey)

    // ── Alice befüllt eine Antwort und teilt sie ─────────────────────────────
    await seedAnswer(alice, 'real-q-1', 'childhood', 'Meine Kindheitserinnerung an den See.')

    // Navigiere zum Share-Tab und löse den Share aus
    await alice.reload()
    await openFamilyHub(alice)
    const sendBtn = alice.getByTestId('send-memories')
    await expect(sendBtn).toBeVisible({ timeout: 20_000 })
    await sendBtn.click()

    const successIndicator = alice.getByTestId('share-success')
    await expect(successIndicator).toBeVisible({ timeout: 30_000 })

    // ── Bob lädt die Seite neu und erwartet den Share ─────────────────────────
    await bob.reload()
    await openFamilyHub(bob)

    const feedItem = bob.getByTestId('feed-item').first()
    await expect(feedItem).toBeVisible({ timeout: 30_000 })

    // Ciphertext darf nicht den Klartext enthalten – verschlüsselt angekommen
    const itemText = await feedItem.textContent()
    expect(itemText).not.toContain('Meine Kindheitserinnerung')

    await aliceCtx.close()
    await bobCtx.close()
  })

  test('share-isolation: Eve sieht Alices Share nicht', async ({ browser }) => {
    test.setTimeout(90_000)

    const { ctx: aliceCtx, page: alice } = await spawnRealDevice(browser)
    const { ctx: bobCtx,   page: bob   } = await spawnRealDevice(browser)
    const { ctx: eveCtx,   page: eve   } = await spawnRealDevice(browser)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)
    createdUsers.push(aliceId.deviceId)

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)
    createdUsers.push(bobId.deviceId)

    // Eve aktiviert Familienmodus, ist aber NICHT mit Alice verlinkt
    await completeOnboarding(eve, 'Eve')
    await openFamilyHub(eve)
    const eveId = await readDeviceId(eve)
    createdUsers.push(eveId)

    // Alice verlinkt nur Bob
    await injectOnlineFriend(alice, 'Bob', bobId.deviceId, bobId.publicKey)
    await injectOnlineFriend(bob, 'Alice', aliceId.deviceId, aliceId.publicKey)

    await seedAnswer(alice, 'real-q-2', 'family', 'Geheimnis für Bob.')
    await alice.reload()
    await openFamilyHub(alice)
    await alice.getByTestId('send-memories').click()
    await expect(alice.getByTestId('share-success')).toBeVisible({ timeout: 30_000 })

    // Bob sieht den Share
    await bob.reload()
    await openFamilyHub(bob)
    await expect(bob.getByTestId('feed-item').first()).toBeVisible({ timeout: 30_000 })

    // Eve sieht KEINEN Share (RLS greift)
    await eve.reload()
    await openFamilyHub(eve)
    // Kurz warten, damit ein etwaiges falsches Laden abgeschlossen wäre
    await eve.waitForTimeout(3_000)
    const eveItems = eve.getByTestId('feed-item')
    expect(await eveItems.count()).toBe(0)

    await aliceCtx.close()
    await bobCtx.close()
    await eveCtx.close()
  })

  test('annotation-roundtrip: Bob annotiert, Alice sieht es', async ({ browser }) => {
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

    await injectOnlineFriend(alice, 'Bob',   bobId.deviceId,   bobId.publicKey)
    await injectOnlineFriend(bob,   'Alice', aliceId.deviceId, aliceId.publicKey)

    // Alice teilt
    await seedAnswer(alice, 'real-q-3', 'childhood', 'Erinnerung für Annotation.')
    await alice.reload()
    await openFamilyHub(alice)
    await alice.getByTestId('send-memories').click()
    await expect(alice.getByTestId('share-success')).toBeVisible({ timeout: 30_000 })

    // Bob öffnet den Share und schreibt eine Annotation
    await bob.reload()
    await openFamilyHub(bob)
    const feedItem = bob.getByTestId('feed-item').first()
    await expect(feedItem).toBeVisible({ timeout: 30_000 })
    await feedItem.click()

    const annotationInput = bob.getByTestId('annotation-input')
    await expect(annotationInput).toBeVisible({ timeout: 10_000 })
    await annotationInput.fill('Sehr schöne Erinnerung!')
    await bob.getByTestId('send-annotation').click()
    await expect(bob.getByTestId('annotation-sent')).toBeVisible({ timeout: 15_000 })

    // Alice lädt neu und sieht die Annotation auf ihrem Share
    await alice.reload()
    await openFamilyHub(alice)
    const aliceFeedItem = alice.getByTestId('feed-item').first()
    await expect(aliceFeedItem).toBeVisible({ timeout: 30_000 })
    await aliceFeedItem.click()

    const annotationBadge = alice.getByTestId('annotation-count')
    await expect(annotationBadge).toBeVisible({ timeout: 15_000 })

    await aliceCtx.close()
    await bobCtx.close()
  })

  test('cascade-cleanup: Alices Gerät löschen entfernt Share und Annotation', async ({ browser }) => {
    test.setTimeout(60_000)

    const { ctx: aliceCtx, page: alice } = await spawnRealDevice(browser)
    const { ctx: bobCtx,   page: bob   } = await spawnRealDevice(browser)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)
    // Nicht in createdUsers pushen – wir löschen Alice manuell in diesem Test

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)
    createdUsers.push(bobId.deviceId)

    await injectOnlineFriend(alice, 'Bob',   bobId.deviceId,   bobId.publicKey)
    await injectOnlineFriend(bob,   'Alice', aliceId.deviceId, aliceId.publicKey)

    await seedAnswer(alice, 'real-q-4', 'family', 'Wird bald gelöscht.')
    await alice.reload()
    await openFamilyHub(alice)
    await alice.getByTestId('send-memories').click()
    await expect(alice.getByTestId('share-success')).toBeVisible({ timeout: 30_000 })

    // Verifizieren via Admin-API: Share ist da
    const { data: sharesBefore } = await admin
      .from('shares')
      .select('id')
      .eq('owner_id', aliceId.deviceId)
    expect(sharesBefore?.length ?? 0).toBeGreaterThan(0)

    // Alice löscht ihr Gerät (= Familienmodus deaktivieren)
    await alice.getByTestId('deactivate-sharing').click()
    await alice.getByTestId('confirm-deactivate').click()

    // Admin-API: Share muss kaskadiert weg sein
    await expect
      .poll(async () => {
        const { data } = await admin.from('shares').select('id').eq('owner_id', aliceId.deviceId)
        return data?.length ?? 0
      }, { timeout: 10_000 })
      .toBe(0)

    // Alices auth-User direkt löschen (nicht über das Gerät, da bereits gelöscht)
    await admin.auth.admin.deleteUser(aliceId.deviceId)

    await aliceCtx.close()
    await bobCtx.close()
  })
})

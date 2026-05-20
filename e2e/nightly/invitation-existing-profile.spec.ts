// Regression tests: accepting an invitation link must not overwrite an
// existing user's profile, answers or settings.
//
// Two scenarios:
//
//   1. Benutzer ohne aktiven Hub  – Bob has answers + profile but has NOT yet
//      opened the family hub.  He receives Alice's invite link, activates
//      online sharing from the "Kontakt verknüpfen" screen and the contact is
//      accepted automatically.  All pre-existing data must survive.
//
//   2. Benutzer mit aktivem Hub   – Bob already has the hub running and one
//      injected friend (Charlie).  Bob visits Alice's invite link, the
//      contact is auto-accepted (no extra confirmation needed).
//      Charlie must still be there; Bob's answers must be intact.
//
// Both tests run against the real Supabase backend.
// Cleanup: afterEach removes all created auth users.

import { test, expect } from '@playwright/test'
import {
  completeOnboarding,
  contactPath,
  injectOnlineFriend,
  openFamilyHub,
  readDeviceIdentity,
  readOnlineFriends,
  seedAnswer,
} from '../helpers/family-mode-helpers'
import { cleanupUsers, spawnRealDevice, supabaseAdmin } from './helpers'

test.describe('Einladungslink – bestehende Daten bleiben erhalten', () => {
  const createdUsers: string[] = []
  const admin = supabaseAdmin()

  test.afterEach(async () => {
    await cleanupUsers(admin, createdUsers.splice(0))
  })

  // ── 1. Benutzer ohne aktiven Hub ────────────────────────────────────────────

  test('invitation-without-hub: Erinnerungen und Einstellungen bleiben nach Einladungsannahme erhalten', async ({
    browser,
  }) => {
    test.setTimeout(120_000)

    const { ctx: aliceCtx, page: alice } = await spawnRealDevice(browser)
    const { ctx: bobCtx,   page: bob   } = await spawnRealDevice(browser)

    // ── Alice: Hub einrichten und Contact-Link bereitstellen ─────────────────
    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)
    createdUsers.push(aliceId.deviceId)

    // ── Bob: Profil aufbauen ohne den Hub zu aktivieren ──────────────────────
    await completeOnboarding(bob, 'Bob')

    // Zwei Erinnerungen anlegen (Kindheit und Schule)
    await seedAnswer(bob, 'invite-q-childhood', 'childhood', 'Ich bin in Hamburg aufgewachsen.')
    await seedAnswer(bob, 'invite-q-school',    'school',    'Meine Lieblingsschulfach war Musik.')

    // AppMode auf 'simplified' setzen (vereinfachter Bedienmodus)
    await bob.evaluate(() => {
      type Bridge = { get: () => Record<string, unknown> | null; save: (s: unknown) => void }
      const bridge = (window as unknown as { __rmState?: Bridge }).__rmState
      const state = bridge?.get() ?? {}
      state.appMode = 'simplified'
      bridge?.save(state)
    })

    // ── Bob öffnet Alices Einladungslink ─────────────────────────────────────
    await bob.goto(contactPath('Alice', aliceId.deviceId, aliceId.publicKey))
    await expect(bob.getByRole('heading', { name: 'Kontakt verknüpfen' })).toBeVisible()
    await expect(bob.getByText(/Alice/).first()).toBeVisible()

    // Hub noch nicht aktiv → "Aktivieren"-Button muss sichtbar sein
    await expect(
      bob.getByRole('button', { name: /Aktivieren/ }),
    ).toBeVisible({ timeout: 5_000 })

    // Hub aktivieren (löst onAcceptContact aus sobald deviceId verfügbar)
    await bob.getByRole('button', { name: /Aktivieren/ }).click()

    // Warten bis Bobs Hub gestartet ist und Alice als Kontakt gespeichert wurde.
    // 65 s: bootstrapSession kann bis zu 4 Versuche benötigen (3 s + 9 s + 27 s
    // Wartezeit zwischen Retries, eingeführt in #273), was bei schlechter
    // Netzwerkverbindung den ursprünglichen 35-s-Grenzwert überschreitet.
    await expect(
      bob.getByRole('button', { name: /Meinen Link zurück senden/ }),
    ).toBeVisible({ timeout: 65_000 })

    // Bob-DeviceId für Cleanup sichern
    const bobId = await readDeviceIdentity(bob)
    createdUsers.push(bobId.deviceId)

    // ── Datenintegrität prüfen ───────────────────────────────────────────────

    // Alice ist jetzt in Bobs Freundesliste
    const bobsFriends = await readOnlineFriends(bob)
    expect(bobsFriends.map(f => f.name)).toContain('Alice')

    // Beide Erinnerungen sind noch da
    const answers = await bob.evaluate(() => {
      const b = (window as unknown as {
        __rmState?: { get: () => Record<string, unknown> | null }
      }).__rmState
      return (b?.get()?.answers ?? {}) as Record<string, { value: string }>
    })
    expect(answers['invite-q-childhood']?.value).toBe('Ich bin in Hamburg aufgewachsen.')
    expect(answers['invite-q-school']?.value).toBe('Meine Lieblingsschulfach war Musik.')

    // Profilname unverändert
    const profileName = await bob.evaluate(() => {
      const b = (window as unknown as {
        __rmState?: { get: () => Record<string, unknown> | null }
      }).__rmState
      const s = b?.get()
      return (s?.profile as { name?: string } | null)?.name ?? null
    })
    expect(profileName).toBe('Bob')

    // AppMode unverändert (simplified)
    const appMode = await bob.evaluate(() => {
      const b = (window as unknown as {
        __rmState?: { get: () => Record<string, unknown> | null }
      }).__rmState
      return b?.get()?.appMode ?? null
    })
    expect(appMode).toBe('simplified')

    await aliceCtx.close()
    await bobCtx.close()
  })

  // ── 2. Benutzer mit aktivem Hub und vorhandenen Freunden ───────────────────

  test('invitation-with-existing-hub: Vorhandene Freunde und Erinnerungen bleiben nach neuer Einladung erhalten', async ({
    browser,
  }) => {
    test.setTimeout(120_000)

    const { ctx: aliceCtx, page: alice } = await spawnRealDevice(browser)
    const { ctx: bobCtx,   page: bob   } = await spawnRealDevice(browser)

    // ── Alice: Hub einrichten ────────────────────────────────────────────────
    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)
    createdUsers.push(aliceId.deviceId)

    // ── Bob: Hub aktivieren + vorhandene Daten aufbauen ──────────────────────
    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)
    createdUsers.push(bobId.deviceId)

    // Vorhandenen Freund (Charlie) injizieren
    await injectOnlineFriend(bob, 'Charlie', '00000000-0000-4000-8000-000000000099', 'charlie-pub-key')

    // Drei Erinnerungen anlegen
    await seedAnswer(bob, 'hub-q-1', 'childhood', 'Urlaub am Bodensee.')
    await seedAnswer(bob, 'hub-q-2', 'school',    'Abitur mit Auszeichnung.')
    await seedAnswer(bob, 'hub-q-3', 'career',    'Erster Job in München.')

    // ── Bob öffnet Alices Einladungslink ─────────────────────────────────────
    await bob.goto(contactPath('Alice', aliceId.deviceId, aliceId.publicKey))
    await expect(bob.getByRole('heading', { name: 'Kontakt verknüpfen' })).toBeVisible()
    await expect(bob.getByText(/Alice/).first()).toBeVisible()

    // Hub bereits aktiv → Auto-Accept: "Meinen Link zurück senden" erscheint direkt
    await expect(
      bob.getByRole('button', { name: /Meinen Link zurück senden/ }),
    ).toBeVisible({ timeout: 15_000 })

    // ── Datenintegrität prüfen ───────────────────────────────────────────────

    const bobsFriends = await readOnlineFriends(bob)
    const friendNames = bobsFriends.map(f => f.name)

    // Alice wurde hinzugefügt
    expect(friendNames).toContain('Alice')

    // Charlie ist noch vorhanden
    expect(friendNames).toContain('Charlie')

    // Alle drei Erinnerungen unverändert
    const answers = await bob.evaluate(() => {
      const b = (window as unknown as {
        __rmState?: { get: () => Record<string, unknown> | null }
      }).__rmState
      return (b?.get()?.answers ?? {}) as Record<string, { value: string }>
    })
    expect(answers['hub-q-1']?.value).toBe('Urlaub am Bodensee.')
    expect(answers['hub-q-2']?.value).toBe('Abitur mit Auszeichnung.')
    expect(answers['hub-q-3']?.value).toBe('Erster Job in München.')

    // Profilname unverändert
    const profileName = await bob.evaluate(() => {
      const b = (window as unknown as {
        __rmState?: { get: () => Record<string, unknown> | null }
      }).__rmState
      const s = b?.get()
      return (s?.profile as { name?: string } | null)?.name ?? null
    })
    expect(profileName).toBe('Bob')

    await aliceCtx.close()
    await bobCtx.close()
  })
})

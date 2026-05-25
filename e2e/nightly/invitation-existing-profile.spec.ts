// Regression tests: accepting an invitation link must not overwrite an
// existing user's profile, answers or settings.
//
// Two scenarios:
//
//   1. Benutzer ohne aktiven Hub  – Bob has answers + profile but has NOT yet
//      opened the family hub. He receives Alice's invite link, activates
//      online sharing from the "Kontakt verknüpfen" screen and the contact is
//      accepted automatically.  All pre-existing data must survive.
//
//   2. Benutzer mit aktivem Hub   – Bob already has the hub running and one
//      injected friend (Charlie).  Bob visits Alice's invite link, completes
//      the pack quiz, and the contact is auto-accepted.
//      Charlie must still be there; Bob's answers must be intact.
//
// Both tests run against the real Supabase backend.
// Cleanup: afterEach removes all created auth users.

import { test, expect } from '@playwright/test'
import {
  completeOnboarding,
  injectOnlineFriend,
  openFamilyHub,
  readDeviceIdentity,
  readOnlineFriends,
  seedAnswer,
} from '../helpers/family-mode-helpers'
import { cleanupUsers, createTestInviteUrl, spawnRealDevice, supabaseAdmin } from './helpers'

test.describe('Einladungslink – bestehende Daten bleiben erhalten', () => {
  const createdUsers: string[] = []
  const admin = supabaseAdmin()

  test.afterEach(async () => {
    await cleanupUsers(admin, createdUsers.splice(0))
  })

  // ── 1. Benutzer ohne aktiven Hub ────────────────────────────────────────────

  test('invitation-without-hub: Erinnerungen und Einstellungen bleiben nach Einladungsannahme erhalten', async ({
    browser,
  }, testInfo) => {
    test.setTimeout(180_000)

    const { ctx: aliceCtx, page: alice } = await spawnRealDevice(browser)
    const { ctx: bobCtx,   page: bob   } = await spawnRealDevice(browser)

    // ── Alice: Hub einrichten und Invite-Link erstellen ──────────────────────
    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)
    createdUsers.push(aliceId.deviceId)

    // Pass the project's baseURL (e.g. https://www.storyhold.app in production,
    // http://localhost:4174 locally) so the invite link points at the right server.
    const appBaseUrl = testInfo.project.use.baseURL ?? 'http://localhost:4174'
    const inviteUrl = await createTestInviteUrl(admin, {
      displayName: 'Alice',
      deviceId: aliceId.deviceId,
      publicKey: aliceId.publicKey,
    }, appBaseUrl)

    // ── Bob: Profil aufbauen ohne den Hub zu aktivieren ──────────────────────
    await completeOnboarding(bob, 'Bob')

    await seedAnswer(bob, 'invite-q-childhood', 'childhood', 'Ich bin in Hamburg aufgewachsen.')
    await seedAnswer(bob, 'invite-q-school',    'school',    'Meine Lieblingsschulfach war Musik.')

    await bob.evaluate(() => {
      type Bridge = { get: () => Record<string, unknown> | null; save: (s: unknown) => void }
      const bridge = (window as unknown as { __rmState?: Bridge }).__rmState
      const state = bridge?.get() ?? {}
      state.appMode = 'simplified'
      bridge?.save(state)
    })

    // ── Bob öffnet Alices Einladungslink ─────────────────────────────────────
    await bob.goto(inviteUrl)

    // PersonalPackReceiveView: Alice's name appears in the header.
    await expect(bob.getByText(/Alice/i)).toBeVisible({ timeout: 15_000 })

    // Bob completes the pack (enter name + answer the one question).
    const nameInput = bob.getByTestId('sandra-receive-name')
    if (await nameInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await nameInput.fill('Bob')
      await bob.getByTestId('sandra-receive-start').click()
    }
    const answerBox = bob.getByTestId('sandra-receive-answer')
    if (await answerBox.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await answerBox.fill('Eine schöne Antwort.')
      await bob.getByTestId('sandra-receive-continue').click()
    }

    // ContactHandshakeView: Online-Sharing still not active → "einrichten" button.
    await expect(
      bob.getByRole('button', { name: /Online-Teilen einrichten/ }),
    ).toBeVisible({ timeout: 30_000 })

    await bob.getByRole('button', { name: /Online-Teilen einrichten/ }).click()

    // Wait for bootstrap + auto-accept (Alice added as friend).
    await bob.waitForFunction(() => {
      type Bridge = { get: () => Record<string, unknown> | null }
      const bridge = (window as unknown as { __rmState?: Bridge }).__rmState
      const s = bridge?.get() ?? {}
      const friends = (s.friends as Array<{ name: string }>) ?? []
      return friends.some(f => f.name === 'Alice')
    }, undefined, { timeout: 65_000 })

    const bobId = await readDeviceIdentity(bob)
    createdUsers.push(bobId.deviceId)

    // ── Datenintegrität prüfen ───────────────────────────────────────────────

    const bobsFriends = await readOnlineFriends(bob)
    expect(bobsFriends.map(f => f.name)).toContain('Alice')

    const answers = await bob.evaluate(() => {
      const b = (window as unknown as {
        __rmState?: { get: () => Record<string, unknown> | null }
      }).__rmState
      return (b?.get()?.answers ?? {}) as Record<string, { value: string }>
    })
    expect(answers['invite-q-childhood']?.value).toBe('Ich bin in Hamburg aufgewachsen.')
    expect(answers['invite-q-school']?.value).toBe('Meine Lieblingsschulfach war Musik.')

    const profileName = await bob.evaluate(() => {
      const b = (window as unknown as {
        __rmState?: { get: () => Record<string, unknown> | null }
      }).__rmState
      const s = b?.get()
      return (s?.profile as { name?: string } | null)?.name ?? null
    })
    expect(profileName).toBe('Bob')

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
  }, testInfo) => {
    test.setTimeout(180_000)

    const { ctx: aliceCtx, page: alice } = await spawnRealDevice(browser)
    const { ctx: bobCtx,   page: bob   } = await spawnRealDevice(browser)

    // ── Alice: Hub einrichten ────────────────────────────────────────────────
    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)
    createdUsers.push(aliceId.deviceId)

    const appBaseUrl = testInfo.project.use.baseURL ?? 'http://localhost:4174'
    const inviteUrl = await createTestInviteUrl(admin, {
      displayName: 'Alice',
      deviceId: aliceId.deviceId,
      publicKey: aliceId.publicKey,
    }, appBaseUrl)

    // ── Bob: Hub aktivieren + vorhandene Daten aufbauen ──────────────────────
    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)
    createdUsers.push(bobId.deviceId)

    await injectOnlineFriend(bob, 'Charlie', '00000000-0000-4000-8000-000000000099', 'charlie-pub-key')

    await seedAnswer(bob, 'hub-q-1', 'childhood', 'Urlaub am Bodensee.')
    await seedAnswer(bob, 'hub-q-2', 'school',    'Abitur mit Auszeichnung.')
    await seedAnswer(bob, 'hub-q-3', 'career',    'Erster Job in München.')

    // ── Bob öffnet Alices Einladungslink ─────────────────────────────────────
    await bob.goto(inviteUrl)

    // PersonalPackReceiveView: Alice's name appears.
    await expect(bob.getByText(/Alice/i)).toBeVisible({ timeout: 15_000 })

    // Bob already has a profile → existing-user fast-path.
    const existingStart = bob.getByTestId('sandra-receive-existing-start')
    if (await existingStart.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await existingStart.click()
    } else {
      const nameInput = bob.getByTestId('sandra-receive-name')
      if (await nameInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await nameInput.fill('Bob')
        await bob.getByTestId('sandra-receive-start').click()
      }
    }

    const answerBox = bob.getByTestId('sandra-receive-answer')
    if (await answerBox.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await answerBox.fill('Eine schöne Antwort.')
      await bob.getByTestId('sandra-receive-continue').click()
    }

    // Hub already active → Alice is auto-accepted immediately.
    await bob.waitForFunction(() => {
      type Bridge = { get: () => Record<string, unknown> | null }
      const bridge = (window as unknown as { __rmState?: Bridge }).__rmState
      const s = bridge?.get() ?? {}
      const friends = (s.friends as Array<{ name: string }>) ?? []
      return friends.some(f => f.name === 'Alice')
    }, undefined, { timeout: 30_000 })

    // ── Datenintegrität prüfen ───────────────────────────────────────────────

    const bobsFriends = await readOnlineFriends(bob)
    const friendNames = bobsFriends.map(f => f.name)

    expect(friendNames).toContain('Alice')
    expect(friendNames).toContain('Charlie')

    const answers = await bob.evaluate(() => {
      const b = (window as unknown as {
        __rmState?: { get: () => Record<string, unknown> | null }
      }).__rmState
      return (b?.get()?.answers ?? {}) as Record<string, { value: string }>
    })
    expect(answers['hub-q-1']?.value).toBe('Urlaub am Bodensee.')
    expect(answers['hub-q-2']?.value).toBe('Abitur mit Auszeichnung.')
    expect(answers['hub-q-3']?.value).toBe('Erster Job in München.')

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

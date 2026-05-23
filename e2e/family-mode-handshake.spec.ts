import { test, expect } from '@playwright/test'
import {
  completeOnboarding,
  createMockState,
  dismissInstallPrompt,
  installSupabaseMock,
  invitePath,
  openFamilyHub,
  readOnlineFriends,
  seedInvite,
  spawnDevice,
} from './helpers/family-mode-helpers'

// REQ-015 §4.2 Kontakt-Handshake – neue Invite-Code-Architektur.
//
// Links sind jetzt `/join/CODE` statt `?contact=…`. Der Code löst einen
// Supabase-Lookup auf, der Pack + Kontakt zurückgibt. Nach dem Quiz wird
// die Kontaktaufnahme automatisch bidirektional: Ingrids Kontakt wird in
// die `invites.response`-Spalte geschrieben; Sandras App pollt und fügt
// Ingrid automatisch hinzu.

const ALICE = {
  senderName: 'Alice',
  senderDeviceId: '00000000-0000-4000-8000-000000000001',
  senderPublicKey: 'ALICE_FAKE_PUBLIC_KEY',
}

test.describe('Familienmodus – Invite-Code Handshake', () => {
  test('Empfänger öffnet /join/-Link → PersonalPackReceiveView mit Absendername erscheint', async ({
    context,
    page,
  }) => {
    const state = createMockState()
    await dismissInstallPrompt(context)
    await installSupabaseMock(context, state)

    const code = seedInvite(state, ALICE)
    await page.goto(invitePath(code))

    // PersonalPackReceiveView shows the sender's name in its header.
    await expect(page.getByText(/Alice/i)).toBeVisible({ timeout: 15_000 })
    // URL is cleaned to / after the invite is resolved.
    await expect.poll(() => page.url()).not.toContain('/join/')
  })

  test('Unbekannter Code → App landet auf Home ohne Crash', async ({ context, page }) => {
    const state = createMockState()
    await dismissInstallPrompt(context)
    await installSupabaseMock(context, state)

    // No invite seeded → resolveInviteCode will return 406 (no rows).
    await page.goto(invitePath('UNKNOW'))

    // App must not crash; URL is cleared.
    await expect.poll(() => page.url()).not.toContain('/join/')
    // Home view renders (no error overlay).
    await expect(page.locator('body')).not.toContainText('invite-not-found')
  })

  test('Empfänger ohne Opt-in öffnet /join/-Link → PersonalPackReceiveView erscheint (Handshake wartet)', async ({
    context,
    page,
  }) => {
    const state = createMockState()
    await dismissInstallPrompt(context)
    await installSupabaseMock(context, state)
    // Pre-seed a profile but WITHOUT online sharing.
    await context.addInitScript(() => {
      localStorage.setItem('remember-me-state', JSON.stringify({
        profile: { name: 'Bob', createdAt: '2024-01-01T00:00:00.000Z' },
        answers: {}, friends: [], friendAnswers: [],
        customQuestions: [], appMode: 'full',
      }))
    })

    const code = seedInvite(state, ALICE)
    await page.goto(invitePath(code))

    // Pack still appears — opt-in is not required to view the quiz.
    await expect(page.getByText(/Alice/i)).toBeVisible({ timeout: 15_000 })
  })

  test('Bidirektionale Verknüpfung: Bob beantwortet Pack → Alice in Bobs Freundesliste', async ({
    browser,
  }) => {
    const state = createMockState()
    const { ctx: bobCtx, page: bob } = await spawnDevice(browser, state)

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)

    const code = seedInvite(state, ALICE)
    await bob.goto(invitePath(code))

    // PersonalPackReceiveView: enter name and start the quiz.
    // The welcome screen shows "{senderName} hat dir {n} Fragen geschickt".
    await expect(bob.getByText(/Alice/i)).toBeVisible({ timeout: 15_000 })
    const nameInput = bob.getByTestId('sandra-receive-name')
    if (await nameInput.isVisible().catch(() => false)) {
      // New user: fill name and start.
      await nameInput.fill('Bob')
      await bob.getByTestId('sandra-receive-start').click()
    } else {
      // Existing user fast-path.
      const existingStart = bob.getByTestId('sandra-receive-existing-start')
      if (await existingStart.isVisible().catch(() => false)) {
        await existingStart.click()
      }
    }

    // Answer the one question (or skip via "Später beantworten").
    const answerBox = bob.getByTestId('sandra-receive-answer')
    await expect(answerBox).toBeVisible({ timeout: 10_000 })
    await answerBox.fill('Eine schöne Antwort.')
    await bob.getByTestId('sandra-receive-continue').click()

    // After the pack completes, ContactHandshakeView appears. Since online sharing
    // is already active (openFamilyHub activated it), the handshake auto-accepts.
    // Alice should appear in Bob's friends list.
    await bob.waitForFunction(() => {
      type Bridge = { get: () => Record<string, unknown> | null }
      const bridge = (window as unknown as { __rmState?: Bridge }).__rmState
      const s = bridge?.get() ?? {}
      const friends = (s.friends as Array<{ online?: { deviceId: string } }>) ?? []
      return friends.some(f => f.online?.deviceId === '00000000-0000-4000-8000-000000000001')
    }, undefined, { timeout: 20_000 })

    const bobsFriends = await readOnlineFriends(bob)
    expect(bobsFriends.map(f => f.name)).toContain('Alice')

    // Supabase mock should have received Bob's contact in invites.response.
    const invite = state.invites.find(r => r.code === code)
    expect(invite?.response).not.toBeNull()

    await bobCtx.close()
  })
})

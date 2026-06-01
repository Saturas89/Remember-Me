import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { createMockState, installSupabaseMock, type MockState } from './supabase-mock'

// Shared helpers for the Familienmodus E2E suites split across:
//   • family-mode-activation.spec.ts
//   • family-mode-handshake.spec.ts
//   • family-mode-share.spec.ts
//   • family-mode-deactivation.spec.ts

export async function dismissInstallPrompt(context: BrowserContext) {
  await context.addInitScript(() => {
    localStorage.setItem('rm-install-dismissed', '1')
    localStorage.setItem('rm-landing-seen', '1')
    // E2E: only seed on first navigation – tests that build state via
    // __rmState.save between gotos must not be reset by a re-run init script.
    if (!localStorage.getItem('remember-me-state')) {
      localStorage.setItem('remember-me-state', JSON.stringify({
        profile: null, answers: {}, friends: [], friendAnswers: [],
        customQuestions: [], appMode: 'full',
      }))
    }
  })
}

export async function spawnDevice(
  browser: Browser,
  state: MockState,
): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ serviceWorkers: 'block' })
  await dismissInstallPrompt(ctx)
  await installSupabaseMock(ctx, state)
  const page = await ctx.newPage()
  return { ctx, page }
}

export async function completeOnboarding(page: Page, name: string) {
  await page.goto('/')
  await page.getByLabel('Wie heißt du?').fill(name)
  await page.getByRole('button', { name: /Loslegen/ }).click()
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  await expect(page.getByText(new RegExp(`Hallo,\\s*${escapedName}`))).toBeVisible()
}

export async function openFamilyTab(page: Page) {
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  await nav.getByRole('button', { name: 'Familie', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Familienmodus', exact: true })).toBeVisible()
}

/** @deprecated Use openFamilyTab */
export const openFriendsTab = openFamilyTab

/**
 * Aktiviert den Familienmodus und wartet bis der Hub bereit ist.
 *
 * Nutzt direktes State-Inject (wie `injectOnlineFriend`) statt des UI-Flows,
 * um Timing-Races mit dem Full-Page-Navigation-Muster zu vermeiden.
 * Tests, die explizit den Invite-Button prüfen, nutzen stattdessen openFamilyTab().
 */
export async function openFamilyHub(page: Page) {
  // Inject onlineSharing.enabled if not already set.
  await page.evaluate(() => {
    type Bridge = { get: () => Record<string, unknown> | null; save?: (s: unknown) => void }
    const bridge = (window as unknown as { __rmState?: Bridge }).__rmState
    const state: Record<string, unknown> = bridge?.get() ?? {}
    const os = state.onlineSharing as Record<string, unknown> | undefined
    if (!os?.enabled) {
      state.onlineSharing = { enabled: true, activatedAt: new Date().toISOString() }
      if (bridge?.save) {
        // E2E build (VITE_E2E=true): update in-memory state via bridge.
        bridge.save(state)
      } else {
        // Production build: bridge.save is not exposed. Write onlineSharing
        // directly to localStorage so the next page.goto picks it up.
        const raw = localStorage.getItem('remember-me-state')
        const stored: Record<string, unknown> = raw ? JSON.parse(raw) : {}
        stored.onlineSharing = { enabled: true, activatedAt: new Date().toISOString() }
        localStorage.setItem('remember-me-state', JSON.stringify(stored))
      }
    }
  })
  await page.goto('/friends')
  await waitForHubReady(page)
}

/**
 * For tests that already activated online sharing AND already linked at
 * least one contact (so the two-tab nav is what we expect to see).
 * Re-enters the hub from `/friends` after a full reload (e.g. after the
 * recipient has to refresh to pick up new shares).
 *
 * Crucially this waits for both `sync.ready` (no "Verbinde mit Server …"
 * placeholder) AND the `tablist` itself, since the tab nav only
 * renders once `hasContacts` *and* `sync.ready` are both true – there is a
 * race window in which one of the two flips first.
 */
export async function reopenFamilyHub(page: Page) {
  // /friends leitet automatisch zum Hub weiter (wenn Online-Kontakte vorhanden).
  await page.goto('/friends')
  await waitForHubReady(page)
  await expect(page.getByRole('tablist')).toBeVisible({ timeout: 20_000 })
}

async function waitForHubReady(page: Page) {
  // Check heading first: it renders as soon as the app loads and redirects to
  // online-hub, giving a quick positive signal that the view is mounted.
  // The 35 s window is intentionally generous for production-nightly runs
  // where IDB initialisation can delay the first render.  The primary guard
  // against an infinite IDB hang lives in stateStorage.ts openKeyDb() which
  // times out after 3 s and falls back to plaintext, ensuring isLoaded
  // becomes true and the heading appears well within this window.
  await expect(page.getByRole('heading', { name: 'Familienmodus', exact: true })).toBeVisible({ timeout: 60_000 })
  // Wait for a positive signal: deviceId set in state means bootstrapSession()
  // succeeded. "Verbinde mit Server …" disappears on both success AND error, so
  // its absence is not a reliable sentinel — it leads to 35 s readDeviceIdentity
  // timeouts whenever bootstrapSession() throws.
  await page.waitForFunction(
    () => {
      try {
        const p = (window as unknown as { __rmState?: { get: () => Record<string, unknown> | null } }).__rmState?.get()
        const os = p?.onlineSharing as Record<string, unknown> | undefined
        return Boolean(os?.deviceId && os?.publicKey)
      } catch { return false }
    },
    undefined,
    { timeout: 45_000 },
  )
}

export async function readDeviceIdentity(page: Page): Promise<{ deviceId: string; publicKey: string }> {
  await page.waitForFunction(() => {
    try {
      const p = (window as unknown as { __rmState?: { get: () => Record<string, unknown> | null } }).__rmState?.get()
      return Boolean(p?.onlineSharing && (p.onlineSharing as Record<string, unknown>).deviceId && (p.onlineSharing as Record<string, unknown>).publicKey)
    } catch { return false }
  }, undefined, { timeout: 35_000 })

  return await page.evaluate(() => {
    const p = (window as unknown as { __rmState: { get: () => Record<string, unknown> } }).__rmState.get()
    const os = p.onlineSharing as Record<string, string>
    return { deviceId: os.deviceId, publicKey: os.publicKey }
  })
}

export async function readOnlineFriends(
  page: Page,
): Promise<Array<{ name: string; online?: { deviceId: string; publicKey: string } }>> {
  return await page.evaluate(() => {
    const p = (window as unknown as { __rmState?: { get: () => Record<string, unknown> | null } }).__rmState?.get()
    if (!p) return []
    return ((p.friends as Array<{ online?: unknown }>) ?? []).filter(f => f.online)
  })
}

export async function seedAnswer(
  page: Page,
  questionId: string,
  categoryId: string,
  value: string,
) {
  // NOTE: seedAnswer writes localStorage + the __rmState bridge's
  // _currentState, but it does NOT push into React's useState. Callers
  // that need the running app to react to the seeded answer (e.g. to
  // trigger useAutoShare) must seed BEFORE reopenFamilyHub() so the next
  // page load picks the value out of localStorage.
  await page.evaluate(({ questionId, categoryId, value }) => {
    type Bridge = { get: () => Record<string, unknown> | null; save: (s: unknown) => void }
    const bridge = (window as unknown as { __rmState?: Bridge }).__rmState
    const state: Record<string, unknown> = bridge?.get() ?? {}
    const answers = (state.answers as Record<string, unknown>) ?? {}
    const now = new Date().toISOString()
    answers[questionId] = { id: questionId, questionId, categoryId, value, createdAt: now, updatedAt: now }
    state.answers = answers
    bridge?.save(state)
  }, { questionId, categoryId, value })
}

/**
 * Inserts a Friend with `online` block directly into localStorage, bypassing
 * the contact-handshake screen flow. Useful when a test needs the linked
 * state but is not specifically testing the handshake UI.
 *
 * Defaults `shareAll: true` (REQ-022 §4.2 default) so subsequent auto-share
 * tests get the same starting state as the real handshake flow.
 */
export async function injectOnlineFriend(
  page: Page,
  name: string,
  deviceId: string,
  publicKey: string,
  shareAll = true,
) {
  await page.evaluate(({ name, deviceId, publicKey, shareAll }) => {
    type Bridge = { get: () => Record<string, unknown> | null; save: (s: unknown) => void }
    const bridge = (window as unknown as { __rmState?: Bridge }).__rmState
    const state: Record<string, unknown> = bridge?.get() ?? {}
    const friends = (state.friends as Array<{ online?: { deviceId?: string } }>) ?? []
    if (!friends.find(f => f.online?.deviceId === deviceId)) {
      friends.push({
        id: `friend-${deviceId}`,
        name,
        addedAt: new Date().toISOString(),
        online: { deviceId, publicKey, linkedAt: new Date().toISOString(), shareAll },
      })
    }
    state.friends = friends
    bridge?.save(state)
  }, { name, deviceId, publicKey, shareAll })
}

/**
 * Waits until the auto-share queue has produced at least `minShares` shares
 * in the in-memory Supabase mock. Useful for asserting that
 * useAutoShare picked up a seeded answer.
 *
 * Pass `minRecipients` to also wait for the ACL rows – shares and
 * share_recipients are inserted in two separate HTTP calls, so there is a
 * narrow window where a share row exists but its ACL rows have not arrived
 * yet.  Callers that immediately check `state.share_recipients` should pass
 * the expected recipient count here instead of adding a sleep.
 */
export async function waitForShares(
  state: MockState,
  minShares: number,
  timeoutMs = 15_000,
  minRecipients = 0,
): Promise<void> {
  const start = Date.now()
  while (state.shares.length < minShares || state.share_recipients.length < minRecipients) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        `Timed out waiting for ${minShares} share(s) / ${minRecipients} recipient(s); `
        + `got ${state.shares.length} / ${state.share_recipients.length}`,
      )
    }
    await new Promise(r => setTimeout(r, 250))
  }
}

const INVITE_ALPHABET = 'ACDEFGHJKMNPQRTVWXYZ234679'

function generateInviteCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)]
  }
  return code
}

/**
 * Pre-seeds an invite row directly in the in-memory MockState so tests can
 * open `/join/<code>` without driving the full Sandra flow.
 *
 * Returns the code so the caller can construct the URL via `invitePath(code)`.
 */
export function seedInvite(
  state: MockState,
  options: {
    code?: string
    senderName: string
    senderDeviceId: string
    senderPublicKey: string
    questions?: Array<{ id: string; text: string; type: 'text'; createdAt: string }>
  },
): string {
  const code = options.code ?? generateInviteCode()
  const now = new Date()
  const exp = new Date(now)
  exp.setDate(exp.getDate() + 30)
  const contact = {
    $type: 'remember-me-contact' as const,
    version: 1,
    deviceId: options.senderDeviceId,
    publicKey: options.senderPublicKey,
    displayName: options.senderName,
  }
  const pack = {
    personalPack: true as const,
    senderName: options.senderName,
    recipientLabel: 'mama',
    anrede: 'Mama',
    questions: options.questions ?? [
      {
        id: 'q-seed-1',
        text: 'Was war dein schönster Moment?',
        type: 'text' as const,
        createdAt: now.toISOString(),
      },
    ],
  }
  state.invites.push({
    code,
    payload: { pack, contact },
    response: null,
    created_at: now.toISOString(),
    expires_at: exp.toISOString(),
  })
  return code
}

/** URL path for a `/join/` invite link. */
export function invitePath(code: string): string {
  return `/join/${code}`
}

// Re-export so individual specs can `import { createMockState, ... }` from a
// single place rather than reaching into the lower-level mock module.
export { createMockState, installSupabaseMock, type MockState }

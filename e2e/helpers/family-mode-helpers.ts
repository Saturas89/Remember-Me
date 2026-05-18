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

export async function openFriendsTab(page: Page) {
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  await nav.getByRole('button', { name: 'Freunde', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Einladen & verbinden/ })).toBeVisible()
}

/**
 * Click "Familienmodus" and walk through the consent screen if it shows up.
 * Resolves once the hub is rendered AND `sync.ready` (deviceId persisted in
 * localStorage) so subsequent share/annotate operations have a session.
 */
export async function openFamilyHub(page: Page) {
  await openFriendsTab(page)
  await page.getByTestId('open-online-sharing').click()
  // On mobile WebKit the React state update triggered by the click may not
  // have completed when click() resolves, so the point-in-time isVisible()
  // check would return false even though the consent screen is about to
  // appear. waitFor polls the DOM until the heading is present (or the hub
  // heading appears instead, in which case we can skip the consent step).
  const consentHeading = page.getByRole('heading', { name: 'Laufend verbunden bleiben', exact: true })
  const consentVisible = await consentHeading
    .waitFor({ state: 'visible', timeout: 20_000 })
    .then(() => true)
    .catch(() => false)
  if (consentVisible) {
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Aktivieren', exact: true }).click()
  }
  await waitForHubReady(page)
}

/**
 * For tests that already activated online sharing AND already linked at
 * least one contact (so the four-tab nav is what we expect to see).
 * Re-enters the hub from `/friends` after a full reload (e.g. after the
 * recipient has to refresh to pick up new shares).
 *
 * Crucially this waits for both `sync.ready` (no "Verbinde mit Server …"
 * placeholder) AND the four-tab `tablist` itself, since the tab nav only
 * renders once `hasContacts` *and* `sync.ready` are both true – there is a
 * race window in which one of the two flips first.
 */
export async function reopenFamilyHub(page: Page) {
  await page.goto('/friends')
  await page.getByTestId('open-online-sharing').click()
  await waitForHubReady(page)
  await expect(page.getByRole('tablist')).toBeVisible({ timeout: 20_000 })
}

async function waitForHubReady(page: Page) {
  await expect(page.getByRole('heading', { name: 'Online teilen', exact: true })).toBeVisible({ timeout: 35_000 })
  // Wait for a positive signal: deviceId set in state means bootstrapSession()
  // succeeded. "Verbinde mit Server …" disappears on both success AND error, so
  // its absence is not a reliable sentinel — it leads to 35 s readDeviceIdentity
  // timeouts whenever bootstrapSession() throws.
  await page.waitForFunction(() => {
    try {
      const p = (window as unknown as { __rmState?: { get: () => Record<string, unknown> | null } }).__rmState?.get()
      const os = p?.onlineSharing as Record<string, unknown> | undefined
      return Boolean(os?.deviceId && os?.publicKey)
    } catch { return false }
  }, undefined, { timeout: 45_000 })
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
 */
export async function injectOnlineFriend(
  page: Page,
  name: string,
  deviceId: string,
  publicKey: string,
) {
  await page.evaluate(({ name, deviceId, publicKey }) => {
    type Bridge = { get: () => Record<string, unknown> | null; save: (s: unknown) => void }
    const bridge = (window as unknown as { __rmState?: Bridge }).__rmState
    const state: Record<string, unknown> = bridge?.get() ?? {}
    const friends = (state.friends as Array<{ online?: { deviceId?: string } }>) ?? []
    if (!friends.find(f => f.online?.deviceId === deviceId)) {
      friends.push({
        id: `friend-${deviceId}`,
        name,
        addedAt: new Date().toISOString(),
        online: { deviceId, publicKey, linkedAt: new Date().toISOString() },
      })
    }
    state.friends = friends
    bridge?.save(state)
  }, { name, deviceId, publicKey })
}

export function contactPath(displayName: string, deviceId: string, publicKey: string): string {
  const handshake = JSON.stringify({
    $type: 'remember-me-contact',
    version: 1,
    deviceId,
    publicKey,
    displayName,
  })
  const b64 = Buffer.from(handshake, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `/?contact=${b64}`
}

// Re-export so individual specs can `import { createMockState, ... }` from a
// single place rather than reaching into the lower-level mock module.
export { createMockState, installSupabaseMock, type MockState }

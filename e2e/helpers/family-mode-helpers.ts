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
  })
}

export async function spawnDevice(
  browser: Browser,
  state: MockState,
  label = 'device',
): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ serviceWorkers: 'block' })
  await dismissInstallPrompt(ctx)
  await installSupabaseMock(ctx, state)
  const page = await ctx.newPage()
  page.on('pageerror', e => console.log(`[${label} pageerror]`, e.message))
  return { ctx, page }
}

export async function completeOnboarding(page: Page, name: string) {
  await page.goto('/')
  await page.getByLabel('Wie heißt du?').fill(name)
  await page.getByRole('button', { name: /Loslegen/ }).click()
  await expect(page.getByText(new RegExp(`Hallo,\\s*${name}`))).toBeVisible()
}

export async function openFriendsTab(page: Page) {
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  await nav.getByRole('button', { name: 'Freunde', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Erinnerung einsammeln/ })).toBeVisible()
}

/**
 * Click "Familienmodus" and walk through the consent screen if it shows up.
 * Resolves once the hub is rendered AND `sync.ready` (deviceId persisted in
 * localStorage) so subsequent share/annotate operations have a session.
 */
export async function openFamilyHub(page: Page) {
  await openFriendsTab(page)
  await page.getByTestId('open-online-sharing').click()
  if (await page
    .getByRole('heading', { name: 'Familienmodus', exact: true })
    .isVisible()
    .catch(() => false)) {
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Aktivieren', exact: true }).click()
  }
  await expect(page.getByRole('heading', { name: 'Online teilen', exact: true })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/Verbinde mit Server …/)).toHaveCount(0, { timeout: 15_000 })
}

export async function readDeviceIdentity(page: Page): Promise<{ deviceId: string; publicKey: string }> {
  await page.waitForFunction(() => {
    try {
      const raw = localStorage.getItem('remember-me-state')
      if (!raw) return false
      const p = JSON.parse(raw)
      return Boolean(p?.onlineSharing?.deviceId && p?.onlineSharing?.publicKey)
    } catch { return false }
  }, undefined, { timeout: 15_000 })

  return await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('remember-me-state') as string)
    return {
      deviceId: p.onlineSharing.deviceId as string,
      publicKey: p.onlineSharing.publicKey as string,
    }
  })
}

export async function readOnlineFriends(
  page: Page,
): Promise<Array<{ name: string; online?: { deviceId: string; publicKey: string } }>> {
  return await page.evaluate(() => {
    const raw = localStorage.getItem('remember-me-state')
    if (!raw) return []
    try {
      const p = JSON.parse(raw)
      return (p.friends ?? []).filter((f: { online?: unknown }) => f.online)
    } catch { return [] }
  })
}

export async function seedAnswer(
  page: Page,
  questionId: string,
  categoryId: string,
  value: string,
) {
  await page.evaluate(({ questionId, categoryId, value }) => {
    const raw = localStorage.getItem('remember-me-state') ?? '{}'
    const state = JSON.parse(raw)
    state.answers = state.answers ?? {}
    const now = new Date().toISOString()
    state.answers[questionId] = {
      id: questionId,
      questionId,
      categoryId,
      value,
      createdAt: now,
      updatedAt: now,
    }
    localStorage.setItem('remember-me-state', JSON.stringify(state))
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
    const raw = localStorage.getItem('remember-me-state') ?? '{}'
    const state = JSON.parse(raw)
    state.friends = state.friends ?? []
    if (!state.friends.find((f: { online?: { deviceId?: string } }) => f.online?.deviceId === deviceId)) {
      state.friends.push({
        id: `friend-${deviceId}`,
        name,
        addedAt: new Date().toISOString(),
        online: { deviceId, publicKey, linkedAt: new Date().toISOString() },
      })
    }
    localStorage.setItem('remember-me-state', JSON.stringify(state))
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

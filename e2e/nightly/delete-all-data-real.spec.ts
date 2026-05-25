// Nightly E2E tests for the "Alle Daten löschen" (DSGVO Art. 17) feature.
//
// Two scenarios:
//   1. local-only  – profile with answers, no cloud sync
//      → confirms dialog → page reloads → localStorage cleared → onboarding shown
//   2. with-sync   – profile with active Supabase cloud sync
//      → confirms dialog → deactivate(true) deletes private_sync_state row
//      → page reloads → localStorage cleared → onboarding shown
//
// Dialog handling: window.confirm() is a native browser dialog; Playwright
// captures it via page.once('dialog', d => d.accept()) before the click.
//
// Cleanup: afterEach deletes created auth.users rows via the admin API.
// The private_sync_state row is CASCADE-deleted automatically by Supabase
// FK constraint when the auth user is removed.

import { test, expect } from '@playwright/test'
import { spawnRealDevice, supabaseAdmin, cleanupUsers } from './helpers'
import { completeOnboarding } from '../helpers/family-mode-helpers'
import { runSetupWizard, readSyncUserId } from './private-sync-helpers'

const TEST_EMAIL_BASE = 'e2e-delete-all'
const TEST_PASSWORD   = 'Supabase-E2E-2026!'

function testEmail(suffix: string): string {
  return `${TEST_EMAIL_BASE}-${suffix}-${Date.now()}@example.invalid`
}

// ── Shared helpers ─────────────────────────────────────────────────────────

/** Opens the profile tab and scrolls to the delete-all button. */
async function openProfileAndScrollToDelete(page: import('@playwright/test').Page) {
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  await nav.getByRole('button', { name: 'Profil', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Fortschritt' })).toBeVisible()

  const deleteBtn = page.getByTestId('profile-delete-all')
  await deleteBtn.scrollIntoViewIfNeeded()
  await expect(deleteBtn).toBeVisible()
  return deleteBtn
}

/** Clicks the delete button, accepts the native confirm dialog, waits for
 *  the page to reload and the onboarding screen to appear. */
async function confirmDeleteAll(page: import('@playwright/test').Page) {
  const deleteBtn = page.getByTestId('profile-delete-all')

  // Register dialog handler BEFORE click – the confirm fires synchronously.
  page.once('dialog', dialog => dialog.accept())

  // The handler calls window.location.reload() → Playwright sees a navigation.
  await Promise.all([
    page.waitForNavigation({ timeout: 20_000, waitUntil: 'domcontentloaded' }),
    deleteBtn.click(),
  ])
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Alle Daten löschen – Produktion', () => {
  const createdUsers: string[] = []
  const admin = supabaseAdmin()

  test.afterEach(async () => {
    await cleanupUsers(admin, createdUsers.splice(0))
  })

  // ── 1. Local-only deletion ───────────────────────────────────────────────

  test('local-only: Daten löschen leert localStorage und zeigt Onboarding', async ({ browser }) => {
    test.setTimeout(60_000)
    const { ctx, page } = await spawnRealDevice(browser)

    await completeOnboarding(page, 'Testerin')

    // Write an answer so we have actual state to delete.
    await page.getByRole('heading', { name: 'Kindheit & Jugend' }).click()
    await expect(page.locator('textarea.input-textarea').first()).toBeVisible()
    await page.locator('textarea.input-textarea').first().fill('Eine schöne Kindheit')

    // The quiz view hides the BottomNav; navigate back to home so
    // openProfileAndScrollToDelete can find the 'Profil' nav button.
    await page.goto('/')
    await expect(page.getByText(/Hallo,\s*Testerin/)).toBeVisible()

    await openProfileAndScrollToDelete(page)
    await confirmDeleteAll(page)

    // App reloaded → no profile → onboarding is shown.
    await expect(page.getByLabel('Wie heißt du?')).toBeVisible({ timeout: 15_000 })

    // spawnRealDevice's addInitScript re-seeds a blank skeleton on every page
    // load (including this reload), so localStorage is never strictly null in
    // E2E.  Verify the user's data was cleared via the in-memory bridge instead.
    const profileAfter = await page.evaluate(() => {
      const b = (window as unknown as { __rmState?: { get: () => Record<string, unknown> | null } }).__rmState
      return (b?.get()?.profile as { name?: string } | null)?.name ?? null
    })
    expect(profileAfter).toBeNull()

    const answersAfter = await page.evaluate(() => {
      const b = (window as unknown as { __rmState?: { get: () => Record<string, unknown> | null } }).__rmState
      return Object.keys((b?.get()?.answers as Record<string, unknown>) ?? {}).length
    })
    expect(answersAfter).toBe(0)

    await ctx.close()
  })

  // ── 2. Cancelling the dialog keeps data intact ───────────────────────────

  test('abbruch: Daten bleiben erhalten wenn Dialog abgebrochen wird', async ({ browser }) => {
    test.setTimeout(60_000)
    const { ctx, page } = await spawnRealDevice(browser)

    await completeOnboarding(page, 'Behalter')

    const deleteBtn = await openProfileAndScrollToDelete(page)

    // Dismiss the dialog instead of accepting.
    page.once('dialog', dialog => dialog.dismiss())
    await deleteBtn.click()

    // Profile tab should still be visible – no reload.
    await expect(page.getByRole('heading', { name: 'Fortschritt' })).toBeVisible()

    // State is intact.  In the production build the stored value is
    // AES-GCM encrypted ("enc1:…") so JSON.parse() would throw; read
    // the plaintext value via the in-memory __rmState bridge instead.
    const state = await page.evaluate(() => localStorage.getItem('remember-me-state'))
    expect(state).not.toBeNull()
    const profileName = await page.evaluate(() => {
      const b = (window as unknown as { __rmState?: { get: () => Record<string, unknown> | null } }).__rmState
      return (b?.get()?.profile as { name?: string } | null)?.name ?? null
    })
    expect(profileName).toBe('Behalter')

    await ctx.close()
  })

  // ── 3. Cloud sync: private_sync_state row is deleted from DB ─────────────

  test('mit-sync: löscht lokale Daten und entfernt private_sync_state aus Supabase', async ({ browser }) => {
    test.setTimeout(120_000)
    const { ctx, page } = await spawnRealDevice(browser)

    await completeOnboarding(page, 'Syncer')

    const email = testEmail('main')
    await runSetupWizard(page, email, TEST_PASSWORD)

    // Read the user ID before deletion.
    const userId = await readSyncUserId(page)
    expect(userId).not.toBeNull()
    createdUsers.push(userId!)

    // Navigate back to home first, then to profile.
    // Note: the nav button is labelled 'Lebensweg', not 'Home'.
    const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
    await nav.getByRole('button', { name: 'Lebensweg', exact: true }).click()
    await expect(page.getByText(/Hallo,\s*Syncer/)).toBeVisible()

    await openProfileAndScrollToDelete(page)
    await confirmDeleteAll(page)

    // App reloaded → onboarding visible.
    await expect(page.getByLabel('Wie heißt du?')).toBeVisible({ timeout: 20_000 })

    // All localStorage is cleared.
    const stateAfter = await page.evaluate(() => localStorage.getItem('remember-me-state'))
    expect(stateAfter).toBeNull()

    // private_sync_state row must be gone from Supabase.
    // The row may not have been written yet if the 30 s debounce hadn't fired.
    // Either way – after deactivate(true) the row must not exist.
    const { data: rows } = await admin
      .from('private_sync_state')
      .select('user_id')
      .eq('user_id', userId!)
    expect(rows ?? []).toHaveLength(0)

    await ctx.close()
  })

  // ── 4. IndexedDB databases are removed ───────────────────────────────────

  test('local-only: IndexedDB-Datenbanken werden gelöscht', async ({ browser }) => {
    test.setTimeout(60_000)
    const { ctx, page } = await spawnRealDevice(browser)

    await completeOnboarding(page, 'IDB-Test')

    // Seed a dummy IndexedDB database to confirm it gets wiped.
    await page.evaluate(async () => {
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('rm-images', 1)
        req.onupgradeneeded = () => req.result.createObjectStore('data')
        req.onsuccess = () => { req.result.close(); resolve() }
        req.onerror = () => reject(req.error)
      })
    })

    const dbsBefore = await page.evaluate(async () => {
      const dbs = await indexedDB.databases()
      return dbs.map(d => d.name)
    })
    expect(dbsBefore).toContain('rm-images')

    await openProfileAndScrollToDelete(page)
    await confirmDeleteAll(page)

    await expect(page.getByLabel('Wie heißt du?')).toBeVisible({ timeout: 15_000 })

    // After reload, rm-images must not exist in IndexedDB.
    const dbsAfter = await page.evaluate(async () => {
      const dbs = await indexedDB.databases()
      return dbs.map(d => d.name)
    })
    expect(dbsAfter).not.toContain('rm-images')

    await ctx.close()
  })
})

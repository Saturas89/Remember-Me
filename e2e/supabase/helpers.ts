// Helpers for the real-DB Playwright suite (playwright.supabase.config.ts).
//
// Key difference from e2e/helpers/family-mode-helpers.ts: spawnRealDevice does
// NOT install the in-memory Supabase mock. Every Supabase call from the app
// goes to the real local PostgREST/GoTrue stack started by the CI job.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test'

const SUPABASE_URL      = process.env.SUPABASE_URL      ?? 'http://127.0.0.1:54321'
const SERVICE_KEY       = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

// Returns a service-role client for test cleanup (admin.auth.admin.deleteUser).
export function supabaseAdmin(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  })
}

// Creates a browser context that talks to the real Supabase (no mock installed).
export async function spawnRealDevice(
  browser: Browser,
): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ serviceWorkers: 'block' })
  await ctx.addInitScript(() => {
    localStorage.setItem('rm-install-dismissed', '1')
    if (!localStorage.getItem('remember-me-state')) {
      localStorage.setItem('remember-me-state', JSON.stringify({
        profile: null, answers: {}, friends: [], friendAnswers: [],
        customQuestions: [], appMode: 'full',
      }))
    }
  })
  const page = await ctx.newPage()
  return { ctx, page }
}

// Reads the onlineSharing.deviceId from app state (equals auth.uid()).
// Used to collect IDs for post-test cleanup via the admin API.
export async function readDeviceId(page: Page): Promise<string> {
  const id = await page.waitForFunction(() => {
    try {
      const s = (window as unknown as { __rmState?: { get: () => Record<string, unknown> | null } })
        .__rmState?.get()
      const os = s?.onlineSharing as Record<string, string> | undefined
      return os?.deviceId || null
    } catch { return null }
  }, undefined, { timeout: 35_000 })
  return id.jsonValue() as Promise<string>
}

// Deletes a list of users by ID via the admin API.  Cascades to devices,
// shares, annotations etc. through FK ON DELETE CASCADE in the schema.
export async function cleanupUsers(admin: SupabaseClient, ids: string[]): Promise<void> {
  await Promise.all(ids.map(id => admin.auth.admin.deleteUser(id)))
}

// Waits until the family-hub page is ready (sync.ready flag in localStorage).
export async function waitForHubReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      try {
        const raw = localStorage.getItem('rm-sync')
        return raw ? JSON.parse(raw).ready === true : false
      } catch { return false }
    },
    undefined,
    { timeout: 35_000 },
  )
  // Also wait for the hub heading to be visible.
  await expect(
    page.getByRole('heading', { name: /Familienmodus|Deine Familie|Erinnerungen teilen/i }),
  ).toBeVisible({ timeout: 10_000 })
}

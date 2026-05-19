// Google Drive device-switch E2E test — real OAuth, real Drive API.
//
// Tests the full encrypt-push → pull-decrypt cycle across two simulated
// devices.  No googleapis.com mocking: every Drive call is a real HTTP
// request to the production API.
//
// What is real (not mocked):
//   • Google OAuth via Playwright (fills accounts.google.com UI)
//   • Bearer-token exchange via Supabase PKCE callback
//   • AES-256-GCM encryption / decryption (Web Crypto)
//   • PBKDF2 vault-key derivation
//   • State merge logic (privateSyncMerge.ts)
//   • Drive file upload and download (googleapis.com)
//
// Prerequisites (CI secrets):
//   GOOGLE_TEST_EMAIL    – storyhold.e2e.google@gmail.com
//   GOOGLE_TEST_PASSWORD – Google test-account password (no 2FA)
//
// Both devices sign in as the same Google account so they share one Drive
// file.  Device 1 creates the file on first run; device 2 finds it via
// readExistingSyncId() and goes to the enter-code step.
// After each run the sync file is deleted from Drive so the next run
// always starts fresh (device 1 generates a new recovery code).

import { test, expect, type Page } from '@playwright/test'
import { spawnRealDevice } from './helpers'
import { completeOnboarding } from '../helpers/family-mode-helpers'
import { openSyncTab } from './private-sync-helpers'

const GOOGLE_EMAIL    = process.env.GOOGLE_TEST_EMAIL    ?? ''
const GOOGLE_PASSWORD = process.env.GOOGLE_TEST_PASSWORD ?? ''

const ANSWER_KEY   = 'gdrive-real-e2e-q1'
const ANSWER_VALUE = 'Gerätewechsel via Google Drive erfolgreich!'

// ── Google OAuth helper ────────────────────────────────────────────────────────

/** Drives through accounts.google.com until the browser lands back on /sync. */
async function completeGoogleOAuth(page: Page): Promise<void> {
  // PKCE: signIn() redirects the whole page to Google.
  await page.waitForURL(/accounts\.google\.com/, { timeout: 30_000 })

  // ── Email step ──
  const emailInput = page.locator('input[type="email"]')
  await expect(emailInput).toBeVisible({ timeout: 20_000 })
  await emailInput.fill(GOOGLE_EMAIL)
  await page.keyboard.press('Enter')

  // ── Password step ──
  const passwordInput = page.locator('input[type="password"]')
  await expect(passwordInput).toBeVisible({ timeout: 20_000 })
  await passwordInput.fill(GOOGLE_PASSWORD)
  await page.keyboard.press('Enter')

  // ── Optional consent / permission screen ──
  // Shown on first authorisation of the Drive.file scope.
  // Subsequent runs skip this step (scope already granted).
  try {
    await page.waitForURL(/accounts\.google\.com.*consent|oauthchooseaccount/, { timeout: 8_000 })
    const allowBtn = page.locator('button', { hasText: /Allow|Zulassen|Continue|Weiter/ }).first()
    if (await allowBtn.isVisible({ timeout: 3_000 })) await allowBtn.click()
  } catch { /* consent screen not shown — scope already granted */ }

  // ── Wait for PKCE callback redirect back to the app ──
  await page.waitForURL(/\/sync(\?|$)/, { timeout: 45_000 })
}

// ── Drive cleanup helper ───────────────────────────────────────────────────────

/** Deletes the storyhold sync file from Drive.
 *  Uses the Bearer token already stored in IDB by resumeFromOAuth().
 *  Idempotent: silently no-ops when the file or token is absent. */
async function cleanupDriveFile(page: Page): Promise<void> {
  await page.evaluate(async () => {
    try {
      const db = await new Promise<IDBDatabase>((res, rej) => {
        const r = indexedDB.open('rm-sync-auth', 1)
        r.onsuccess = () => res(r.result)
        r.onerror   = () => rej(r.error)
      })
      const stored = await new Promise<{ accessToken: string } | null>((res, rej) => {
        const tx  = db.transaction('tokens', 'readonly')
        const req = tx.objectStore('tokens').get('rm-sync-gdrive-token')
        req.onsuccess = () => res((req.result as { accessToken: string } | undefined) ?? null)
        req.onerror   = () => rej(req.error)
      })
      if (!stored?.accessToken) return

      const bearer = stored.accessToken

      // Try the cached file-ID first; fall back to a Drive search.
      const cachedId = await new Promise<string | null>((res, rej) => {
        const tx  = db.transaction('tokens', 'readonly')
        const req = tx.objectStore('tokens').get('rm-sync-gdrive-fileid')
        req.onsuccess = () => res((req.result as string | undefined) ?? null)
        req.onerror   = () => rej(req.error)
      })

      const idsToDelete: string[] = cachedId ? [cachedId] : []

      if (!cachedId) {
        const resp = await fetch(
          "https://www.googleapis.com/drive/v3/files?q=name='remember-me-sync.json' and trashed=false&fields=files(id)",
          { headers: { Authorization: `Bearer ${bearer}` } },
        )
        if (resp.ok) {
          const body = await resp.json() as { files: Array<{ id: string }> }
          for (const f of body.files) idsToDelete.push(f.id)
        }
      }

      await Promise.all(idsToDelete.map(id =>
        fetch(`https://www.googleapis.com/drive/v3/files/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${bearer}` },
        }),
      ))
    } catch { /* cleanup is best-effort; failures must not fail the test */ }
  })
}

// ── Test ──────────────────────────────────────────────────────────────────────

test.describe('Google Drive – Gerätewechsel (echte OAuth + Drive API)', () => {

  test('gdrive-device-switch: Inhalt von Gerät 1 wird auf Gerät 2 wiederhergestellt', async ({ browser }) => {
    test.skip(
      !GOOGLE_EMAIL || !GOOGLE_PASSWORD,
      'GOOGLE_TEST_EMAIL / GOOGLE_TEST_PASSWORD sind nicht gesetzt — Test wird übersprungen',
    )
    test.setTimeout(360_000) // 6 Minuten: OAuth-Redirect + 30s Debounce + Drive-API-Latenz

    let device1RecoveryCode = ''

    // ── Gerät 1: Einrichten → OAuth → Recovery-Code notieren → Antwort speichern ──
    const { ctx: ctx1, page: page1 } = await spawnRealDevice(browser)
    await page1.goto('/')
    await completeOnboarding(page1, 'Emma')

    // Sync-Tab öffnen und Wizard starten
    await openSyncTab(page1)
    await page1.getByRole('button', { name: 'Einrichten' }).click()
    await expect(page1.getByRole('heading', { name: /Wo sollen deine Daten/ })).toBeVisible()

    // Google Drive auswählen → Weiter → OAuth-Redirect
    await page1.getByRole('button', { name: /Google Drive/ }).click()
    await page1.getByRole('button', { name: 'Weiter' }).click()

    await completeGoogleOAuth(page1)

    // Nach OAuth: Wizard zeigt den Recovery-Code (kein vorhandenes Sync-File)
    await expect(
      page1.getByRole('heading', { name: 'Dein Sicherheitsschlüssel' }),
    ).toBeVisible({ timeout: 30_000 })
    device1RecoveryCode = (await page1.locator('.private-sync-view__code').textContent()) ?? ''
    expect(device1RecoveryCode.trim().length, 'Recovery-Code muss nicht leer sein').toBeGreaterThan(0)

    // Checkbox bestätigen, dann zum Hub weiterklicken
    await page1.getByRole('checkbox').check()
    const weiterBtn = page1.getByRole('button', { name: 'Weiter' })
    await expect(weiterBtn).toBeEnabled()
    await weiterBtn.click()
    await expect(
      page1.getByRole('heading', { name: 'Privater Sync', exact: true }),
    ).toBeVisible({ timeout: 20_000 })

    // Antwort über __rmState-Bridge hinzufügen (löst den 30s-Debounce aus)
    await page1.evaluate(({ key, value }) => {
      const bridge = (window as unknown as {
        __rmState?: { get: () => Record<string, unknown> | null; save: (s: unknown) => void }
      }).__rmState
      const state = bridge?.get() ?? {}
      const now   = new Date().toISOString()
      ;(state.answers as Record<string, unknown>)[key] = {
        id: key, questionId: key, categoryId: 'childhood',
        value, createdAt: now, updatedAt: now,
      }
      bridge?.save(state)
    }, { key: ANSWER_KEY, value: ANSWER_VALUE })

    // Warten bis Drive-Upload abgeschlossen ist (lastSyncAt wird gesetzt)
    await expect
      .poll(
        () => page1.evaluate(() => {
          const b = (window as unknown as {
            __rmState?: { get: () => Record<string, unknown> | null }
          }).__rmState
          return (b?.get()?.privateSync as Record<string, unknown> | undefined)?.lastSyncAt ?? null
        }),
        {
          timeout:   90_000,
          intervals: [3_000],
          message:   'Drive-Upload von Gerät 1 wurde nicht innerhalb von 90 s abgeschlossen',
        },
      )
      .not.toBeNull()

    await ctx1.close()

    // ── Gerät 2: Neues Gerät, über Drive wiederherstellen ────────────────────
    const { ctx: ctx2, page: page2 } = await spawnRealDevice(browser)
    await page2.goto('/')
    await completeOnboarding(page2, 'Emma2')

    // Gleiche Schritte wie Gerät 1: Google Drive → OAuth mit demselben Konto
    await openSyncTab(page2)
    await page2.getByRole('button', { name: 'Einrichten' }).click()
    await expect(page2.getByRole('heading', { name: /Wo sollen deine Daten/ })).toBeVisible()
    await page2.getByRole('button', { name: /Google Drive/ }).click()
    await page2.getByRole('button', { name: 'Weiter' }).click()

    await completeGoogleOAuth(page2)

    // Nach OAuth: vorhandenes Sync-File gefunden → enter-code-Schritt
    await expect(
      page2.getByRole('heading', { name: /Sicherheitsschlüssel eingeben/ }),
    ).toBeVisible({ timeout: 30_000 })

    // Recovery-Code von Gerät 1 eingeben und entschlüsseln
    await page2.getByLabel(/Sicherheitsschlüssel|Recovery/).fill(device1RecoveryCode)
    await page2.getByRole('button', { name: /Entschlüsseln/ }).click()
    await expect(
      page2.getByRole('heading', { name: 'Privater Sync', exact: true }),
    ).toBeVisible({ timeout: 30_000 })

    // Warten bis die Antwort von Gerät 1 im Zustand von Gerät 2 sichtbar ist
    await expect
      .poll(
        async () => page2.evaluate(({ key }) => {
          const b = (window as unknown as {
            __rmState?: { get: () => Record<string, unknown> | null }
          }).__rmState
          const s = b?.get() ?? {}
          return (s.answers as Record<string, { value: string }>)[key]?.value ?? null
        }, { key: ANSWER_KEY }),
        {
          timeout:   120_000,
          intervals: [3_000],
          message:   'Antwort von Gerät 1 wurde auf Gerät 2 nicht wiederhergestellt',
        },
      )
      .toBe(ANSWER_VALUE)

    // Sync-File löschen, damit der nächste Testlauf wieder mit recovery-code startet
    await cleanupDriveFile(page2)

    await ctx2.close()
  })
})

// Google Drive device-switch E2E test.
//
// Tests the full encrypt-push → pull-decrypt cycle across two simulated
// devices using a *mocked* Drive API (page.route intercepts all googleapis.com
// calls).  No real OAuth credentials or Google account are required.
//
// What IS real (not mocked):
//   • AES-256-GCM encryption / decryption (Web Crypto, same code as production)
//   • PBKDF2 vault-key derivation (same algorithm, in-browser)
//   • State merge logic (privateSyncMerge.ts)
//   • The full usePrivateSync → GoogleDriveProvider → push/pull pipeline
//
// Replay-protection note: both devices push version 1.  pull() only rejects
// remote versions *strictly less than* lastSeen — equal versions are accepted —
// so device-2 successfully pulls device-1's version-1 envelope even though its
// own lastSeen is also 1 after push.  See googleDriveProvider.ts pull() line
// `if (remoteVersion < lastSeen)`.

import { test, expect, type Page } from '@playwright/test'
import { spawnRealDevice } from './helpers'
import { completeOnboarding } from '../helpers/family-mode-helpers'

// Fixed test identifiers — stable across retries, no DB cleanup needed.
const SYNC_ID        = 'e2e00000-d4de-4d4e-8888-000000000001'
const RECOVERY_CODE  = 'GDriveTestE2EDevice12345' // exactly 24 chars (no dashes)
const FAKE_TOKEN     = 'ya29.fake-gdrive-e2e-token'
const SYNC_FILE_ID   = 'e2e-gdrive-sync-file-id'
const ANSWER_KEY     = 'gdrive-e2e-device-switch-q1'
const ANSWER_VALUE   = 'Gerätewechsel via Google Drive erfolgreich!'

// ── IDB injection helpers ──────────────────────────────────────────────────────

/** Injects a fake Google Bearer token into the app's IndexedDB token store. */
async function injectDriveToken(page: Page, token: string): Promise<void> {
  await page.evaluate(async ({ token }) => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open('rm-sync-auth', 1)
      r.onupgradeneeded = () => r.result.createObjectStore('tokens')
      r.onsuccess = () => res(r.result)
      r.onerror  = () => rej(r.error)
    })
    await new Promise<void>((res, rej) => {
      const tx = db.transaction('tokens', 'readwrite')
      tx.objectStore('tokens').put({ accessToken: token, expiresAt: Date.now() + 3_600_000 }, 'rm-sync-gdrive-token')
      tx.oncomplete = () => res()
      tx.onerror    = () => rej(tx.error)
    })
  }, { token })
}

/** Injects the sync-file Drive ID so push() skips findSyncFile() search. */
async function injectDriveFileId(page: Page, fileId: string): Promise<void> {
  await page.evaluate(async ({ fileId }) => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open('rm-sync-auth', 1)
      r.onupgradeneeded = () => r.result.createObjectStore('tokens')
      r.onsuccess = () => res(r.result)
      r.onerror  = () => rej(r.error)
    })
    await new Promise<void>((res, rej) => {
      const tx = db.transaction('tokens', 'readwrite')
      tx.objectStore('tokens').put(fileId, 'rm-sync-gdrive-fileid')
      tx.oncomplete = () => res()
      tx.onerror    = () => rej(tx.error)
    })
  }, { fileId })
}

/** Derives the vault key via PBKDF2-SHA256 (legacy v2 params: salt=UTF-8(syncId),
 *  200 000 iterations) and stores it in rm-sync-vault-db / rm-sync-vault.
 *  Both devices use the same recovery code → same key → cross-device decrypt. */
async function injectVaultKey(page: Page, syncId: string, recoveryCode: string): Promise<void> {
  await page.evaluate(async ({ syncId, recoveryCode }) => {
    const enc = new TextEncoder()
    const km = await crypto.subtle.importKey('raw', enc.encode(recoveryCode), 'PBKDF2', false, ['deriveKey'])
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: enc.encode(syncId).buffer as ArrayBuffer, iterations: 200_000, hash: 'SHA-256' },
      km,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    )
    // Mirror the exact DB schema used by recoveryCode.ts (version 3, three stores)
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open('rm-sync-vault-db', 3)
      r.onupgradeneeded = (e) => {
        const d = (e.target as IDBOpenDBRequest).result
        if (!d.objectStoreNames.contains('rm-sync-vault'))   d.createObjectStore('rm-sync-vault')
        if (!d.objectStoreNames.contains('rm-sync-kdf'))     d.createObjectStore('rm-sync-kdf')
        if (!d.objectStoreNames.contains('rm-sync-version')) d.createObjectStore('rm-sync-version')
      }
      r.onsuccess = () => res(r.result)
      r.onerror   = () => rej(r.error)
    })
    await new Promise<void>((res, rej) => {
      const tx = db.transaction('rm-sync-vault', 'readwrite')
      tx.objectStore('rm-sync-vault').put(key, syncId)
      tx.oncomplete = () => res()
      tx.onerror    = () => rej(tx.error)
    })
  }, { syncId, recoveryCode })
}

/** Extracts the JSON sync envelope from a multipart/related body captured by
 *  a Playwright route handler.  Returns the raw JSON string (unparsed). */
function extractEnvelopeFromMultipart(buf: Buffer, contentType: string): string | null {
  const bm = contentType.match(/boundary=([^\s;,]+)/)
  if (!bm) return null
  const boundary = '--' + bm[1]
  const text = buf.toString('utf-8')
  const parts = text.split(boundary)
  // parts layout: ['', metadataSection, envelopeSection, '--']
  const envSection = parts[2]
  if (!envSection) return null
  const sep = envSection.indexOf('\r\n\r\n')
  if (sep === -1) return null
  return envSection.slice(sep + 4).trimEnd()
}

// ── Test ──────────────────────────────────────────────────────────────────────

test.describe('Google Drive – Gerätewechsel (Mock-Drive)', () => {

  test('gdrive-device-switch: Inhalt von Gerät 1 wird auf Gerät 2 wiederhergestellt', async ({ browser }) => {
    test.setTimeout(300_000)

    // Captured Drive envelope: set by device-1 upload mock, read by device-2 pull mock.
    let capturedEnvelope: string | null = null

    // ── Gerät 1: Verschlüsseln und auf Drive pushen ──────────────────────────
    const { ctx: ctx1, page: page1 } = await spawnRealDevice(browser)
    await page1.goto('/')
    await completeOnboarding(page1, 'Emma')

    // Inject credentials before activating the provider
    await injectDriveToken(page1, FAKE_TOKEN)
    await injectVaultKey(page1, SYNC_ID, RECOVERY_CODE)

    // Mock all googleapis.com calls for device 1
    await page1.route(/googleapis\.com/, async (route, request) => {
      const url    = request.url()
      const method = request.method()

      if (url.includes('/upload/drive/v3/files')) {
        // Sync-File-Upload: capture multipart body, return file ID
        const buf = await request.postDataBuffer()
        if (buf && !capturedEnvelope) {
          capturedEnvelope = extractEnvelopeFromMultipart(buf, request.headers()['content-type'] ?? '')
        }
        await route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ id: SYNC_FILE_ID }) })
      } else if (url.includes('/drive/v3/files') && method === 'POST') {
        // Media-folder creation
        await route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ id: 'e2e-media-folder' }) })
      } else if (url.includes(`/drive/v3/files/${SYNC_FILE_ID}`) && url.includes('alt=media')) {
        // pull() download — return what was just uploaded (version check passes: 1 == 1)
        const body = capturedEnvelope ?? '{}'
        await route.fulfill({ status: 200, contentType: 'application/json', body })
      } else if (url.includes('/drive/v3/files')) {
        // Search: no existing files
        await route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ files: [] }) })
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
      }
    })

    // Activate Google Drive provider and add an answer — one bridge.save() call
    // so both changes land in the same React state update and only one debounce.
    await page1.evaluate(({ syncId, answerKey, answerValue }) => {
      const bridge = (window as unknown as {
        __rmState?: { get: () => Record<string, unknown> | null; save: (s: unknown) => void }
      }).__rmState
      const state = bridge?.get() ?? {}
      state.privateSync = { providerType: 'google-drive', userId: syncId, status: 'idle', lastSyncAt: null, errorMessage: null }
      const now = new Date().toISOString()
      ;(state.answers as Record<string, unknown>)[answerKey] = {
        id: answerKey, questionId: answerKey, categoryId: 'childhood',
        value: answerValue, createdAt: now, updatedAt: now,
      }
      bridge?.save(state)
    }, { syncId: SYNC_ID, answerKey: ANSWER_KEY, answerValue: ANSWER_VALUE })

    // Wait until the upload mock captured the encrypted envelope (debounce 30 s + round-trip)
    await expect
      .poll(() => capturedEnvelope !== null, {
        timeout: 90_000, intervals: [2_000],
        message: 'Drive-Upload von Gerät 1 wurde nicht innerhalb von 90 s registriert',
      })
      .toBe(true)

    await ctx1.close()

    // ── Gerät 2: Frisches Gerät, Drive-Daten wiederherstellen ────────────────
    const { ctx: ctx2, page: page2 } = await spawnRealDevice(browser)
    await page2.goto('/')
    await completeOnboarding(page2, 'Emma2')

    // Same vault key (derived from same recovery code) + token + file ID
    await injectDriveToken(page2, FAKE_TOKEN)
    await injectVaultKey(page2, SYNC_ID, RECOVERY_CODE)
    await injectDriveFileId(page2, SYNC_FILE_ID)

    // Mock Drive API for device 2
    await page2.route(/googleapis\.com/, async (route, request) => {
      const url    = request.url()
      const method = request.method()

      if (url.includes(`/drive/v3/files/${SYNC_FILE_ID}`) && url.includes('alt=media')) {
        // pull() download → return device-1's captured envelope
        await route.fulfill({ status: 200, contentType: 'application/json', body: capturedEnvelope! })
      } else if (url.includes('/upload/drive/v3/files')) {
        // Device-2 push (empty state) — just acknowledge
        await route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ id: SYNC_FILE_ID }) })
      } else if (url.includes('/drive/v3/files') && method === 'POST') {
        await route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ id: 'e2e-media-folder-2' }) })
      } else if (url.includes('/drive/v3/files')) {
        await route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ files: [] }) })
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
      }
    })

    // Activate Google Drive on device 2 (triggers debounce → push + pull)
    await page2.evaluate(({ syncId }) => {
      const bridge = (window as unknown as {
        __rmState?: { get: () => Record<string, unknown> | null; save: (s: unknown) => void }
      }).__rmState
      const state = bridge?.get() ?? {}
      state.privateSync = { providerType: 'google-drive', userId: syncId, status: 'idle', lastSyncAt: null, errorMessage: null }
      bridge?.save(state)
    }, { syncId: SYNC_ID })

    // Poll until device-2 has device-1's answer in its merged state
    await expect
      .poll(
        async () => page2.evaluate(({ key }) => {
          const bridge = (window as unknown as {
            __rmState?: { get: () => Record<string, unknown> | null }
          }).__rmState
          const state = bridge?.get() ?? {}
          return (state.answers as Record<string, { value: string }>)[key]?.value ?? null
        }, { key: ANSWER_KEY }),
        {
          timeout: 120_000, intervals: [3_000],
          message: 'Antwort von Gerät 1 wurde auf Gerät 2 nicht wiederhergestellt',
        },
      )
      .toBe(ANSWER_VALUE)

    await ctx2.close()
  })
})

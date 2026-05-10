import { test, expect } from '@playwright/test'
import {
  completeOnboarding,
  dismissInstallPrompt,
  E2E_USER_ID,
  seedActiveSync,
} from './helpers'
import { createDriveMockState, installGoogleDriveMock } from '../mocks/googleDriveMock'

// E2E-MEDIA-ENC – H1: Bilder/Audio/Video gehen verschlüsselt zu Google Drive.
//
// Komplement zu googleDriveProvider.encryption.test.ts: dieser Spec lässt
// die echte gebauten App im Browser laufen und prüft auf der Mock-Seite,
// dass das, was tatsächlich im Drive-Bucket landet, AES-GCM-Ciphertext ist
// und niemals die rohen Bild-Bytes.

const PLAINTEXT_HEX = '89504e470d0a1a0adeadbeefcafebabe'

function indexOfBytes(haystack: Uint8Array, needleHex: string): number {
  const needle = new Uint8Array(needleHex.match(/../g)!.map(h => parseInt(h, 16)))
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer
    }
    return i
  }
  return -1
}

test.describe('Privater Sync – Media-Verschlüsselung Google Drive (H1)', () => {
  test('Push lädt Ciphertext hoch, niemals Plaintext-Bilder', async ({ context, page }) => {
    // Capture page-level errors so a failing assertion has actionable info
    // instead of just "timed out waiting for predicate".
    const pageErrors: string[] = []
    page.on('pageerror', e => pageErrors.push(`pageerror: ${e.message}`))
    page.on('console', m => {
      if (m.type() === 'error' || m.type() === 'warning') {
        pageErrors.push(`console.${m.type()}: ${m.text()}`)
      }
    })

    await dismissInstallPrompt(context)
    const drive = createDriveMockState()
    // Pre-seed the media folder so findOrCreateMediaFolder takes the "found"
    // branch; the listing endpoint of the mock ignores the q= filter and
    // returns whatever's in `files`, so this entry doubles as the folder
    // probe response.
    drive.files.set('mock-folder', {
      name: 'remember-me-media',
      content: '',
      mimeType: 'application/vnd.google-apps.folder',
    })
    await installGoogleDriveMock(context, drive)

    await seedActiveSync(page, 'google-drive', E2E_USER_ID)
    await completeOnboarding(page, 'Heidi')

    // Seed the IDB pieces the provider needs *after* the page is up — the
    // OAuth token + a vault key cached under the seeded userId, plus a
    // single image with a magic-byte payload we can grep for in the mock.
    await page.evaluate(async ({ plainHex, syncId }) => {
      const open = (name: string, store: string) =>
        new Promise<IDBDatabase>((resolve, reject) => {
          const req = indexedDB.open(name, 1)
          req.onupgradeneeded = () => req.result.createObjectStore(store)
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
      const put = async (name: string, store: string, key: string, value: unknown) => {
        const db = await open(name, store)
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(store, 'readwrite')
          tx.objectStore(store).put(value, key)
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        })
        db.close()
      }
      await put('rm-sync-auth', 'tokens', 'rm-sync-gdrive-token', {
        accessToken: 'tok',
        expiresAt: Date.now() + 3600_000,
      })
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt'],
      )
      const jwk = await crypto.subtle.exportKey('jwk', key)
      await put('rm-sync-vault-db', 'rm-sync-vault', syncId, jwk)
      const bytes = new Uint8Array(plainHex.match(/../g)!.map((h: string) => parseInt(h, 16)))
      const dataUrl = 'data:image/png;base64,' + btoa(String.fromCharCode(...bytes))
      await put('rm-images', 'images', 'img-1', dataUrl)
    }, { plainHex: PLAINTEXT_HEX, syncId: E2E_USER_ID })

    // Reload so the hook re-reads the seeded state with the IDB contents
    // already in place.
    await page.goto('/sync')

    // Trigger a deterministic sync via the VITE_E2E bridge and capture
    // diagnostic state so a Safari-specific failure surfaces actionable
    // detail instead of an opaque poll timeout.
    type Diag = {
      phase: string
      bridgeWaitMs?: number
      before?: unknown
      after?: unknown
      hookStatus?: unknown
      image?: unknown
      tokenInIdb?: unknown
      vaultKeyInIdb?: unknown
      error?: string
    }
    const diag = await page.evaluate(async (): Promise<Diag> => {
      const w = window as Window & {
        __rmSyncNow?: () => Promise<void>
        __rmSyncStatus?: () => unknown
        __rmState?: { get: () => unknown }
      }
      const start = Date.now()
      while (!w.__rmSyncNow && Date.now() - start < 15_000) {
        await new Promise(r => setTimeout(r, 50))
      }
      const bridgeWaitMs = Date.now() - start
      if (!w.__rmSyncNow) return { phase: 'no-bridge', bridgeWaitMs }
      const before = (w.__rmState?.get() as { privateSync?: unknown } | null)?.privateSync ?? null
      try {
        await w.__rmSyncNow()
      } catch (e) {
        return { phase: 'syncNow-threw', bridgeWaitMs, before, error: String(e) }
      }
      const after = (w.__rmState?.get() as { privateSync?: unknown } | null)?.privateSync ?? null
      const hookStatus = w.__rmSyncStatus?.() ?? null
      const idbProbe = (db: string, store: string, key: string) => new Promise(resolve => {
        const r = indexedDB.open(db, 1)
        r.onsuccess = () => {
          const tx = r.result.transaction(store, 'readonly')
          const g = tx.objectStore(store).get(key)
          g.onsuccess = () => {
            const v = g.result
            resolve({
              found: v !== undefined,
              type: v === null ? 'null' : typeof v,
              keys: v && typeof v === 'object' ? Object.keys(v) : null,
              len: typeof v === 'string' ? v.length : null,
            })
          }
          g.onerror = () => resolve({ error: 'idb-get' })
        }
        r.onerror = () => resolve({ error: `idb-open-${db}` })
      })
      return {
        phase: 'done',
        bridgeWaitMs,
        before,
        after,
        hookStatus,
        image: await idbProbe('rm-images', 'images', 'img-1'),
        tokenInIdb: await idbProbe('rm-sync-auth', 'tokens', 'rm-sync-gdrive-token'),
        vaultKeyInIdb: await idbProbe('rm-sync-vault-db', 'rm-sync-vault', '00000000-0000-4000-8000-000000000001'),
      }
    })

    // Wait for the Drive mock to receive at least one .bin upload. On Safari
    // the dynamic import of GoogleDriveProvider + crypto.subtle path can be
    // noticeably slower than Chromium, so we give it a generous window.
    const binCount = () => [...drive.files.values()].filter(f => f.name.endsWith('.bin')).length
    const start = Date.now()
    while (binCount() === 0 && Date.now() - start < 20_000) {
      await new Promise(r => setTimeout(r, 200))
    }
    if (binCount() === 0) {
      // Embed the diag info in the assertion message itself: GitHub Actions'
      // collapsed step logs are not scrape-able from outside, but the failure
      // line in the test summary is.
      const driveFiles = [...drive.files.entries()].map(([id, f]) => ({
        id, name: f.name, mimeType: f.mimeType,
      }))
      throw new Error(
        '[H1-E2E] No .bin upload reached the Drive mock within 20s.\n' +
        `DIAG: ${JSON.stringify(diag)}\n` +
        `ERRORS: ${JSON.stringify(pageErrors)}\n` +
        `DRIVE FILES: ${JSON.stringify(driveFiles)}`,
      )
    }

    // ── Encryption invariant ────────────────────────────────────────────
    const binFiles = [...drive.files.values()].filter(f => f.name.endsWith('.bin'))
    expect(binFiles.length).toBe(1)
    const bin = binFiles[0]
    expect(bin.body).toBeDefined()
    expect(bin.mimeType).toBe('application/octet-stream')
    // 16 bytes plaintext + 16-byte GCM auth tag = 32 bytes ciphertext.
    expect(bin.body!.length).toBe(32)
    // Plaintext magic must NOT appear anywhere in the upload.
    expect(indexOfBytes(bin.body!, PLAINTEXT_HEX)).toBe(-1)
  })
})

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

    // Trigger a deterministic sync via the VITE_E2E bridge.
    await page.evaluate(async () => {
      const w = window as Window & { __rmSyncNow?: () => Promise<void> }
      // The hub mounts asynchronously — give the hook a tick to expose itself.
      const start = Date.now()
      while (!w.__rmSyncNow && Date.now() - start < 5_000) {
        await new Promise(r => setTimeout(r, 50))
      }
      if (!w.__rmSyncNow) throw new Error('__rmSyncNow not exposed')
      await w.__rmSyncNow()
    })

    // Wait for the Drive mock to receive at least one .bin upload.
    await expect.poll(
      () => [...drive.files.values()].filter(f => f.name.endsWith('.bin')).length,
      { timeout: 10_000, intervals: [200, 500, 1_000] },
    ).toBeGreaterThanOrEqual(1)

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

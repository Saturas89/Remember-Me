// @vitest-environment node
//
// Integration test for the H1 media-encryption fix on OneDriveProvider.
// Drives the full push/pull pipeline against a fake fetch and asserts:
//
//   1. PUTs to media/<id>.bin upload AES-GCM ciphertext, never the original
//      media bytes, and Content-Type is application/octet-stream.
//   2. pull() round-trips identical bytes back into the local media store.
//
// Mirror of googleDriveProvider.encryption.test.ts, simpler because the
// OneDrive provider uploads via plain PUT (no multipart envelope).

import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { OneDriveProvider } from './oneDriveProvider'
import { cacheVaultKey } from './recoveryCode'
import type { MediaStoreAccessor } from './privateSyncProvider'
import type { AppState } from '../types'

const TOKEN_IDB = 'rm-sync-auth'
const TOKEN_STORE = 'tokens'
const TOKEN_KEY = 'rm-sync-onedrive-token'

const SYNC_ID = 'sync-h1-onedrive'

const PLAINTEXT = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0xde, 0xad, 0xbe, 0xef, 0xca, 0xfe, 0xba, 0xbe,
])

const emptyState = {
  profile: null,
  answers: {},
  friends: [],
  friendAnswers: [],
  customQuestions: [],
} as unknown as AppState

interface CloudFile {
  body: Uint8Array
  mimeType: string
}

interface FakeOneDrive {
  files: Map<string, CloudFile>
}

function installFakeFetch(drive: FakeOneDrive): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL ? input.toString() : input.url
    const method = init?.method ?? 'GET'

    // graphPut and graphGet hit `${approot}:/<path>:/content`. We key on the
    // segment between `:/` and `:/content` so envelope + media land in the
    // same map.
    const pathMatch = url.match(/\/me\/drive\/special\/approot:\/([^:]+):\/content/)
    if (!pathMatch) return new Response(`unhandled: ${method} ${url}`, { status: 599 })
    const path = pathMatch[1]

    if (method === 'PUT') {
      const headers = (init?.headers ?? {}) as Record<string, string>
      const mimeType = headers['Content-Type'] ?? headers['content-type'] ?? ''
      const body = init?.body
      let bytes: Uint8Array
      if (body instanceof Blob) {
        bytes = new Uint8Array(await body.arrayBuffer())
      } else if (typeof body === 'string') {
        bytes = new TextEncoder().encode(body)
      } else {
        bytes = new Uint8Array()
      }
      drive.files.set(path, { body: bytes, mimeType })
      return new Response('{}', { status: 200 })
    }

    if (method === 'GET') {
      const f = drive.files.get(path)
      if (!f) return new Response('{}', { status: 404 })
      return new Response(f.body as BodyInit, { status: 200, headers: { 'Content-Type': f.mimeType } })
    }

    return new Response(`unhandled: ${method} ${url}`, { status: 599 })
  }) as typeof fetch
}

function indexOf(haystack: Uint8Array, needle: Uint8Array, from: number): number {
  outer: for (let i = from; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer
    }
    return i
  }
  return -1
}

async function openDb(name: string, store: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(store)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbPut(name: string, store: string, key: string, value: unknown): Promise<void> {
  const db = await openDb(name, store)
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

async function idbClear(name: string, store: string): Promise<void> {
  const db = await openDb(name, store)
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

beforeEach(async () => {
  await idbClear('rm-sync-auth', 'tokens')
  try { await idbClear('rm-sync-vault-db', 'rm-sync-vault') } catch { /* first run */ }
})

describe('OneDriveProvider — H1 media encryption', () => {
  it('uploads ciphertext for media and pull restores the original bytes', async () => {
    const vaultKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    )
    await cacheVaultKey(SYNC_ID, vaultKey)

    await idbPut(TOKEN_IDB, TOKEN_STORE, TOKEN_KEY, {
      accessToken: 'tok',
      expiresAt: Date.now() + 3600_000,
      accountId: 'acct-1',
    })

    const localMedia = new Map<string, { kind: 'image' | 'audio' | 'video'; blob: Blob }>()
    localMedia.set('img-1', {
      kind: 'image',
      blob: new Blob([PLAINTEXT], { type: 'image/png' }),
    })
    const adapter: MediaStoreAccessor = {
      async getImageBlob(id) { const e = localMedia.get(id); return e?.kind === 'image' ? e.blob : null },
      async getAudioBlob(id) { const e = localMedia.get(id); return e?.kind === 'audio' ? e.blob : null },
      async getVideoBlob(id) { const e = localMedia.get(id); return e?.kind === 'video' ? e.blob : null },
      async putImage(id, blob) { localMedia.set(id, { kind: 'image', blob }) },
      async putAudio(id, blob) { localMedia.set(id, { kind: 'audio', blob }) },
      async putVideo(id, blob) { localMedia.set(id, { kind: 'video', blob }) },
      async listLocalMediaIds() {
        const images: string[] = [], audio: string[] = [], videos: string[] = []
        for (const [id, e] of localMedia) {
          if (e.kind === 'image') images.push(id)
          else if (e.kind === 'audio') audio.push(id)
          else videos.push(id)
        }
        return { images, audio, videos }
      },
    }

    const drive: FakeOneDrive = { files: new Map() }
    installFakeFetch(drive)

    const provider = new OneDriveProvider(SYNC_ID)
    await provider.push(emptyState, adapter)

    // ── Encryption invariant on the cloud side ───────────────────────────
    const binEntries = [...drive.files.entries()].filter(([p]) => p.startsWith('media/') && p.endsWith('.bin'))
    expect(binEntries.length).toBe(1)
    const [, bin] = binEntries[0]
    expect(bin.mimeType).toBe('application/octet-stream')
    expect(bin.body.length).toBe(PLAINTEXT.length + 16)
    expect(indexOf(bin.body, PLAINTEXT, 0)).toBe(-1)

    // ── Round-trip ───────────────────────────────────────────────────────
    localMedia.delete('img-1')
    const result = await provider.pull(emptyState, adapter)
    expect(result).not.toBeNull()
    expect(result!.downloadedMediaIds).toEqual(['img-1'])

    const restored = localMedia.get('img-1')
    expect(restored).toBeDefined()
    expect(restored!.kind).toBe('image')
    expect(restored!.blob.type).toBe('image/png')
    const restoredBytes = new Uint8Array(await restored!.blob.arrayBuffer())
    expect(Array.from(restoredBytes)).toEqual(Array.from(PLAINTEXT))
  })
})

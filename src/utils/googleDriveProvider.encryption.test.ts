// @vitest-environment node
//
// Integration test for the H1 media-encryption fix on GoogleDriveProvider.
// Drives the full push/pull pipeline against a fake fetch that captures
// every upload byte verbatim, then asserts:
//
//   1. The single .bin upload is AES-GCM ciphertext (not the original media
//      bytes) and lands as `application/octet-stream` — no MIME leakage.
//   2. pull() round-trips identical bytes back into the local media store.
//
// Unlike googleDriveProvider.test.ts this does NOT vi.mock syncEncryption /
// recoveryCode — the goal is to catch regressions where someone removes the
// encrypt step, forgets to persist `iv`, or breaks the manifest format.

import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { GoogleDriveProvider } from './googleDriveProvider'
import { cacheVaultKey } from './recoveryCode'
import type { MediaStoreAccessor } from './privateSyncProvider'
import type { AppState } from '../types'

const TOKEN_IDB = 'rm-sync-auth'
const TOKEN_STORE = 'tokens'
const TOKEN_KEY = 'rm-sync-gdrive-token'

const SYNC_ID = 'sync-h1'

// PNG magic + a unique 8-byte pad. Even a 16-byte ciphertext with a 16-byte
// GCM tag has a < 1/2^128 chance of accidentally containing this exact run.
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
  name: string
  body: Uint8Array
  mimeType: string
}

interface FakeDrive {
  files: Map<string, CloudFile>
  next: number
}

function makeFakeDrive(): FakeDrive {
  // Seed the media folder so findOrCreateMediaFolder takes the "found" path.
  const drive: FakeDrive = { files: new Map(), next: 0 }
  drive.files.set('folder-1', {
    name: 'remember-me-media',
    body: new Uint8Array(),
    mimeType: 'application/vnd.google-apps.folder',
  })
  return drive
}

function installFakeFetch(drive: FakeDrive): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL ? input.toString() : input.url
    const method = init?.method ?? 'GET'

    // Name-filtered list (folder probe + envelope probe).
    if (method === 'GET' && url.includes('/drive/v3/files') && url.includes('q=')) {
      const q = decodeURIComponent(new URL(url).searchParams.get('q') ?? '')
      const target = q.match(/name='([^']+)'/)?.[1]
      const wantsFolder = q.includes("mimeType='application/vnd.google-apps.folder'")
      const files: { id: string }[] = []
      for (const [id, f] of drive.files) {
        if (target && f.name !== target) continue
        const isFolder = f.mimeType === 'application/vnd.google-apps.folder'
        if (wantsFolder !== isFolder) continue
        files.push({ id })
      }
      return new Response(JSON.stringify({ files }), { status: 200 })
    }

    // Read media (alt=media). The provider calls .blob() for media files and
    // .json() for the envelope, so we honour the stored mime type.
    const readMatch = url.match(/\/drive\/v3\/files\/([^?/]+)\?alt=media/)
    if (method === 'GET' && readMatch) {
      const f = drive.files.get(readMatch[1])
      if (!f) return new Response('{}', { status: 404 })
      return new Response(f.body as BodyInit, { status: 200, headers: { 'Content-Type': f.mimeType } })
    }

    // Multipart upload (create or update).
    const isCreate = method === 'POST'
      && url.includes('/upload/drive/v3/files')
      && url.includes('uploadType=multipart')
    const updateMatch = method === 'PATCH'
      && url.match(/\/upload\/drive\/v3\/files\/([^?]+)\?/)
    if (isCreate || updateMatch) {
      const id = updateMatch ? updateMatch[1] : `file-${++drive.next}`
      const headers = (init?.headers ?? {}) as Record<string, string>
      const ctHeader = headers['Content-Type'] ?? headers['content-type'] ?? ''
      const boundary = ctHeader.match(/boundary=([^;]+)/)?.[1] ?? ''
      const bodyBlob = init?.body as Blob
      const bytes = new Uint8Array(await bodyBlob.arrayBuffer())
      const parsed = parseMultipart(bytes, boundary)
      drive.files.set(id, {
        name: parsed.name ?? drive.files.get(id)?.name ?? 'unknown',
        mimeType: parsed.mimeType ?? 'application/octet-stream',
        body: parsed.payload,
      })
      return new Response(JSON.stringify({ id }), { status: 200 })
    }

    return new Response(`unhandled: ${method} ${url}`, { status: 599 })
  }) as typeof fetch
}

// Bytes-aware multipart parser. driveUpload always emits exactly two parts:
// JSON metadata then the file body. We slice the body verbatim so binary
// (encrypted) blobs survive the round-trip — a string parser would mangle
// any non-UTF-8 byte run.
function parseMultipart(bytes: Uint8Array, boundary: string): {
  name?: string
  mimeType?: string
  payload: Uint8Array
} {
  const enc = new TextEncoder()
  const sep = enc.encode('\r\n\r\n')
  const closing = enc.encode(`\r\n--${boundary}--`)

  const firstSep = indexOf(bytes, sep, 0)
  if (firstSep < 0) return { payload: new Uint8Array() }
  const secondSep = indexOf(bytes, sep, firstSep + sep.length)
  if (secondSep < 0) return { payload: new Uint8Array() }

  // Headers between firstSep and secondSep belong to part 2 — pull the MIME
  // out of them. Part 1's JSON metadata holds the file `name`.
  const part1Json = new TextDecoder().decode(
    bytes.slice(firstSep + sep.length, secondSep),
  )
  const name = part1Json.match(/"name"\s*:\s*"([^"]+)"/)?.[1]
  const mimeType = part1Json.match(/Content-Type:\s*([^\r\n]+)/i)?.[1]

  const payloadStart = secondSep + sep.length
  const payloadEnd = indexOfRev(bytes, closing)
  const payload = bytes.slice(
    payloadStart,
    payloadEnd >= 0 ? payloadEnd : bytes.length,
  )
  return { name, mimeType, payload }
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

function indexOfRev(haystack: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = haystack.length - needle.length; i >= 0; i--) {
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
  // fake-indexeddb is process-local — reset the stores we touch so the run
  // is independent of test ordering.
  await idbClear('rm-sync-auth', 'tokens')
  try { await idbClear('rm-sync-vault-db', 'rm-sync-vault') } catch { /* first run */ }
})

describe('GoogleDriveProvider — H1 media encryption', () => {
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
    })

    // In-memory media adapter — Node 22 has no FileReader, so we bypass the
    // production adapter that round-trips through dataURL.
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

    const drive = makeFakeDrive()
    installFakeFetch(drive)

    const provider = new GoogleDriveProvider(SYNC_ID)
    await provider.push(emptyState, adapter)

    // ── Encryption invariant on the cloud side ───────────────────────────
    const binFiles = [...drive.files.values()].filter(f => f.name.endsWith('.bin'))
    expect(binFiles.length).toBe(1)
    const bin = binFiles[0]
    expect(bin.mimeType).toBe('application/octet-stream')
    expect(bin.body.length).toBe(PLAINTEXT.length + 16)
    expect(indexOf(bin.body, PLAINTEXT, 0)).toBe(-1)

    // ── Round-trip: simulate a fresh device, pull, expect identical bytes ─
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

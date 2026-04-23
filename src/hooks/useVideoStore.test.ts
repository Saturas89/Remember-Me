import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { Blob as NodeBlob } from 'node:buffer'
import { beforeEach, describe, it, expect, vi } from 'vitest'

beforeEach(() => {
  ;(globalThis as unknown as { Blob: unknown }).Blob = NodeBlob
})

type Store = typeof import('./useVideoStore')

async function freshStore(): Promise<Store> {
  ;(globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory()
  vi.resetModules()
  return await import('./useVideoStore')
}

async function blobText(blob: unknown): Promise<string> {
  const buf = await (blob as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer()
  return Buffer.from(buf).toString('utf-8')
}

describe('useVideoStore (IndexedDB)', () => {
  let store: Store

  beforeEach(async () => {
    store = await freshStore()
  })

  it('addVideo stores a blob and returns a vid-prefixed id', async () => {
    const id = await store.addVideo(new Blob(['v'], { type: 'video/webm' }))
    expect(id).toMatch(/^vid-\d+-[0-9a-f-]{36}$/)
  })

  it('round-trips video bytes through IndexedDB', async () => {
    const id = await store.addVideo(new Blob(['video-payload'], { type: 'video/mp4' }))
    const back = await store.getVideoBlob(id)
    expect(back).not.toBeNull()
    expect(await blobText(back)).toBe('video-payload')
  })

  it('returns null for an unknown id', async () => {
    expect(await store.getVideoBlob('vid-missing')).toBeNull()
  })

  it('removeVideo clears the entry', async () => {
    const id = await store.addVideo(new Blob(['x']))
    await store.removeVideo(id)
    expect(await store.getVideoBlob(id)).toBeNull()
  })

  it('putVideoById keeps the caller-supplied id (archive import)', async () => {
    await store.putVideoById('vid-restored', new Blob(['payload'], { type: 'video/webm' }))
    const back = await store.getVideoBlob('vid-restored')
    expect(await blobText(back)).toBe('payload')
  })

  it('generates distinct ids for parallel inserts', async () => {
    const ids = await Promise.all(
      Array.from({ length: 5 }).map(() => store.addVideo(new Blob(['x']))),
    )
    expect(new Set(ids).size).toBe(5)
  })
})

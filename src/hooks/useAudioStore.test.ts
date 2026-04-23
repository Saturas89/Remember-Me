import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { Blob as NodeBlob } from 'node:buffer'
import { beforeEach, describe, it, expect, vi } from 'vitest'

// jsdom's Blob does not survive structuredClone (and fake-indexeddb relies on
// structured cloning to persist values). Replace the global so stored blobs
// round-trip intact.
beforeEach(() => {
  ;(globalThis as unknown as { Blob: unknown }).Blob = NodeBlob
})

type Store = typeof import('./useAudioStore')

async function freshStore(): Promise<Store> {
  ;(globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory()
  vi.resetModules()
  return await import('./useAudioStore')
}

async function blobText(blob: unknown): Promise<string> {
  const buf = await (blob as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer()
  return Buffer.from(buf).toString('utf-8')
}

describe('useAudioStore (IndexedDB)', () => {
  let store: Store

  beforeEach(async () => {
    store = await freshStore()
  })

  it('addAudio stores a blob and returns an id with the expected prefix', async () => {
    const blob = new Blob(['abc'], { type: 'audio/webm' })
    const id = await store.addAudio(blob)
    expect(id).toMatch(/^aud-\d+-[0-9a-f-]{36}$/)
  })

  it('getAudioBlob returns the same bytes that were stored', async () => {
    const original = new Blob(['hello world'], { type: 'audio/webm' })
    const id = await store.addAudio(original)
    const back = await store.getAudioBlob(id)
    expect(back).not.toBeNull()
    expect(await blobText(back)).toBe('hello world')
  })

  it('getAudioBlob returns null for an unknown id', async () => {
    const result = await store.getAudioBlob('aud-nonexistent')
    expect(result).toBeNull()
  })

  it('removeAudio deletes an existing entry', async () => {
    const id = await store.addAudio(new Blob(['x'], { type: 'audio/webm' }))
    expect(await store.getAudioBlob(id)).not.toBeNull()
    await store.removeAudio(id)
    expect(await store.getAudioBlob(id)).toBeNull()
  })

  it('removeAudio on an unknown id resolves without throwing', async () => {
    await expect(store.removeAudio('aud-missing')).resolves.toBeUndefined()
  })

  it('putAudioById restores a blob under a caller-chosen id (archive import)', async () => {
    const id = 'aud-imported-123'
    const blob = new Blob(['restored'], { type: 'audio/mp4' })
    await store.putAudioById(id, blob)
    const back = await store.getAudioBlob(id)
    expect(await blobText(back)).toBe('restored')
  })

  it('putAudioById overwrites an existing blob at the same id', async () => {
    const id = 'aud-fixed'
    await store.putAudioById(id, new Blob(['first']))
    await store.putAudioById(id, new Blob(['second']))
    const back = await store.getAudioBlob(id)
    expect(await blobText(back)).toBe('second')
  })

  it('generates unique ids for multiple adds', async () => {
    const ids = await Promise.all(
      Array.from({ length: 5 }).map(() => store.addAudio(new Blob(['x']))),
    )
    expect(new Set(ids).size).toBe(5)
  })
})

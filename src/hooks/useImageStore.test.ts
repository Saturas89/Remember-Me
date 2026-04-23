import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

type Module = typeof import('./useImageStore')

async function freshModule(): Promise<Module> {
  ;(globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory()
  vi.resetModules()
  return await import('./useImageStore')
}

describe('useImageStore – module-level persistence', () => {
  let mod: Module
  beforeEach(async () => { mod = await freshModule() })

  it('putImageById + getImageDataUrl round-trip a data URL', async () => {
    const id = 'img-test-1'
    const dataUrl = 'data:image/jpeg;base64,QUJD' // "ABC"
    await mod.putImageById(id, dataUrl)
    expect(await mod.getImageDataUrl(id)).toBe(dataUrl)
  })

  it('getImageDataUrl returns undefined for unknown ids', async () => {
    expect(await mod.getImageDataUrl('img-nope')).toBeUndefined()
  })

  it('putImageById overwrites an existing entry', async () => {
    await mod.putImageById('img-x', 'data:image/jpeg;base64,AAA')
    await mod.putImageById('img-x', 'data:image/jpeg;base64,BBB')
    expect(await mod.getImageDataUrl('img-x')).toBe('data:image/jpeg;base64,BBB')
  })
})

describe('useImageStore hook', () => {
  let mod: Module
  beforeEach(async () => { mod = await freshModule() })

  it('loadImages populates the cache from IndexedDB', async () => {
    // Seed IDB directly via the module-level writer
    await mod.putImageById('img-a', 'data:image/jpeg;base64,AAA')
    await mod.putImageById('img-b', 'data:image/jpeg;base64,BBB')

    const { result } = renderHook(() => mod.useImageStore())
    await act(async () => { await result.current.loadImages(['img-a', 'img-b']) })

    await waitFor(() => {
      expect(result.current.cache['img-a']).toBe('data:image/jpeg;base64,AAA')
      expect(result.current.cache['img-b']).toBe('data:image/jpeg;base64,BBB')
    })
  })

  it('loadImages is a no-op for ids that are already cached', async () => {
    await mod.putImageById('img-a', 'data:image/jpeg;base64,AAA')
    const { result } = renderHook(() => mod.useImageStore())

    await act(async () => { await result.current.loadImages(['img-a']) })
    const first = result.current.cache
    await act(async () => { await result.current.loadImages(['img-a']) })
    // Same data after second call
    expect(result.current.cache['img-a']).toBe(first['img-a'])
  })

  it('loadImages skips ids that are not present in IndexedDB', async () => {
    const { result } = renderHook(() => mod.useImageStore())
    await act(async () => { await result.current.loadImages(['img-ghost']) })
    expect(result.current.cache['img-ghost']).toBeUndefined()
  })

  it('removeImage deletes from IDB and cache', async () => {
    await mod.putImageById('img-del', 'data:image/jpeg;base64,ZZZ')
    const { result } = renderHook(() => mod.useImageStore())

    await act(async () => { await result.current.loadImages(['img-del']) })
    expect(result.current.cache['img-del']).toBe('data:image/jpeg;base64,ZZZ')

    await act(async () => { await result.current.removeImage('img-del') })
    expect(result.current.cache['img-del']).toBeUndefined()
    expect(await mod.getImageDataUrl('img-del')).toBeUndefined()
  })

  it('loadImages deduplicates concurrent loads for the same id', async () => {
    await mod.putImageById('img-once', 'data:image/jpeg;base64,ONCE')
    const { result } = renderHook(() => mod.useImageStore())

    await act(async () => {
      // Kick off two parallel loads; the second should observe the in-flight set
      await Promise.all([
        result.current.loadImages(['img-once']),
        result.current.loadImages(['img-once']),
      ])
    })
    expect(result.current.cache['img-once']).toBe('data:image/jpeg;base64,ONCE')
  })
})

// @vitest-environment node
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, it, expect, vi } from 'vitest'

type Mod = typeof import('./shareLogStore')

async function fresh(): Promise<Mod> {
  ;(globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory()
  vi.resetModules()
  return await import('./shareLogStore')
}

describe('shareLogStore', () => {
  let mod: Mod
  beforeEach(async () => { mod = await fresh() })

  it('returns null for missing entries', async () => {
    expect(await mod.getShareLogEntry('answer-1', 'device-x')).toBeNull()
  })

  it('round-trips a single entry', async () => {
    await mod.setShareLogEntry('answer-1', 'device-x', '2026-05-20T12:00:00.000Z')
    expect(await mod.getShareLogEntry('answer-1', 'device-x')).toBe('2026-05-20T12:00:00.000Z')
  })

  it('overwrites the previous timestamp on a second set', async () => {
    await mod.setShareLogEntry('answer-1', 'device-x', '2026-05-20T12:00:00.000Z')
    await mod.setShareLogEntry('answer-1', 'device-x', '2026-05-20T13:00:00.000Z')
    expect(await mod.getShareLogEntry('answer-1', 'device-x')).toBe('2026-05-20T13:00:00.000Z')
  })

  it('keeps entries for different friends separate', async () => {
    await mod.setShareLogEntry('answer-1', 'device-x', '2026-01-01T00:00:00.000Z')
    await mod.setShareLogEntry('answer-1', 'device-y', '2026-02-02T00:00:00.000Z')
    expect(await mod.getShareLogEntry('answer-1', 'device-x')).toBe('2026-01-01T00:00:00.000Z')
    expect(await mod.getShareLogEntry('answer-1', 'device-y')).toBe('2026-02-02T00:00:00.000Z')
  })

  it('deleteShareLogForFriend removes only that friend\'s entries', async () => {
    await mod.setShareLogEntry('answer-1', 'device-x', '2026-01-01T00:00:00.000Z')
    await mod.setShareLogEntry('answer-2', 'device-x', '2026-01-02T00:00:00.000Z')
    await mod.setShareLogEntry('answer-1', 'device-y', '2026-01-03T00:00:00.000Z')
    await mod.setShareLogEntry('answer-2', 'device-y', '2026-01-04T00:00:00.000Z')

    await mod.deleteShareLogForFriend('device-x')

    expect(await mod.getShareLogEntry('answer-1', 'device-x')).toBeNull()
    expect(await mod.getShareLogEntry('answer-2', 'device-x')).toBeNull()
    expect(await mod.getShareLogEntry('answer-1', 'device-y')).toBe('2026-01-03T00:00:00.000Z')
    expect(await mod.getShareLogEntry('answer-2', 'device-y')).toBe('2026-01-04T00:00:00.000Z')
  })

  it('deleteShareLogForFriend on an empty store is a no-op', async () => {
    await expect(mod.deleteShareLogForFriend('device-x')).resolves.toBeUndefined()
  })
})

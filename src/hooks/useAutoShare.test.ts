// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAutoShare, type UseAutoShareOptions } from './useAutoShare'
import { setShareLogEntry } from '../utils/shareLogStore'
import type { Answer, Friend } from '../types'
import type { OnlineSyncAPI } from './useOnlineSync'

beforeEach(() => {
  ;(globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory()
})

function makeAnswer(overrides: Partial<Answer> = {}): Answer {
  return {
    id: 'q-1',
    questionId: 'q-1',
    categoryId: 'childhood',
    value: 'Sommer am See.',
    createdAt: '2026-05-20T10:00:00.000Z',
    updatedAt: '2026-05-20T10:00:00.000Z',
    ...overrides,
  }
}

function makeFriend(overrides: { id?: string; deviceId?: string; shareAll?: boolean } = {}): Friend {
  return {
    id: overrides.id ?? 'friend-1',
    name: 'Mama',
    addedAt: '2026-05-01T00:00:00.000Z',
    online: {
      deviceId: overrides.deviceId ?? 'd-friend-1',
      publicKey: 'PK1',
      linkedAt: '2026-05-01T00:00:00.000Z',
      shareAll: overrides.shareAll ?? true,
    },
  }
}

function makeSync(overrides: Partial<OnlineSyncAPI> = {}): OnlineSyncAPI {
  return {
    ready: true,
    error: null,
    deviceId: 'self-device',
    publicKeyB64: 'selfPK',
    memories: [],
    annotations: [],
    refresh: vi.fn(async () => {}),
    retryBootstrap: vi.fn(),
    service: {
      shareMemoryToAllFriends: vi.fn(async () => ({ shareId: 'share-1' })),
    } as unknown as OnlineSyncAPI['service'],
    ...overrides,
  }
}

function makeOpts(overrides: Partial<UseAutoShareOptions> = {}): UseAutoShareOptions {
  return {
    answers: { 'q-1': makeAnswer() },
    friends: [makeFriend()],
    sync: makeSync(),
    ownerName: 'Sandra',
    enabled: true,
    resolveQuestionText: () => 'Was war ein schöner Sommer?',
    ...overrides,
  }
}

describe('useAutoShare', () => {
  it('does nothing when disabled', async () => {
    const opts = makeOpts({ enabled: false })
    renderHook(() => useAutoShare(opts))
    // give the effect a microtask to run
    await new Promise(r => setTimeout(r, 50))
    expect(opts.sync.service!.shareMemoryToAllFriends).not.toHaveBeenCalled()
  })

  it('does nothing when sync is not ready', async () => {
    const opts = makeOpts({ sync: makeSync({ ready: false }) })
    renderHook(() => useAutoShare(opts))
    await new Promise(r => setTimeout(r, 50))
    expect(opts.sync.service!.shareMemoryToAllFriends).not.toHaveBeenCalled()
  })

  it('skips friends with shareAll=false', async () => {
    const opts = makeOpts({ friends: [makeFriend({ shareAll: false })] })
    renderHook(() => useAutoShare(opts))
    await new Promise(r => setTimeout(r, 100))
    expect(opts.sync.service!.shareMemoryToAllFriends).not.toHaveBeenCalled()
  })

  it('shares each Answer with each shareAll-true friend on first mount', async () => {
    const opts = makeOpts()
    renderHook(() => useAutoShare(opts))
    await waitFor(() =>
      expect(opts.sync.service!.shareMemoryToAllFriends).toHaveBeenCalledTimes(1),
    )

    const args = (opts.sync.service!.shareMemoryToAllFriends as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(args[0].id).toBe('q-1')
    expect(args[1]).toBe('Was war ein schöner Sommer?')
    expect(args[2]).toEqual([{ deviceId: 'd-friend-1', publicKey: 'PK1' }])
    expect(args[3]).toBe('Sandra')
  })

  it('multicasts one Answer to all shareAll friends in a single call', async () => {
    const friend1 = makeFriend({ id: 'friend-1', deviceId: 'd-friend-1' })
    const friend2 = makeFriend({ id: 'friend-2', deviceId: 'd-friend-2' })
    const sync = makeSync()
    const opts = makeOpts({ sync, friends: [friend1, friend2] })
    renderHook(() => useAutoShare(opts))
    await waitFor(() =>
      expect(sync.service!.shareMemoryToAllFriends).toHaveBeenCalledTimes(1),
    )
    const recipients = (sync.service!.shareMemoryToAllFriends as ReturnType<typeof vi.fn>).mock.calls[0][2]
    expect(recipients).toHaveLength(2)
    expect(recipients).toEqual(expect.arrayContaining([
      { deviceId: 'd-friend-1', publicKey: 'PK1' },
      { deviceId: 'd-friend-2', publicKey: 'PK1' },
    ]))
  })

  it('skips answers with empty values', async () => {
    const opts = makeOpts({
      answers: { 'q-empty': makeAnswer({ id: 'q-empty', value: '   ' }) },
    })
    renderHook(() => useAutoShare(opts))
    await new Promise(r => setTimeout(r, 100))
    expect(opts.sync.service!.shareMemoryToAllFriends).not.toHaveBeenCalled()
  })

  it('is idempotent across mounts: a second hook does not re-share', async () => {
    const sync = makeSync()
    const opts = makeOpts({ sync })
    const { unmount } = renderHook(() => useAutoShare(opts))
    await waitFor(() =>
      expect(sync.service!.shareMemoryToAllFriends).toHaveBeenCalledTimes(1),
    )
    unmount()

    // Second mount with the same options + same answers + same friend.
    renderHook(() => useAutoShare(opts))
    // Wait beyond what a re-share would take
    await new Promise(r => setTimeout(r, 200))
    expect(sync.service!.shareMemoryToAllFriends).toHaveBeenCalledTimes(1)
  })

  it('re-shares when an answer is updated after the previous share', async () => {
    // Seed an old share-log entry so the first render sees a stale state and
    // the hook is forced to re-share.
    await setShareLogEntry('q-1', 'd-friend-1', '2020-01-01T00:00:00.000Z')

    const sync = makeSync()
    const opts = makeOpts({
      sync,
      answers: { 'q-1': makeAnswer({ updatedAt: '2026-05-19T00:00:00.000Z' }) },
    })
    renderHook(() => useAutoShare(opts))

    await waitFor(() =>
      expect(sync.service!.shareMemoryToAllFriends).toHaveBeenCalledTimes(1),
    )
  })

  it('skips a friend whose service call throws and stops the queue', async () => {
    const failingService = {
      shareMemoryToAllFriends: vi.fn(async () => { throw new Error('boom') }),
    } as unknown as OnlineSyncAPI['service']
    const sync = makeSync({ service: failingService })
    const opts = makeOpts({
      sync,
      // 2 answers × 1 friend = 2 pairs. After the first failure (with all 4
      // retry attempts exhausted) the queue surrenders without touching the
      // second pair.
      answers: {
        'q-1': makeAnswer(),
        'q-2': makeAnswer({ id: 'q-2' }),
      },
    })
    renderHook(() => useAutoShare(opts))
    // Wait for first attempt
    await waitFor(() =>
      expect(failingService!.shareMemoryToAllFriends).toHaveBeenCalled(),
    )
    // Generous wait to ensure no further pairs are processed
    await new Promise(r => setTimeout(r, 300))
    // The mock should have been called for the first pair (with retries up
    // to the 4-step backoff). It should NOT progress to q-2 in this short
    // window because the queue surrenders after the first failure.
    const calls = (failingService!.shareMemoryToAllFriends as ReturnType<typeof vi.fn>).mock.calls
    // All calls so far should be for q-1 (not q-2).
    for (const call of calls) {
      expect(call[0].id).toBe('q-1')
    }
  })
})

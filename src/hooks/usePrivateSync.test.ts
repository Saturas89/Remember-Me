// Unit tests for REQ-017 usePrivateSync hook (debounce, retry, online-guard).
// Test IDs H-01 .. H-06 from Master-Spec §12.4.
//
// Runs in jsdom (default) so renderHook + act work; navigator.onLine is
// patched per-test.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import type { AppState } from '../types'
import type { MediaStoreAccessor, SyncProvider } from '../utils/privateSyncProvider'
import { SyncError } from '../utils/privateSyncProvider'

// ── Provider double ────────────────────────────────────────────────────────
//
// We replace the Supabase / Drive / OneDrive provider modules so the hook
// uses a controllable stub regardless of the providerType in AppState.

const providerSpy = {
  push: vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
  pull: vi
    .fn<(...args: unknown[]) => Promise<{ merged: AppState; downloadedMediaIds: string[] } | null>>()
    .mockResolvedValue(null),
  signIn: vi.fn().mockResolvedValue(undefined),
  signOut: vi.fn().mockResolvedValue(undefined),
  deactivate: vi.fn().mockResolvedValue(undefined),
  isAuthenticated: vi.fn().mockReturnValue(true),
}

class StubProvider implements SyncProvider {
  readonly type = 'supabase' as const
  isAuthenticated() { return providerSpy.isAuthenticated() as boolean }
  signIn() { return providerSpy.signIn() }
  signOut() { return providerSpy.signOut() }
  push(state: AppState, media: MediaStoreAccessor) { return providerSpy.push(state, media) }
  pull(localState: AppState, media: MediaStoreAccessor) {
    return providerSpy.pull(localState, media) as ReturnType<SyncProvider['pull']>
  }
  deactivate(deleteRemote: boolean) { return providerSpy.deactivate(deleteRemote) }
}

vi.mock('../utils/supabaseSyncProvider', () => ({
  SupabaseSyncProvider: StubProvider,
}))
vi.mock('../utils/googleDriveProvider', () => ({
  GoogleDriveProvider: StubProvider,
}))
vi.mock('../utils/oneDriveProvider', () => ({
  OneDriveProvider: StubProvider,
}))

import { usePrivateSync } from './usePrivateSync'

const noopMedia: MediaStoreAccessor = {
  getImageBlob: async () => null,
  getAudioBlob: async () => null,
  getVideoBlob: async () => null,
  putImage: async () => {},
  putAudio: async () => {},
  putVideo: async () => {},
  listLocalMediaIds: async () => ({ images: [], audio: [], videos: [] }),
}

function makeAnswer(id: string, value: string, updatedAt: string) {
  return {
    id,
    questionId: id,
    categoryId: 'cat',
    value,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt,
  }
}

function makeState(privateSync?: AppState['privateSync']): AppState {
  return {
    profile: null,
    answers: {},
    friends: [],
    friendAnswers: [],
    customQuestions: [],
    privateSync,
  }
}

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => value,
  })
}

/** Yields to the microtask queue several times so promises chained inside
 *  the hook's effect bodies have a chance to settle. Does *not* advance
 *  fake timers. */
async function flushMicrotasks(rounds = 5) {
  for (let i = 0; i < rounds; i++) {
    await Promise.resolve()
  }
}

describe('usePrivateSync', () => {
  beforeEach(() => {
    providerSpy.push.mockReset().mockResolvedValue(undefined)
    providerSpy.pull.mockReset().mockResolvedValue(null)
    providerSpy.deactivate.mockReset().mockResolvedValue(undefined)
    setOnline(true)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('H-01: Initialer State ohne privateSync → isEnabled=false, providerType=null', () => {
    const { result } = renderHook(() =>
      usePrivateSync(makeState(), noopMedia, () => {}),
    )
    expect(result.current.isEnabled).toBe(false)
    expect(result.current.providerType).toBeNull()
    expect(result.current.status).toBe('idle')
  })

  it('H-02: Debounce – zwei State-Updates innerhalb 5 s lösen nur einen push aus', async () => {
    vi.useFakeTimers()
    let state = makeState({
      providerType: 'supabase',
      userId: 'u1',
      lastSyncAt: null,
      status: 'idle',
      errorMessage: null,
    })
    const { rerender } = renderHook(({ s }: { s: AppState }) =>
      usePrivateSync(s, noopMedia, () => {}),
      { initialProps: { s: state } },
    )

    // First change at t=0
    state = { ...state, answers: { ...state.answers, A: makeAnswer('A', 'a', '2024-01-01T00:00:00.000Z') } }
    rerender({ s: state })
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })

    // Second change at t=2 s (still within the 5 s debounce window)
    state = { ...state, answers: { ...state.answers, B: makeAnswer('B', 'b', '2024-01-01T00:00:00.000Z') } }
    rerender({ s: state })

    // Advance past the second debounce (5 s after the second change)
    await act(async () => { await vi.advanceTimersByTimeAsync(5_500) })
    await act(async () => { await flushMicrotasks() })

    expect(providerSpy.push).toHaveBeenCalledTimes(1)
  })

  it('H-03: syncNow während laufender Sync startet keinen parallelen Sync', async () => {
    let release!: () => void
    providerSpy.push.mockImplementationOnce(
      () => new Promise<void>(res => { release = res }),
    )

    const state = makeState({
      providerType: 'supabase',
      userId: 'u1',
      lastSyncAt: null,
      status: 'idle',
      errorMessage: null,
    })
    const { result } = renderHook(() =>
      usePrivateSync(state, noopMedia, () => {}),
    )

    // Kick off the first sync; it stays pending until release() is called.
    let p1!: Promise<void>
    await act(async () => {
      p1 = result.current.syncNow()
      await flushMicrotasks()
    })
    expect(providerSpy.push).toHaveBeenCalledTimes(1)

    // Second call must short-circuit and not start another push.
    let p2!: Promise<void>
    await act(async () => {
      p2 = result.current.syncNow()
      await flushMicrotasks()
    })
    expect(providerSpy.push).toHaveBeenCalledTimes(1)

    // Resolve the first sync.
    release()
    await act(async () => { await p1; await p2 })
  })

  it('H-04: 3 fehlgeschlagene Pushes → status=error, errorMessage gesetzt', async () => {
    vi.useFakeTimers()
    providerSpy.push.mockRejectedValue(new SyncError('network down', 'network'))

    const state = makeState({
      providerType: 'supabase',
      userId: 'u1',
      lastSyncAt: null,
      status: 'idle',
      errorMessage: null,
    })
    const { result } = renderHook(() =>
      usePrivateSync(state, noopMedia, () => {}),
    )

    // First attempt – manually triggered.
    await act(async () => {
      await result.current.syncNow()
    })
    // Two more retry attempts via the 30 s retry timer.
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
    await act(async () => { await flushMicrotasks() })

    expect(providerSpy.push).toHaveBeenCalledTimes(3)
    expect(result.current.status).toBe('error')
    expect(result.current.errorMessage).toBe('network down')
  })

  it('H-05: Offline → push wird nicht aufgerufen', async () => {
    setOnline(false)
    const state = makeState({
      providerType: 'supabase',
      userId: 'u1',
      lastSyncAt: null,
      status: 'idle',
      errorMessage: null,
    })
    const { result } = renderHook(() =>
      usePrivateSync(state, noopMedia, () => {}),
    )

    await act(async () => { await result.current.syncNow() })
    expect(providerSpy.push).not.toHaveBeenCalled()
  })

  it('H-07: Erfolgreicher Sync aktualisiert lastSyncAt und ruft onSyncSuccess auf', async () => {
    const onSyncSuccess = vi.fn()
    const state = makeState({
      providerType: 'supabase',
      userId: 'u1',
      lastSyncAt: null,
      status: 'idle',
      errorMessage: null,
    })
    const { result } = renderHook(() =>
      usePrivateSync(state, noopMedia, () => {}, onSyncSuccess),
    )

    expect(result.current.lastSyncAt).toBeNull()

    await act(async () => { await result.current.syncNow() })

    expect(result.current.lastSyncAt).not.toBeNull()
    expect(onSyncSuccess).toHaveBeenCalledTimes(1)
    expect(onSyncSuccess.mock.calls[0][0]).toBe(result.current.lastSyncAt)
  })

  it('H-08: privateSync-only AppState-Update löst keinen erneuten Sync aus', async () => {
    vi.useFakeTimers()
    let state = makeState({
      providerType: 'supabase',
      userId: 'u1',
      lastSyncAt: null,
      status: 'idle',
      errorMessage: null,
    })
    const { rerender } = renderHook(({ s }: { s: AppState }) =>
      usePrivateSync(s, noopMedia, () => {}),
      { initialProps: { s: state } },
    )

    // Initial trigger from first render's debounce.
    await act(async () => { await vi.advanceTimersByTimeAsync(5_500) })
    await act(async () => { await flushMicrotasks() })
    const initialPushCount = providerSpy.push.mock.calls.length

    // Update only privateSync.lastSyncAt (simulates persisting after sync).
    state = {
      ...state,
      privateSync: { ...state.privateSync!, lastSyncAt: '2024-06-01T00:00:00.000Z' },
    }
    rerender({ s: state })
    await act(async () => { await vi.advanceTimersByTimeAsync(5_500) })
    await act(async () => { await flushMicrotasks() })

    expect(providerSpy.push.mock.calls.length).toBe(initialPushCount)
  })

  it('H-06: Erfolgreicher Pull ruft onStateMerged mit merged State auf', async () => {
    const merged: AppState = {
      profile: null,
      answers: { A: makeAnswer('A', 'merged', '2024-01-01T00:00:00.000Z') },
      friends: [],
      friendAnswers: [],
      customQuestions: [],
    }
    providerSpy.pull.mockResolvedValue({ merged, downloadedMediaIds: [] })

    const onStateMerged = vi.fn()
    const state = makeState({
      providerType: 'supabase',
      userId: 'u1',
      lastSyncAt: null,
      status: 'idle',
      errorMessage: null,
    })
    const { result } = renderHook(() =>
      usePrivateSync(state, noopMedia, onStateMerged),
    )

    await act(async () => { await result.current.syncNow() })

    expect(onStateMerged).toHaveBeenCalledTimes(1)
    expect(onStateMerged.mock.calls[0][0]).toBe(merged)
  })
})

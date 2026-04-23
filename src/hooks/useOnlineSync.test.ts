import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { SharedMemory, Annotation, OnlineSharingState } from '../types'

const bootstrapSession = vi.fn()
const fetchIncomingShares = vi.fn()

vi.mock('../utils/sharingService', () => ({
  bootstrapSession: (...args: unknown[]) => bootstrapSession(...args),
  fetchIncomingShares: (...args: unknown[]) => fetchIncomingShares(...args),
}))

import { useOnlineSync } from './useOnlineSync'

const memory: SharedMemory = {
  shareId: 'share-1',
  ownerDeviceId: 'owner',
  ownerName: 'Anna',
  questionId: 'q1',
  questionText: 'Was war …?',
  value: 'antwort',
  imageIds: [],
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
}

const annotation: Annotation = {
  annotationId: 'a1',
  shareId: 'share-1',
  authorDeviceId: 'author',
  authorName: 'Ben',
  text: 'cool',
  imageIds: [],
  createdAt: '2024-01-01T00:00:00.000Z',
}

describe('useOnlineSync', () => {
  beforeEach(() => {
    bootstrapSession.mockReset()
    fetchIncomingShares.mockReset()
  })

  it('stays a no-op when online sharing is disabled', async () => {
    const { result } = renderHook(() => useOnlineSync({ enabled: false } as OnlineSharingState))
    // Give microtasks a chance to flush
    await new Promise(r => setTimeout(r, 0))
    expect(result.current.ready).toBe(false)
    expect(result.current.deviceId).toBeNull()
    expect(result.current.memories).toEqual([])
    expect(bootstrapSession).not.toHaveBeenCalled()
    expect(fetchIncomingShares).not.toHaveBeenCalled()
  })

  it('stays a no-op when onlineSharing is undefined', async () => {
    renderHook(() => useOnlineSync(undefined))
    await new Promise(r => setTimeout(r, 0))
    expect(bootstrapSession).not.toHaveBeenCalled()
  })

  it('bootstraps, populates state and invokes onRegistered when enabled', async () => {
    bootstrapSession.mockResolvedValue({ deviceId: 'dev-1', publicKeyB64: 'pk-1' })
    fetchIncomingShares.mockResolvedValue({ memories: [memory], annotations: [annotation] })
    const onRegistered = vi.fn()

    const { result } = renderHook(() =>
      useOnlineSync({ enabled: true } as OnlineSharingState, onRegistered),
    )

    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.deviceId).toBe('dev-1')
    expect(result.current.publicKeyB64).toBe('pk-1')
    expect(result.current.memories).toEqual([memory])
    expect(result.current.annotations).toEqual([annotation])
    expect(onRegistered).toHaveBeenCalledWith('dev-1', 'pk-1')
  })

  it('surfaces errors from bootstrap through the error state', async () => {
    bootstrapSession.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() =>
      useOnlineSync({ enabled: true } as OnlineSharingState),
    )
    await waitFor(() => expect(result.current.error).toBe('boom'))
    expect(result.current.ready).toBe(false)
  })

  it('refresh() re-fetches incoming shares and updates state', async () => {
    bootstrapSession.mockResolvedValue({ deviceId: 'dev-1', publicKeyB64: 'pk-1' })
    fetchIncomingShares.mockResolvedValueOnce({ memories: [], annotations: [] })
    const { result } = renderHook(() =>
      useOnlineSync({ enabled: true } as OnlineSharingState),
    )
    await waitFor(() => expect(result.current.ready).toBe(true))

    fetchIncomingShares.mockResolvedValueOnce({ memories: [memory], annotations: [] })
    await act(async () => { await result.current.refresh() })
    expect(result.current.memories).toEqual([memory])
  })

  it('refresh() captures fetch errors without crashing the hook', async () => {
    bootstrapSession.mockResolvedValue({ deviceId: 'dev-1', publicKeyB64: 'pk-1' })
    fetchIncomingShares.mockResolvedValueOnce({ memories: [], annotations: [] })
    const { result } = renderHook(() =>
      useOnlineSync({ enabled: true } as OnlineSharingState),
    )
    await waitFor(() => expect(result.current.ready).toBe(true))

    fetchIncomingShares.mockRejectedValueOnce(new Error('offline'))
    await act(async () => { await result.current.refresh() })
    expect(result.current.error).toBe('offline')
  })

  it('resets state when sharing is toggled off after being enabled', async () => {
    bootstrapSession.mockResolvedValue({ deviceId: 'dev-1', publicKeyB64: 'pk-1' })
    fetchIncomingShares.mockResolvedValue({ memories: [memory], annotations: [annotation] })

    let sharing: OnlineSharingState | undefined = { enabled: true } as OnlineSharingState
    const { result, rerender } = renderHook(() => useOnlineSync(sharing))
    await waitFor(() => expect(result.current.ready).toBe(true))

    sharing = { enabled: false } as OnlineSharingState
    rerender()

    await waitFor(() => expect(result.current.ready).toBe(false))
    expect(result.current.deviceId).toBeNull()
    expect(result.current.memories).toEqual([])
  })
})

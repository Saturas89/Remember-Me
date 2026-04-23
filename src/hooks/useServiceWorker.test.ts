import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const needRefreshState: [boolean, (v: boolean) => void][] = []
const updateServiceWorkerMock = vi.fn()

// Mock the virtual module provided by vite-plugin-pwa
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => {
    // Return the most recently-set tuple so tests can drive `needRefresh`
    const latest = needRefreshState[needRefreshState.length - 1]
    return {
      needRefresh: latest,
      updateServiceWorker: updateServiceWorkerMock,
    }
  },
}))

import { useServiceWorker } from './useServiceWorker'

describe('useServiceWorker', () => {
  beforeEach(() => {
    needRefreshState.length = 0
    updateServiceWorkerMock.mockReset()
  })

  it('exposes needRefresh from the underlying vite-plugin-pwa hook', () => {
    const setter = vi.fn()
    needRefreshState.push([true, setter])
    const { result } = renderHook(() => useServiceWorker())
    expect(result.current.needRefresh).toBe(true)
  })

  it('applyUpdate delegates to updateServiceWorker(true) to skip waiting', () => {
    needRefreshState.push([false, vi.fn()])
    const { result } = renderHook(() => useServiceWorker())
    act(() => result.current.applyUpdate())
    expect(updateServiceWorkerMock).toHaveBeenCalledWith(true)
  })

  it('dismiss() hides the banner by resetting needRefresh to false', () => {
    const setter = vi.fn()
    needRefreshState.push([true, setter])
    const { result } = renderHook(() => useServiceWorker())
    act(() => result.current.dismiss())
    expect(setter).toHaveBeenCalledWith(false)
  })

  it('reports needRefresh=false by default (no waiting worker)', () => {
    needRefreshState.push([false, vi.fn()])
    const { result } = renderHook(() => useServiceWorker())
    expect(result.current.needRefresh).toBe(false)
  })
})

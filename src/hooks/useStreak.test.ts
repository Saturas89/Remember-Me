import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStreak } from './useStreak'
import type { StreakState, UseStreakArgs } from './useStreak'

// Mock milestone notifications
const mockShowNotification = vi.fn()
const mockServiceWorkerReady = Promise.resolve({
  showNotification: mockShowNotification,
})
Object.defineProperty(navigator, 'serviceWorker', {
  value: { ready: mockServiceWorkerReady },
  writable: true,
})
Object.defineProperty(window, 'Notification', {
  value: { permission: 'granted' },
  writable: true,
})

const mockSaveStreak = vi.fn()

function args(over: Partial<UseStreakArgs> = {}): UseStreakArgs {
  return {
    isLoaded: true,
    answers: {},
    streak: undefined,
    saveStreak: mockSaveStreak,
    ...over,
  }
}

describe('useStreak', () => {
  const todayISO = '2026-04-27'
  const yesterdayISO = '2026-04-26'
  const threeDaysAgoISO = '2026-04-24'

  beforeEach(() => {
    mockSaveStreak.mockReset()
    mockShowNotification.mockReset()
    localStorage.removeItem('rm-last-milestone')
    vi.useFakeTimers()
    // System time at noon local to avoid timezone date-shift surprises
    vi.setSystemTime(new Date(`${todayISO}T12:00:00`))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns initial streak state when no stored streak exists', () => {
    const { result } = renderHook(() => useStreak(args()))

    expect(result.current.streak.current).toBe(0)
    expect(result.current.streak.longest).toBe(0)
    expect(result.current.totalAnswered).toBe(0)
  })

  it('exposes existing stored streak', () => {
    const stored: StreakState = { current: 5, longest: 12, lastAnswerDate: yesterdayISO }
    const answers = {
      a: { id: 'a', questionId: 'a', categoryId: 'c', value: 'one', createdAt: '', updatedAt: '' },
      b: { id: 'b', questionId: 'b', categoryId: 'c', value: 'two', createdAt: '', updatedAt: '' },
    }

    const { result } = renderHook(() => useStreak(args({ streak: stored, answers })))

    expect(result.current.streak).toEqual({
      current: 5,
      longest: 12,
      lastAnswerDate: yesterdayISO,
    })
    expect(result.current.totalAnswered).toBe(2)
  })

  it('increments current streak when answering on consecutive days', () => {
    const stored: StreakState = { current: 3, longest: 5, lastAnswerDate: yesterdayISO }

    const { result } = renderHook(() => useStreak(args({ streak: stored })))

    act(() => {
      result.current.recordAnswer(todayISO, 11)
    })

    expect(mockSaveStreak).toHaveBeenCalledWith(
      expect.objectContaining({
        current: 4,
        longest: 5,
        lastAnswerDate: todayISO,
      }),
    )
  })

  it('updates longest streak when current exceeds it', () => {
    const stored: StreakState = { current: 5, longest: 5, lastAnswerDate: yesterdayISO }

    const { result } = renderHook(() => useStreak(args({ streak: stored })))

    act(() => {
      result.current.recordAnswer(todayISO, 21)
    })

    expect(mockSaveStreak).toHaveBeenCalledWith(
      expect.objectContaining({ current: 6, longest: 6 }),
    )
  })

  it('resets current streak when gap > 1 day', () => {
    const stored: StreakState = { current: 5, longest: 8, lastAnswerDate: threeDaysAgoISO }

    const { result } = renderHook(() => useStreak(args({ streak: stored })))

    act(() => {
      result.current.recordAnswer(todayISO, 16)
    })

    expect(mockSaveStreak).toHaveBeenCalledWith(
      expect.objectContaining({ current: 1, longest: 8 }),
    )
  })

  it('checkStreakReset resets current when lastAnswerDate > 1 day ago', () => {
    const stored: StreakState = { current: 7, longest: 10, lastAnswerDate: threeDaysAgoISO }

    renderHook(() => useStreak(args({ streak: stored })))

    // useEffect on mount calls checkStreakReset → triggers saveStreak with current=0
    expect(mockSaveStreak).toHaveBeenCalledWith(
      expect.objectContaining({ current: 0, longest: 10 }),
    )
  })

  it('does not reset streak when within 1 day', () => {
    const stored: StreakState = { current: 4, longest: 6, lastAnswerDate: yesterdayISO }

    renderHook(() => useStreak(args({ streak: stored })))

    expect(mockSaveStreak).not.toHaveBeenCalled()
  })

  it('uses today as default when recordAnswer called without date', () => {
    const { result } = renderHook(() => useStreak(args()))

    act(() => {
      result.current.recordAnswer(undefined, 1)
    })

    expect(mockSaveStreak).toHaveBeenCalledWith(
      expect.objectContaining({ lastAnswerDate: todayISO, current: 1 }),
    )
  })

  it('persists streak changes via saveStreak', () => {
    const { result } = renderHook(() => useStreak(args()))

    act(() => {
      result.current.recordAnswer(todayISO, 5)
    })

    expect(mockSaveStreak).toHaveBeenCalled()
    const calls = mockSaveStreak.mock.calls
    const last = calls[calls.length - 1]?.[0] as StreakState
    expect(last.current).toBe(1)
    expect(last.lastAnswerDate).toBe(todayISO)
  })

  describe('milestone notifications', () => {
    // The trigger path goes:
    //   recordAnswer (sync)
    //     → triggerMilestoneNotification (async)
    //       → await navigator.serviceWorker.ready   (microtask 1)
    //       → await registration.showNotification(…) (microtask 2)
    // So the test has to flush at least two microtasks before asserting.
    async function flushMilestone() {
      await Promise.resolve()
      await Promise.resolve()
    }

    it('triggers notification at 10th answer', async () => {
      const { result } = renderHook(() => useStreak(args()))

      await act(async () => {
        result.current.recordAnswer(todayISO, 10)
        await flushMilestone()
      })

      expect(mockShowNotification).toHaveBeenCalled()
    })

    it('triggers notification at 25th answer', async () => {
      const { result } = renderHook(() => useStreak(args()))

      await act(async () => {
        result.current.recordAnswer(todayISO, 25)
        await flushMilestone()
      })

      expect(mockShowNotification).toHaveBeenCalled()
    })

    it('triggers notification at 50th answer', async () => {
      const { result } = renderHook(() => useStreak(args()))

      await act(async () => {
        result.current.recordAnswer(todayISO, 50)
        await flushMilestone()
      })

      expect(mockShowNotification).toHaveBeenCalled()
    })

    it('triggers notification at 100th answer', async () => {
      const { result } = renderHook(() => useStreak(args()))

      await act(async () => {
        result.current.recordAnswer(todayISO, 100)
        await flushMilestone()
      })

      expect(mockShowNotification).toHaveBeenCalled()
    })

    it('does not trigger notification for non-milestone answers', async () => {
      const { result } = renderHook(() => useStreak(args()))

      await act(async () => {
        result.current.recordAnswer(todayISO, 15)
        await flushMilestone()
      })

      expect(mockShowNotification).not.toHaveBeenCalled()
    })

    it('does not trigger duplicate milestone notifications', async () => {
      const stored: StreakState = { current: 1, longest: 1, lastAnswerDate: yesterdayISO }
      const { result } = renderHook(() => useStreak(args({ streak: stored })))

      // First time hitting milestone 10
      await act(async () => {
        result.current.recordAnswer(todayISO, 10)
        await flushMilestone()
      })

      expect(mockShowNotification).toHaveBeenCalledTimes(1)
      mockShowNotification.mockReset()

      // Answer again with still 10 total - should not trigger again
      await act(async () => {
        result.current.recordAnswer(todayISO, 10)
        await flushMilestone()
      })

      expect(mockShowNotification).not.toHaveBeenCalled()
    })
  })
})

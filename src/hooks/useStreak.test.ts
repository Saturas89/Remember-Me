import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStreak } from './useStreak'
import type { StreakState } from './useStreak'

// Mock useAnswers — useStreak delegates state to it
const mockSaveStreak = vi.fn()
let mockStreak: StreakState | undefined
let mockAnswers: Record<string, { value: string }> = {}

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

vi.mock('./useAnswers', () => ({
  useAnswers: () => ({
    isLoaded: true,
    answers: mockAnswers,
    streak: mockStreak,
    saveStreak: mockSaveStreak,
  }),
}))

describe('useStreak', () => {
  const todayISO = '2026-04-27'
  const yesterdayISO = '2026-04-26'
  const threeDaysAgoISO = '2026-04-24'

  beforeEach(() => {
    mockSaveStreak.mockReset()
    mockShowNotification.mockReset()
    mockStreak = undefined
    mockAnswers = {}
    vi.useFakeTimers()
    // System time at noon local to avoid timezone date-shift surprises
    vi.setSystemTime(new Date(`${todayISO}T12:00:00`))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns initial streak state when no stored streak exists', () => {
    const { result } = renderHook(() => useStreak())

    expect(result.current.streak.current).toBe(0)
    expect(result.current.streak.longest).toBe(0)
    expect(result.current.totalAnswered).toBe(0)
  })

  it('exposes existing stored streak', () => {
    mockStreak = { current: 5, longest: 12, lastAnswerDate: yesterdayISO }
    mockAnswers = {
      a: { value: 'one' },
      b: { value: 'two' },
    }

    const { result } = renderHook(() => useStreak())

    expect(result.current.streak).toEqual({
      current: 5,
      longest: 12,
      lastAnswerDate: yesterdayISO,
    })
    expect(result.current.totalAnswered).toBe(2)
  })

  it('increments current streak when answering on consecutive days', () => {
    mockStreak = { current: 3, longest: 5, lastAnswerDate: yesterdayISO }

    const { result } = renderHook(() => useStreak())

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
    mockStreak = { current: 5, longest: 5, lastAnswerDate: yesterdayISO }

    const { result } = renderHook(() => useStreak())

    act(() => {
      result.current.recordAnswer(todayISO, 21)
    })

    expect(mockSaveStreak).toHaveBeenCalledWith(
      expect.objectContaining({ current: 6, longest: 6 }),
    )
  })

  it('resets current streak when gap > 1 day', () => {
    mockStreak = { current: 5, longest: 8, lastAnswerDate: threeDaysAgoISO }

    const { result } = renderHook(() => useStreak())

    act(() => {
      result.current.recordAnswer(todayISO, 16)
    })

    expect(mockSaveStreak).toHaveBeenCalledWith(
      expect.objectContaining({ current: 1, longest: 8 }),
    )
  })

  it('checkStreakReset resets current when lastAnswerDate > 1 day ago', () => {
    mockStreak = { current: 7, longest: 10, lastAnswerDate: threeDaysAgoISO }

    renderHook(() => useStreak())

    // useEffect on mount calls checkStreakReset → triggers saveStreak with current=0
    expect(mockSaveStreak).toHaveBeenCalledWith(
      expect.objectContaining({ current: 0, longest: 10 }),
    )
  })

  it('does not reset streak when within 1 day', () => {
    mockStreak = { current: 4, longest: 6, lastAnswerDate: yesterdayISO }

    renderHook(() => useStreak())

    expect(mockSaveStreak).not.toHaveBeenCalled()
  })

  it('uses today as default when recordAnswer called without date', () => {
    const { result } = renderHook(() => useStreak())

    act(() => {
      result.current.recordAnswer(undefined, 1)
    })

    expect(mockSaveStreak).toHaveBeenCalledWith(
      expect.objectContaining({ lastAnswerDate: todayISO, current: 1 }),
    )
  })

  it('persists streak changes via saveStreak', () => {
    const { result } = renderHook(() => useStreak())

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
    it('triggers notification at 10th answer', () => {
      const { result } = renderHook(() => useStreak())

      act(() => {
        result.current.recordAnswer(todayISO, 10)
      })

      expect(mockShowNotification).toHaveBeenCalled()
    })

    it('triggers notification at 25th answer', () => {
      const { result } = renderHook(() => useStreak())

      act(() => {
        result.current.recordAnswer(todayISO, 25)
      })

      expect(mockShowNotification).toHaveBeenCalled()
    })

    it('triggers notification at 50th answer', () => {
      const { result } = renderHook(() => useStreak())

      act(() => {
        result.current.recordAnswer(todayISO, 50)
      })

      expect(mockShowNotification).toHaveBeenCalled()
    })

    it('triggers notification at 100th answer', () => {
      const { result } = renderHook(() => useStreak())

      act(() => {
        result.current.recordAnswer(todayISO, 100)
      })

      expect(mockShowNotification).toHaveBeenCalled()
    })

    it('does not trigger notification for non-milestone answers', () => {
      const { result } = renderHook(() => useStreak())

      act(() => {
        result.current.recordAnswer(todayISO, 15)
      })

      expect(mockShowNotification).not.toHaveBeenCalled()
    })

    it('does not trigger duplicate milestone notifications', () => {
      mockStreak = { current: 1, longest: 1, lastAnswerDate: yesterdayISO }
      const { result } = renderHook(() => useStreak())

      // First time hitting milestone 10
      act(() => {
        result.current.recordAnswer(todayISO, 10)
      })

      expect(mockShowNotification).toHaveBeenCalledTimes(1)
      mockShowNotification.mockReset()

      // Answer again with still 10 total - should not trigger again
      act(() => {
        result.current.recordAnswer(todayISO, 10)
      })

      expect(mockShowNotification).not.toHaveBeenCalled()
    })
  })
})

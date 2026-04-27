import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStreak } from './useStreak'

const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn()
}

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
})

const mockNavigator = {
  setAppBadge: vi.fn(),
  clearAppBadge: vi.fn()
}

Object.defineProperty(window, 'navigator', {
  value: mockNavigator,
  writable: true
})

describe('useStreak', () => {
  const todayISO = '2026-04-27'
  const yesterdayISO = '2026-04-26'
  const threeDaysAgoISO = '2026-04-24'

  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue(null)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-27T10:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns initial streak state when no localStorage data', () => {
    const { result } = renderHook(() => useStreak())
    
    expect(result.current.streak).toEqual({
      current: 0,
      longest: 0,
      lastAnswerDate: ''
    })
    expect(result.current.totalAnswered).toBe(0)
  })

  it('loads existing streak from localStorage', () => {
    const existingState = JSON.stringify({
      streak: {
        current: 5,
        longest: 12,
        lastAnswerDate: yesterdayISO
      },
      answered: 42
    })
    mockLocalStorage.getItem.mockReturnValue(existingState)

    const { result } = renderHook(() => useStreak())
    
    expect(result.current.streak).toEqual({
      current: 5,
      longest: 12,
      lastAnswerDate: yesterdayISO
    })
    expect(result.current.totalAnswered).toBe(42)
  })

  it('increments current streak when answering on consecutive days', () => {
    const existingState = JSON.stringify({
      streak: {
        current: 3,
        longest: 5,
        lastAnswerDate: yesterdayISO
      },
      answered: 10
    })
    mockLocalStorage.getItem.mockReturnValue(existingState)

    const { result } = renderHook(() => useStreak())
    
    act(() => {
      result.current.recordAnswer(todayISO, 11)
    })

    expect(result.current.streak.current).toBe(4)
    expect(result.current.streak.longest).toBe(5)
    expect(result.current.streak.lastAnswerDate).toBe(todayISO)
    expect(result.current.totalAnswered).toBe(11)
  })

  it('updates longest streak when current exceeds it', () => {
    const existingState = JSON.stringify({
      streak: {
        current: 5,
        longest: 5,
        lastAnswerDate: yesterdayISO
      },
      answered: 20
    })
    mockLocalStorage.getItem.mockReturnValue(existingState)

    const { result } = renderHook(() => useStreak())
    
    act(() => {
      result.current.recordAnswer(todayISO, 21)
    })

    expect(result.current.streak.current).toBe(6)
    expect(result.current.streak.longest).toBe(6)
  })

  it('resets current streak when gap > 1 day', () => {
    const existingState = JSON.stringify({
      streak: {
        current: 5,
        longest: 8,
        lastAnswerDate: threeDaysAgoISO
      },
      answered: 15
    })
    mockLocalStorage.getItem.mockReturnValue(existingState)

    const { result } = renderHook(() => useStreak())
    
    act(() => {
      result.current.recordAnswer(todayISO, 16)
    })

    expect(result.current.streak.current).toBe(1)
    expect(result.current.streak.longest).toBe(8)
  })

  it('checkStreakReset resets current when lastAnswerDate > 1 day ago', () => {
    const existingState = JSON.stringify({
      streak: {
        current: 7,
        longest: 10,
        lastAnswerDate: threeDaysAgoISO
      },
      answered: 25
    })
    mockLocalStorage.getItem.mockReturnValue(existingState)

    const { result } = renderHook(() => useStreak())
    
    act(() => {
      result.current.checkStreakReset()
    })

    expect(result.current.streak.current).toBe(0)
    expect(result.current.streak.longest).toBe(10)
  })

  it('does not reset streak when within 1 day', () => {
    const existingState = JSON.stringify({
      streak: {
        current: 4,
        longest: 6,
        lastAnswerDate: yesterdayISO
      },
      answered: 12
    })
    mockLocalStorage.getItem.mockReturnValue(existingState)

    const { result } = renderHook(() => useStreak())
    
    act(() => {
      result.current.checkStreakReset()
    })

    expect(result.current.streak.current).toBe(4)
  })

  it('uses today as default when recordAnswer called without date', () => {
    const { result } = renderHook(() => useStreak())
    
    act(() => {
      result.current.recordAnswer(undefined, 1)
    })

    expect(result.current.streak.lastAnswerDate).toBe(todayISO)
    expect(result.current.streak.current).toBe(1)
  })

  it('persists streak changes to localStorage', () => {
    const { result } = renderHook(() => useStreak())
    
    act(() => {
      result.current.recordAnswer(todayISO, 5)
    })

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'remember-me-state',
      expect.stringContaining('"current":1')
    )
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'remember-me-state',
      expect.stringContaining(`"lastAnswerDate":"${todayISO}"`)
    )
  })
})
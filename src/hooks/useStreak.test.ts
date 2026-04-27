import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

async function loadHook() {
  vi.resetModules()
  return (await import('./useStreak')).useStreak
}

describe('useStreak', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-27'))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('initializes with default streak state when no data exists', async () => {
    const useStreak = await loadHook()
    const { result } = renderHook(() => useStreak())
    
    expect(result.current.streak).toEqual({
      current: 0,
      longest: 0,
      lastAnswerDate: ''
    })
    expect(result.current.totalAnswered).toBe(0)
  })

  it('records first answer and sets streak to 1', async () => {
    const useStreak = await loadHook()
    const { result } = renderHook(() => useStreak())
    
    act(() => {
      result.current.recordAnswer('2026-04-27', 1)
    })
    
    expect(result.current.streak.current).toBe(1)
    expect(result.current.streak.longest).toBe(1)
    expect(result.current.streak.lastAnswerDate).toBe('2026-04-27')
    expect(result.current.totalAnswered).toBe(1)
  })

  it('increments streak when answering on consecutive days', async () => {
    const useStreak = await loadHook()
    const { result } = renderHook(() => useStreak())
    
    act(() => {
      result.current.recordAnswer('2026-04-26', 1)
    })
    
    vi.setSystemTime(new Date('2026-04-27'))
    
    act(() => {
      result.current.recordAnswer('2026-04-27', 2)
    })
    
    expect(result.current.streak.current).toBe(2)
    expect(result.current.streak.longest).toBe(2)
  })

  it('maintains streak when answering on the same day', async () => {
    const useStreak = await loadHook()
    const { result } = renderHook(() => useStreak())
    
    act(() => {
      result.current.recordAnswer('2026-04-27', 1)
    })
    
    act(() => {
      result.current.recordAnswer('2026-04-27', 2)
    })
    
    expect(result.current.streak.current).toBe(1)
    expect(result.current.totalAnswered).toBe(2)
  })

  it('resets current streak when answering after gap > 1 day', async () => {
    const useStreak = await loadHook()
    const { result } = renderHook(() => useStreak())
    
    act(() => {
      result.current.recordAnswer('2026-04-25', 1)
    })
    
    // Skip a day - answer on 2026-04-27 (2 days later)
    act(() => {
      result.current.recordAnswer('2026-04-27', 2)
    })
    
    expect(result.current.streak.current).toBe(1)
    expect(result.current.streak.longest).toBe(1)
  })

  it('preserves longest streak when current is reset', async () => {
    const useStreak = await loadHook()
    const { result } = renderHook(() => useStreak())
    
    // Build up a 3-day streak
    act(() => {
      result.current.recordAnswer('2026-04-24', 1)
    })
    act(() => {
      result.current.recordAnswer('2026-04-25', 2)
    })
    act(() => {
      result.current.recordAnswer('2026-04-26', 3)
    })
    
    expect(result.current.streak.current).toBe(3)
    expect(result.current.streak.longest).toBe(3)
    
    // Break streak with gap
    act(() => {
      result.current.recordAnswer('2026-04-28', 4)
    })
    
    expect(result.current.streak.current).toBe(1)
    expect(result.current.streak.longest).toBe(3) // Preserved
  })

  it('uses today as default date when recordAnswer called without date', async () => {
    vi.setSystemTime(new Date('2026-04-27'))
    const useStreak = await loadHook()
    const { result } = renderHook(() => useStreak())
    
    act(() => {
      result.current.recordAnswer(undefined, 1)
    })
    
    expect(result.current.streak.lastAnswerDate).toBe('2026-04-27')
  })

  it('checkStreakReset resets current streak when last answer > 1 day ago', async () => {
    const useStreak = await loadHook()
    const { result } = renderHook(() => useStreak())
    
    // Set up a streak from 2 days ago
    act(() => {
      result.current.recordAnswer('2026-04-25', 1)
    })
    
    expect(result.current.streak.current).toBe(1)
    
    // Move to current time (2026-04-27) and check reset
    vi.setSystemTime(new Date('2026-04-27'))
    act(() => {
      result.current.checkStreakReset()
    })
    
    expect(result.current.streak.current).toBe(0)
    expect(result.current.streak.longest).toBe(1) // Preserved
  })

  it('does not reset streak when last answer was yesterday or today', async () => {
    const useStreak = await loadHook()
    const { result } = renderHook(() => useStreak())
    
    // Answer yesterday
    act(() => {
      result.current.recordAnswer('2026-04-26', 1)
    })
    
    act(() => {
      result.current.checkStreakReset()
    })
    
    expect(result.current.streak.current).toBe(1)
  })

  it('persists streak state to localStorage', async () => {
    const useStreak = await loadHook()
    const { result } = renderHook(() => useStreak())
    
    act(() => {
      result.current.recordAnswer('2026-04-27', 5)
    })
    
    // Check localStorage contains streak data
    const savedState = localStorage.getItem('remember-me-state')
    expect(savedState).toBeTruthy()
    
    const parsed = JSON.parse(savedState!)
    expect(parsed.streak).toEqual({
      current: 1,
      longest: 1,
      lastAnswerDate: '2026-04-27'
    })
  })

  it('restores streak state from localStorage on initialization', async () => {
    // Pre-populate localStorage
    localStorage.setItem('remember-me-state', JSON.stringify({
      streak: {
        current: 5,
        longest: 10,
        lastAnswerDate: '2026-04-26'
      },
      totalAnswered: 42
    }))
    
    const useStreak = await loadHook()
    const { result } = renderHook(() => useStreak())
    
    expect(result.current.streak.current).toBe(5)
    expect(result.current.streak.longest).toBe(10)
    expect(result.current.streak.lastAnswerDate).toBe('2026-04-26')
    expect(result.current.totalAnswered).toBe(42)
  })

  it('handles malformed localStorage data gracefully', async () => {
    localStorage.setItem('remember-me-state', 'invalid-json')
    
    const useStreak = await loadHook()
    const { result } = renderHook(() => useStreak())
    
    expect(result.current.streak).toEqual({
      current: 0,
      longest: 0,
      lastAnswerDate: ''
    })
  })
})
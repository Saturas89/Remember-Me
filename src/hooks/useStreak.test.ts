import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStreak } from './useStreak'

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn()
}
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage })

// Mock Date.now for consistent testing
const mockNow = new Date('2026-04-27T10:00:00Z')
vi.spyOn(Date, 'now').mockImplementation(() => mockNow.getTime())

describe('useStreak', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue(null)
  })

  it('initializes with default streak state when no saved data exists', () => {
    const { result } = renderHook(() => useStreak())
    
    expect(result.current.streak).toEqual({
      current: 0,
      longest: 0,
      lastAnswerDate: ''
    })
    expect(result.current.totalAnswered).toBe(0)
  })

  it('loads existing streak data from localStorage', () => {
    const savedState = {
      streak: {
        current: 5,
        longest: 10,
        lastAnswerDate: '2026-04-26'
      }
    }
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedState))

    const { result } = renderHook(() => useStreak())
    
    expect(result.current.streak).toEqual({
      current: 5,
      longest: 10,
      lastAnswerDate: '2026-04-26'
    })
  })

  it('records answer with default date (today)', () => {
    const { result } = renderHook(() => useStreak())
    
    act(() => {
      result.current.recordAnswer(undefined, 1)
    })

    expect(result.current.streak.current).toBe(1)
    expect(result.current.streak.longest).toBe(1)
    expect(result.current.streak.lastAnswerDate).toBe('2026-04-27')
    expect(result.current.totalAnswered).toBe(1)
  })

  it('records answer with custom date', () => {
    const { result } = renderHook(() => useStreak())
    
    act(() => {
      result.current.recordAnswer('2026-04-25', 3)
    })

    expect(result.current.streak.lastAnswerDate).toBe('2026-04-25')
    expect(result.current.totalAnswered).toBe(3)
  })

  it('extends streak when answering consecutive days', () => {
    const initialState = {
      streak: {
        current: 2,
        longest: 5,
        lastAnswerDate: '2026-04-26'
      }
    }
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(initialState))

    const { result } = renderHook(() => useStreak())
    
    act(() => {
      result.current.recordAnswer('2026-04-27', 5)
    })

    expect(result.current.streak.current).toBe(3)
    expect(result.current.streak.longest).toBe(5) // Still 5 as current (3) < longest (5)
  })

  it('updates longest streak when current exceeds it', () => {
    const initialState = {
      streak: {
        current: 4,
        longest: 4,
        lastAnswerDate: '2026-04-26'
      }
    }
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(initialState))

    const { result } = renderHook(() => useStreak())
    
    act(() => {
      result.current.recordAnswer('2026-04-27', 7)
    })

    expect(result.current.streak.current).toBe(5)
    expect(result.current.streak.longest).toBe(5) // Updated as current exceeded previous longest
  })

  it('resets current streak when gap is more than 1 day', () => {
    const initialState = {
      streak: {
        current: 3,
        longest: 5,
        lastAnswerDate: '2026-04-24' // 3 days ago
      }
    }
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(initialState))

    const { result } = renderHook(() => useStreak())
    
    act(() => {
      result.current.recordAnswer('2026-04-27', 8)
    })

    expect(result.current.streak.current).toBe(1) // Reset to 1
    expect(result.current.streak.longest).toBe(5) // Longest preserved
  })

  it('maintains streak when answering same day', () => {
    const initialState = {
      streak: {
        current: 2,
        longest: 5,
        lastAnswerDate: '2026-04-27'
      }
    }
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(initialState))

    const { result } = renderHook(() => useStreak())
    
    act(() => {
      result.current.recordAnswer('2026-04-27', 10)
    })

    expect(result.current.streak.current).toBe(2) // Same day, no increment
    expect(result.current.totalAnswered).toBe(10)
  })

  it('checkStreakReset resets current to 0 when lastAnswerDate is more than 1 day old', () => {
    const initialState = {
      streak: {
        current: 5,
        longest: 10,
        lastAnswerDate: '2026-04-25' // 2 days ago
      }
    }
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(initialState))

    const { result } = renderHook(() => useStreak())
    
    act(() => {
      result.current.checkStreakReset()
    })

    expect(result.current.streak.current).toBe(0)
    expect(result.current.streak.longest).toBe(10) // Longest preserved
  })

  it('checkStreakReset does not reset when lastAnswerDate is today or yesterday', () => {
    const initialState = {
      streak: {
        current: 3,
        longest: 5,
        lastAnswerDate: '2026-04-26' // Yesterday
      }
    }
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(initialState))

    const { result } = renderHook(() => useStreak())
    
    act(() => {
      result.current.checkStreakReset()
    })

    expect(result.current.streak.current).toBe(3) // Unchanged
  })

  it('persists streak data to localStorage when recording answer', () => {
    const { result } = renderHook(() => useStreak())
    
    act(() => {
      result.current.recordAnswer('2026-04-27', 5)
    })

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'remember-me-state',
      expect.stringContaining('"streak":{"current":1,"longest":1,"lastAnswerDate":"2026-04-27"}')
    )
  })
})
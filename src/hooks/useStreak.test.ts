import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStreak, type StreakState, type UseStreakReturn } from './useStreak'

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage })

describe('useStreak', () => {
  const mockDate = new Date('2024-01-15T10:00:00.000Z')
  
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(mockDate)
  })

  it('returns initial state when no persisted data exists', () => {
    mockLocalStorage.getItem.mockReturnValue(null)
    
    const { result } = renderHook(() => useStreak())
    
    expect(result.current.streak).toEqual({
      current: 0,
      longest: 0,
      lastAnswerDate: ''
    })
    expect(result.current.totalAnswered).toBe(0)
    expect(mockLocalStorage.getItem).toHaveBeenCalledWith('remember-me-state')
  })

  it('loads persisted streak data from localStorage', () => {
    const mockAppState = {
      streak: {
        current: 5,
        longest: 10,
        lastAnswerDate: '2024-01-14'
      },
      totalAnswered: 25
    }
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockAppState))
    
    const { result } = renderHook(() => useStreak())
    
    expect(result.current.streak).toEqual(mockAppState.streak)
    expect(result.current.totalAnswered).toBe(25)
  })

  it('recordAnswer increments streak for consecutive days', () => {
    const initialState = {
      streak: {
        current: 3,
        longest: 5,
        lastAnswerDate: '2024-01-14'  // Yesterday
      },
      totalAnswered: 10
    }
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(initialState))
    
    const { result } = renderHook(() => useStreak())
    
    act(() => {
      result.current.recordAnswer('2024-01-15', 11) // Today
    })
    
    expect(result.current.streak).toEqual({
      current: 4,
      longest: 5,
      lastAnswerDate: '2024-01-15'
    })
    expect(result.current.totalAnswered).toBe(11)
  })

  it('recordAnswer updates longest streak when current exceeds it', () => {
    const initialState = {
      streak: {
        current: 5,
        longest: 5,
        lastAnswerDate: '2024-01-14'
      },
      totalAnswered: 15
    }
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(initialState))
    
    const { result } = renderHook(() => useStreak())
    
    act(() => {
      result.current.recordAnswer('2024-01-15', 16)
    })
    
    expect(result.current.streak).toEqual({
      current: 6,
      longest: 6,  // Updated longest
      lastAnswerDate: '2024-01-15'
    })
  })

  it('recordAnswer resets streak after gap > 1 day', () => {
    const initialState = {
      streak: {
        current: 7,
        longest: 10,
        lastAnswerDate: '2024-01-10'  // 5 days ago
      },
      totalAnswered: 20
    }
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(initialState))
    
    const { result } = renderHook(() => useStreak())
    
    act(() => {
      result.current.recordAnswer('2024-01-15', 21)
    })
    
    expect(result.current.streak).toEqual({
      current: 1,  // Reset to 1 for new start
      longest: 10,  // Longest unchanged
      lastAnswerDate: '2024-01-15'
    })
  })

  it('recordAnswer defaults to today when no date provided', () => {
    mockLocalStorage.getItem.mockReturnValue(null)
    
    const { result } = renderHook(() => useStreak())
    
    act(() => {
      result.current.recordAnswer(undefined, 1)
    })
    
    expect(result.current.streak.lastAnswerDate).toBe('2024-01-15')
    expect(result.current.streak.current).toBe(1)
  })

  it('checkStreakReset resets current streak if lastAnswerDate > 1 day ago', () => {
    const oldState = {
      streak: {
        current: 5,
        longest: 10,
        lastAnswerDate: '2024-01-10'  // 5 days ago
      },
      totalAnswered: 25
    }
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(oldState))
    
    const { result } = renderHook(() => useStreak())
    
    act(() => {
      result.current.checkStreakReset()
    })
    
    expect(result.current.streak).toEqual({
      current: 0,  // Reset to 0
      longest: 10,  // Unchanged
      lastAnswerDate: '2024-01-10'  // Unchanged
    })
  })

  it('checkStreakReset does not reset if lastAnswerDate is recent', () => {
    const recentState = {
      streak: {
        current: 3,
        longest: 8,
        lastAnswerDate: '2024-01-14'  // Yesterday
      },
      totalAnswered: 15
    }
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(recentState))
    
    const { result } = renderHook(() => useStreak())
    
    act(() => {
      result.current.checkStreakReset()
    })
    
    expect(result.current.streak).toEqual({
      current: 3,  // Unchanged
      longest: 8,
      lastAnswerDate: '2024-01-14'
    })
  })

  it('persists state changes to localStorage', () => {
    mockLocalStorage.getItem.mockReturnValue(null)
    
    const { result } = renderHook(() => useStreak())
    
    act(() => {
      result.current.recordAnswer('2024-01-15', 1)
    })
    
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'remember-me-state',
      JSON.stringify({
        streak: {
          current: 1,
          longest: 1,
          lastAnswerDate: '2024-01-15'
        },
        totalAnswered: 1
      })
    )
  })
})
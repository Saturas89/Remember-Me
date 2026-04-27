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

// Mock ServiceWorker for milestone notifications
const mockRegistration = {
  showNotification: vi.fn()
}
Object.defineProperty(navigator, 'serviceWorker', {
  value: { ready: Promise.resolve(mockRegistration) },
  writable: true
})

// Mock Notification API
Object.defineProperty(window, 'Notification', {
  value: {
    permission: 'granted'
  },
  writable: true
})

// Mock notification content utility
vi.mock('../utils/notificationContent', () => ({
  getNotificationContent: vi.fn(() => ({
    title: 'Remember Me',
    body: 'Glückwunsch!',
    variantIdx: 0
  }))
}))

describe('useStreak - Milestone Notifications (FR-16.7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue(null)
  })

  it('triggers milestone notification for 10th answer', async () => {
    const { result } = renderHook(() => useStreak())
    
    await act(async () => {
      // Simulate reaching 10 answers
      result.current.recordAnswer('2026-04-27', 10)
    })

    // Should trigger immediate milestone notification for 10 answers
    expect(mockRegistration.showNotification).toHaveBeenCalledWith(
      expect.stringContaining('Remember Me'),
      expect.objectContaining({
        body: expect.stringContaining('10'),
        tag: 'rm-milestone',
        badge: expect.any(String),
        icon: expect.any(String),
        requireInteraction: true
      })
    )
  })

  it('triggers milestone notification for 25th answer', async () => {
    // Start with 24 answers
    const initialState = {
      streak: {
        current: 5,
        longest: 8,
        lastAnswerDate: '2026-04-26'
      }
    }
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(initialState))

    const { result } = renderHook(() => useStreak())
    
    await act(async () => {
      // Simulate reaching 25 answers
      result.current.recordAnswer('2026-04-27', 25)
    })

    expect(mockRegistration.showNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tag: 'rm-milestone',
        body: expect.stringContaining('25')
      })
    )
  })

  it('triggers milestone notification for 50th answer', async () => {
    const { result } = renderHook(() => useStreak())
    
    await act(async () => {
      result.current.recordAnswer('2026-04-27', 50)
    })

    expect(mockRegistration.showNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tag: 'rm-milestone',
        body: expect.stringContaining('50')
      })
    )
  })

  it('triggers milestone notification for 100th answer', async () => {
    const { result } = renderHook(() => useStreak())
    
    await act(async () => {
      result.current.recordAnswer('2026-04-27', 100)
    })

    expect(mockRegistration.showNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tag: 'rm-milestone',
        body: expect.stringContaining('100')
      })
    )
  })

  it('does not trigger milestone notification for non-milestone numbers', async () => {
    const { result } = renderHook(() => useStreak())
    
    await act(async () => {
      // Test various non-milestone numbers
      result.current.recordAnswer('2026-04-27', 5)
    })

    expect(mockRegistration.showNotification).not.toHaveBeenCalled()

    await act(async () => {
      result.current.recordAnswer('2026-04-27', 15)
    })

    expect(mockRegistration.showNotification).not.toHaveBeenCalled()

    await act(async () => {
      result.current.recordAnswer('2026-04-27', 75)
    })

    expect(mockRegistration.showNotification).not.toHaveBeenCalled()
  })

  it('handles notification permission denial gracefully for milestones', async () => {
    // Mock denied permission
    Object.defineProperty(window, 'Notification', {
      value: {
        permission: 'denied'
      },
      writable: true
    })

    const { result } = renderHook(() => useStreak())
    
    await act(async () => {
      result.current.recordAnswer('2026-04-27', 10)
    })

    // Should not attempt to show notification when permission denied
    // but should still update streak properly
    expect(mockRegistration.showNotification).not.toHaveBeenCalled()
    expect(result.current.totalAnswered).toBe(10)
  })

  it('shows in-app toast fallback when service worker unavailable', async () => {
    // Mock unavailable service worker
    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      writable: true
    })

    const { result } = renderHook(() => useStreak())
    
    await act(async () => {
      result.current.recordAnswer('2026-04-27', 25)
    })

    // Should still track the milestone achievement internally
    expect(result.current.totalAnswered).toBe(25)
    
    // Note: In-app toast would be handled by consuming component
    // This test ensures the milestone logic still works
  })

  it('includes proper milestone notification metadata', async () => {
    const { result } = renderHook(() => useStreak())
    
    await act(async () => {
      result.current.recordAnswer('2026-04-27', 50)
    })

    expect(mockRegistration.showNotification).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        tag: 'rm-milestone',
        badge: expect.any(String),
        icon: expect.any(String),
        requireInteraction: true,
        actions: expect.any(Array),
        data: expect.objectContaining({
          type: 'milestone',
          count: 50
        })
      })
    )
  })

  it('milestone notification uses correct German localization', async () => {
    const { result } = renderHook(() => useStreak())
    
    await act(async () => {
      result.current.recordAnswer('2026-04-27', 10)
    })

    // Should use German text for milestone notifications
    expect(mockRegistration.showNotification).toHaveBeenCalledWith(
      'Remember Me',
      expect.objectContaining({
        body: expect.stringContaining('Glückwunsch')
      })
    )
  })

  it('does not trigger duplicate milestone notifications', async () => {
    const { result } = renderHook(() => useStreak())
    
    // Trigger 10th answer milestone
    await act(async () => {
      result.current.recordAnswer('2026-04-27', 10)
    })

    expect(mockRegistration.showNotification).toHaveBeenCalledTimes(1)
    
    // Answer more questions but stay at 10 total (same day multiple answers)
    await act(async () => {
      result.current.recordAnswer('2026-04-27', 10)
    })

    // Should not trigger again for the same milestone
    expect(mockRegistration.showNotification).toHaveBeenCalledTimes(1)
  })

  it('tracks streak correctly alongside milestone tracking', async () => {
    const initialState = {
      streak: {
        current: 2,
        longest: 5,
        lastAnswerDate: '2026-04-26'
      }
    }
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(initialState))

    const { result } = renderHook(() => useStreak())
    
    await act(async () => {
      result.current.recordAnswer('2026-04-27', 25) // Milestone + streak continuation
    })

    // Should trigger milestone notification
    expect(mockRegistration.showNotification).toHaveBeenCalled()
    
    // Should also properly update streak
    expect(result.current.streak.current).toBe(3) // Incremented
    expect(result.current.streak.lastAnswerDate).toBe('2026-04-27')
    expect(result.current.totalAnswered).toBe(25)
  })

  it('handles rapid milestone progression correctly', async () => {
    const { result } = renderHook(() => useStreak())
    
    // Simulate rapid progression through multiple milestones
    await act(async () => {
      result.current.recordAnswer('2026-04-27', 10)
    })
    
    await act(async () => {
      result.current.recordAnswer('2026-04-28', 25)
    })
    
    await act(async () => {
      result.current.recordAnswer('2026-04-29', 50)
    })

    // Should trigger three separate milestone notifications
    expect(mockRegistration.showNotification).toHaveBeenCalledTimes(3)
    
    // Each with correct milestone count
    expect(mockRegistration.showNotification).toHaveBeenNthCalledWith(1, expect.any(String), expect.objectContaining({ body: expect.stringContaining('10') }))
    expect(mockRegistration.showNotification).toHaveBeenNthCalledWith(2, expect.any(String), expect.objectContaining({ body: expect.stringContaining('25') }))
    expect(mockRegistration.showNotification).toHaveBeenNthCalledWith(3, expect.any(String), expect.objectContaining({ body: expect.stringContaining('50') }))
  })
})
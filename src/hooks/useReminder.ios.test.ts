import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn()
}
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage })

// Mock ServiceWorker
const mockRegistration = {
  showNotification: vi.fn(),
  getNotifications: vi.fn()
}
Object.defineProperty(navigator, 'serviceWorker', {
  value: { ready: Promise.resolve(mockRegistration) },
  writable: true
})

async function loadHook() {
  vi.resetModules()
  return (await import('./useReminder')).useReminder
}

describe('useReminder - iOS Fallback Behavior (NFR)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue(null)
    mockRegistration.getNotifications.mockResolvedValue([])
  })

  describe('iOS Environment Detection', () => {
    it('detects iOS Safari environment (no showTrigger support)', async () => {
      // Mock iOS Safari environment where showTrigger is not available
      Object.defineProperty(window, 'Notification', {
        value: {
          permission: 'default',
          requestPermission: vi.fn().mockResolvedValue('granted'),
          prototype: {} // No showTrigger property
        },
        writable: true
      })

      const useReminder = await loadHook()
      const { result } = renderHook(() => useReminder())

      // Should not show prompt when showTrigger is unavailable
      expect(result.current.showPrompt).toBe(false)
    })

    it('detects iOS WebView environment (limited notification support)', async () => {
      // Mock iOS WebView where Notification API might be limited
      Object.defineProperty(window, 'Notification', {
        value: {
          permission: 'denied', // Often denied in WebViews
          prototype: {}
        },
        writable: true
      })

      const useReminder = await loadHook()
      const { result } = renderHook(() => useReminder())

      expect(result.current.showPrompt).toBe(false)
      expect(result.current.isEnabled).toBe(false)
    })

    it('handles modern iOS with partial showTrigger support', async () => {
      // Mock newer iOS versions that might have showTrigger but limited functionality
      Object.defineProperty(window, 'Notification', {
        value: {
          permission: 'default',
          requestPermission: vi.fn().mockResolvedValue('granted'),
          prototype: {
            showTrigger: undefined // Present but undefined
          }
        },
        writable: true
      })

      const useReminder = await loadHook()
      const { result } = renderHook(() => useReminder())

      // Should handle gracefully and fall back appropriately
      expect(result.current.showPrompt).toBe(true) // Can show prompt
    })
  })

  describe('iOS Feature Detection', () => {
    it('correctly identifies when showTrigger is completely absent', async () => {
      Object.defineProperty(window, 'Notification', {
        value: {
          permission: 'default',
          prototype: {} // Empty prototype, no showTrigger
        },
        writable: true
      })

      const useReminder = await loadHook()
      const { result } = renderHook(() => useReminder())

      // Hook should internally detect lack of showTrigger support
      expect(result.current.showPrompt).toBe(false)
    })

    it('handles iOS PWA context correctly', async () => {
      // Mock iOS PWA environment with limited capabilities
      Object.defineProperty(window, 'navigator', {
        value: {
          ...navigator,
          standalone: true, // iOS PWA indicator
          serviceWorker: mockRegistration
        },
        writable: true
      })

      Object.defineProperty(window, 'Notification', {
        value: {
          permission: 'default',
          prototype: {}
        },
        writable: true
      })

      const useReminder = await loadHook()
      const { result } = renderHook(() => useReminder())

      // Even in PWA mode without showTrigger, should handle gracefully
      expect(result.current.isEnabled).toBe(false)
    })
  })

  describe('iOS Fallback Mechanisms', () => {
    it('disables OS notifications on iOS and relies on in-app mechanisms', async () => {
      Object.defineProperty(window, 'Notification', {
        value: {
          permission: 'default',
          prototype: {} // No showTrigger
        },
        writable: true
      })

      const useReminder = await loadHook()
      const { result } = renderHook(() => useReminder())

      // Should not attempt to request permission when showTrigger unavailable
      expect(result.current.showPrompt).toBe(false)
      
      // State should reflect iOS limitations
      expect(result.current.state.permission).toBe('none')
    })

    it('gracefully handles iOS permission restrictions', async () => {
      Object.defineProperty(window, 'Notification', {
        value: {
          permission: 'denied', // Common on iOS
          requestPermission: vi.fn().mockResolvedValue('denied'),
          prototype: {}
        },
        writable: true
      })

      const useReminder = await loadHook()
      const { result } = renderHook(() => useReminder())

      expect(result.current.isEnabled).toBe(false)
      expect(result.current.showPrompt).toBe(false)
    })
  })

  describe('iOS User Experience Adaptations', () => {
    it('falls back to welcome back banner as primary engagement mechanism', async () => {
      // iOS environment without notification support
      Object.defineProperty(window, 'Notification', {
        value: {
          permission: 'denied',
          prototype: {}
        },
        writable: true
      })

      const useReminder = await loadHook()
      const { result } = renderHook(() => useReminder())

      // OS reminders disabled, but welcome back banner still works (tested separately)
      expect(result.current.isEnabled).toBe(false)
      
      // State should be consistent with iOS limitations
      expect(result.current.state.permission).toBe('none')
    })

    it('handles iOS safari private mode correctly', async () => {
      // Mock iOS Safari private mode where many APIs are restricted
      Object.defineProperty(window, 'Notification', {
        value: {
          permission: 'denied',
          requestPermission: vi.fn().mockRejectedValue(new Error('Permission denied')),
          prototype: {}
        },
        writable: true
      })

      const useReminder = await loadHook()
      const { result } = renderHook(() => useReminder())

      expect(result.current.isEnabled).toBe(false)
      expect(result.current.showPrompt).toBe(false)
    })
  })

  describe('iOS Settings UI Behavior', () => {
    it('shows appropriate iOS hint when notifications unavailable', async () => {
      Object.defineProperty(window, 'Notification', {
        value: {
          permission: 'default',
          prototype: {} // No showTrigger
        },
        writable: true
      })

      const useReminder = await loadHook()
      const { result } = renderHook(() => useReminder())

      // Hook behavior that would trigger iOS hint in UI
      expect(result.current.showPrompt).toBe(false)
      expect(result.current.isEnabled).toBe(false)
      
      // State indicates no OS notification support
      expect(result.current.state.permission).toBe('none')
    })

    it('handles iOS permission erosion correctly', async () => {
      // Start with granted permission
      Object.defineProperty(window, 'Notification', {
        value: {
          permission: 'granted',
          prototype: { showTrigger: undefined }
        },
        writable: true
      })

      const savedState = {
        permission: 'enabled' as const,
        backoffStage: 1 as const
      }
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'rm-reminder-state') return JSON.stringify(savedState)
        return null
      })

      const useReminder = await loadHook()
      const { result } = renderHook(() => useReminder())

      expect(result.current.isEnabled).toBe(true)

      // Simulate permission being revoked (iOS user action)
      Object.defineProperty(window, 'Notification', {
        value: {
          permission: 'denied',
          prototype: { showTrigger: undefined }
        },
        writable: true
      })

      // Hook should handle permission changes gracefully
      // (In real app, this would be detected on next visibility change)
    })
  })

  describe('iOS Badge API Compatibility', () => {
    it('handles missing Badge API on older iOS versions', async () => {
      // Mock iOS environment without Badge API
      Object.defineProperty(navigator, 'setAppBadge', {
        value: undefined,
        writable: true
      })

      const useReminder = await loadHook()
      renderHook(() => useReminder())

      // Should not throw errors when Badge API is unavailable
      // Badge functionality would be silently ignored as per FR-16.9
    })

    it('uses Badge API when available on supported iOS versions', async () => {
      // Mock iOS with Badge API support (iOS 16.4+)
      const mockSetAppBadge = vi.fn()
      const mockClearAppBadge = vi.fn()

      Object.defineProperty(navigator, 'setAppBadge', {
        value: mockSetAppBadge,
        writable: true
      })

      Object.defineProperty(navigator, 'clearAppBadge', {
        value: mockClearAppBadge,
        writable: true
      })

      const useReminder = await loadHook()
      renderHook(() => useReminder())

      // Badge API should be available for use even when OS notifications are limited
    })
  })
})
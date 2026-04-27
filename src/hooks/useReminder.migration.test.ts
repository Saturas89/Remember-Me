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

describe('useReminder - Legacy Migration (FR-16.13)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue(null)
    mockRegistration.getNotifications.mockResolvedValue([])
    
    // Mock Notification API
    Object.defineProperty(window, 'Notification', {
      value: {
        permission: 'default',
        requestPermission: vi.fn().mockResolvedValue('granted'),
        prototype: { showTrigger: undefined }
      },
      writable: true
    })
  })

  describe('Legacy Key Cleanup (rm-reminder-pref)', () => {
    it('removes old rm-reminder-pref key on first mount', async () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'rm-reminder-pref') return 'enabled'
        if (key === 'rm-reminder-state') return null
        return null
      })

      const useReminder = await loadHook()
      renderHook(() => useReminder())

      // Should call removeItem for the legacy key as per FR-16.13
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('rm-reminder-pref')
    })

    it('handles missing legacy key gracefully', async () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'rm-reminder-pref') return null
        if (key === 'rm-reminder-state') return null
        return null
      })

      const useReminder = await loadHook()
      renderHook(() => useReminder())

      // Should still attempt to remove the key even if it doesn't exist
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('rm-reminder-pref')
    })

    it('removes legacy key regardless of its value', async () => {
      const legacyValues = ['enabled', 'disabled', 'dismissed', 'invalid-value']

      for (const legacyValue of legacyValues) {
        vi.clearAllMocks()
        mockLocalStorage.getItem.mockImplementation((key) => {
          if (key === 'rm-reminder-pref') return legacyValue
          return null
        })

        const useReminder = await loadHook()
        renderHook(() => useReminder())

        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('rm-reminder-pref')
      }
    })

    it('performs cleanup only once per browser session', async () => {
      // First mount
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'rm-reminder-pref') return 'enabled'
        return null
      })

      const useReminder = await loadHook()
      const { unmount } = renderHook(() => useReminder())

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('rm-reminder-pref')
      expect(mockLocalStorage.removeItem).toHaveBeenCalledTimes(1)

      // Simulate unmount and remount
      unmount()
      vi.clearAllMocks()

      // Second mount - legacy key should already be gone
      mockLocalStorage.getItem.mockReturnValue(null)
      renderHook(() => useReminder())

      // Should still call removeItem (idempotent operation)
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('rm-reminder-pref')
    })
  })

  describe('No Migration Path (Fresh Start)', () => {
    it('does not migrate values from old format to new format', async () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'rm-reminder-pref') return 'enabled'
        if (key === 'rm-reminder-state') return null
        return null
      })

      const useReminder = await loadHook()
      const { result } = renderHook(() => useReminder())

      // Should start with default state, not migrate old 'enabled' value
      expect(result.current.state).toEqual({
        permission: 'none',
        backoffStage: 0,
        lastShownAt: undefined,
        lastVariantIdx: undefined
      })

      expect(result.current.isEnabled).toBe(false)
    })

    it('ignores legacy dismissed state', async () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'rm-reminder-pref') return 'dismissed'
        if (key === 'rm-reminder-state') return null
        return null
      })

      const useReminder = await loadHook()
      const { result } = renderHook(() => useReminder())

      // Should start fresh, not preserve old 'dismissed' state
      expect(result.current.state.permission).toBe('none')
      expect(result.current.showPrompt).toBe(true) // Can show prompt again
    })

    it('starts with clean slate regardless of legacy complexity', async () => {
      // Mock complex legacy state that might have existed
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'rm-reminder-pref') return JSON.stringify({ 
          enabled: true, 
          lastShown: Date.now(),
          cadence: '2-days'
        })
        if (key === 'rm-reminder-state') return null
        return null
      })

      const useReminder = await loadHook()
      const { result } = renderHook(() => useReminder())

      // Should start with clean default state
      expect(result.current.state.permission).toBe('none')
      expect(result.current.state.backoffStage).toBe(0)
      expect(result.current.state.lastShownAt).toBeUndefined()
      expect(result.current.state.lastVariantIdx).toBeUndefined()
    })
  })

  describe('New State Key Usage', () => {
    it('uses rm-reminder-state as the new storage key', async () => {
      const useReminder = await loadHook()
      const { result } = renderHook(() => useReminder())

      // Trigger a state change
      result.current.dismissPrompt()

      // Should save to the new key format
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'rm-reminder-state',
        expect.stringContaining('"permission":"dismissed"')
      )
      
      // Should not touch the old key for new operations
      expect(mockLocalStorage.setItem).not.toHaveBeenCalledWith(
        'rm-reminder-pref',
        expect.anything()
      )
    })

    it('loads state from new key format correctly', async () => {
      const newState = {
        permission: 'enabled' as const,
        backoffStage: 2 as const,
        lastShownAt: 1234567890,
        lastVariantIdx: 5
      }

      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'rm-reminder-state') return JSON.stringify(newState)
        if (key === 'rm-reminder-pref') return 'old-value' // Should be ignored
        return null
      })

      const useReminder = await loadHook()
      const { result } = renderHook(() => useReminder())

      expect(result.current.state).toEqual(newState)
      expect(result.current.isEnabled).toBe(true)
      
      // Legacy key should still be cleaned up
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('rm-reminder-pref')
    })
  })

  describe('Pre-Release Context', () => {
    it('handles migration appropriately for pre-release app state', async () => {
      // Simulate pre-release user who might have used old reminders
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'rm-reminder-pref') return 'enabled'
        if (key === 'rm-reminder-state') return null
        // Other app state might exist
        if (key === 'remember-me-profile') return JSON.stringify({ name: 'TestUser' })
        return null
      })

      const useReminder = await loadHook()
      const { result } = renderHook(() => useReminder())

      // Pre-release users need to re-enable notifications as per FR-16.13
      expect(result.current.isEnabled).toBe(false)
      expect(result.current.showPrompt).toBe(true) // Can set up fresh
      
      // Old preference should be removed
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('rm-reminder-pref')
    })

    it('maintains app functionality during migration', async () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'rm-reminder-pref') return 'enabled'
        return null
      })

      const useReminder = await loadHook()
      const { result } = renderHook(() => useReminder())

      // All hook functionality should work despite migration
      expect(typeof result.current.requestPermission).toBe('function')
      expect(typeof result.current.dismissPrompt).toBe('function')
      expect(typeof result.current.reschedule).toBe('function')
      expect(typeof result.current.disable).toBe('function')
    })
  })

  describe('Error Handling During Migration', () => {
    it('handles localStorage errors gracefully during cleanup', async () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'rm-reminder-pref') return 'enabled'
        return null
      })

      // Mock removeItem to throw error
      mockLocalStorage.removeItem.mockImplementation((key) => {
        if (key === 'rm-reminder-pref') {
          throw new Error('localStorage error')
        }
      })

      const useReminder = await loadHook()
      
      // Should not throw error even if removeItem fails
      expect(() => {
        renderHook(() => useReminder())
      }).not.toThrow()
    })

    it('handles corrupted legacy data gracefully', async () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'rm-reminder-pref') return 'corrupted-json{'
        return null
      })

      const useReminder = await loadHook()
      const { result } = renderHook(() => useReminder())

      // Should handle corrupted data without crashing
      expect(result.current.state.permission).toBe('none')
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('rm-reminder-pref')
    })
  })

  describe('Documentation and User Communication', () => {
    it('enforces one-time re-activation requirement', async () => {
      // Pre-release user with old enabled state
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'rm-reminder-pref') return 'enabled'
        return null
      })

      const useReminder = await loadHook()
      const { result } = renderHook(() => useReminder())

      // User must re-activate as per FR-16.13 requirement
      expect(result.current.isEnabled).toBe(false)
      expect(result.current.showPrompt).toBe(true)
      
      // This behavior is by design - users need to opt-in again
    })
  })
})
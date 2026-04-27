import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useReminder, type ReminderState, type UseReminderReturn } from './useReminder'

// Legacy key for migration test
const LEGACY_REMINDER_PREF_KEY = 'rm-reminder-pref'
const NEW_REMINDER_STATE_KEY = 'rm-reminder-state'

// Mock ServiceWorker registration
const mockRegistration = {
  getNotifications: vi.fn(),
  showNotification: vi.fn()
}

// Mock navigator.serviceWorker
const mockServiceWorker = {
  ready: Promise.resolve(mockRegistration)
}

Object.defineProperty(navigator, 'serviceWorker', { value: mockServiceWorker })

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage })

function installNotification(
  permission: NotificationPermission,
  requestPermission: () => Promise<NotificationPermission>,
  withShowTrigger: boolean,
) {
  const proto: Record<string, unknown> = {}
  if (withShowTrigger) proto.showTrigger = undefined
  const Notif = Object.assign(
    function Notification() { /* no-op */ },
    { permission, requestPermission, prototype: proto },
  )
  ;(globalThis as unknown as { Notification: unknown }).Notification = Notif
  ;(window as unknown as { Notification: unknown }).Notification = Notif
}

function uninstallNotification() {
  delete (globalThis as { Notification?: unknown }).Notification
  delete (window as { Notification?: unknown }).Notification
}

async function loadHook() {
  vi.resetModules()
  return (await import('./useReminder')).useReminder
}

describe('useReminder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockLocalStorage.getItem.mockReturnValue(null)
    mockRegistration.getNotifications.mockResolvedValue([])
    uninstallNotification()
  })

  afterEach(() => {
    uninstallNotification()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('new REQ-016 API', () => {
    it('removes legacy rm-reminder-pref on first mount', () => {
      // Spec: FR-16.13 - Bei jedem ersten Hook-Init wird rm-reminder-pref entfernt
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === LEGACY_REMINDER_PREF_KEY) return '{"enabled": true}'
        return null
      })
      
      const { result } = renderHook(() => useReminder())
      
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(LEGACY_REMINDER_PREF_KEY)
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(NEW_REMINDER_STATE_KEY)
    })

    it('returns initial state when no persisted data exists', () => {
      const { result } = renderHook(() => useReminder())
      
      expect(result.current.state).toEqual({
        permission: 'none',
        backoffStage: 0,
        lastShownAt: undefined,
        lastVariantIdx: undefined
      })
    })

    it('loads persisted reminder state from new localStorage key', () => {
      // Spec: Datenschicht rm-reminder-state Key mit backoffStage etc.
      const persistedState = {
        permission: 'enabled',
        backoffStage: 2,
        lastShownAt: 1642240800000,
        lastVariantIdx: 3
      }
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(persistedState))
      
      const { result } = renderHook(() => useReminder())
      
      expect(result.current.state).toEqual(persistedState)
    })

    it('enable requests permission and sets enabled state on grant', async () => {
      installNotification('default', vi.fn().mockResolvedValue('granted'), true)
      
      const { result } = renderHook(() => useReminder())
      
      await act(async () => {
        await result.current.enable()
      })
      
      expect(result.current.state.permission).toBe('enabled')
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        NEW_REMINDER_STATE_KEY,
        expect.stringContaining('"permission":"enabled"')
      )
    })

    it('enable sets dismissed state on permission denied', async () => {
      installNotification('default', vi.fn().mockResolvedValue('denied'), true)
      
      const { result } = renderHook(() => useReminder())
      
      await act(async () => {
        await result.current.enable()
      })
      
      expect(result.current.state.permission).toBe('dismissed')
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        NEW_REMINDER_STATE_KEY,
        expect.stringContaining('"permission":"dismissed"')
      )
    })

    it('disable sets permission to none and persists state', () => {
      const initialState = {
        permission: 'enabled',
        backoffStage: 1,
        lastShownAt: 1642240800000,
        lastVariantIdx: 2
      }
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(initialState))
      
      const { result } = renderHook(() => useReminder())
      
      act(() => {
        result.current.disable()
      })
      
      expect(result.current.state.permission).toBe('none')
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        NEW_REMINDER_STATE_KEY,
        expect.stringContaining('"permission":"none"')
      )
    })

    it('reschedule clears existing notifications with rm-reminder tag', async () => {
      // Spec: FR-16.12 - Existierende Trigger mit tag: 'rm-reminder' werden entfernt
      const existingNotifications = [
        { tag: 'rm-reminder', close: vi.fn() },
        { tag: 'other', close: vi.fn() },
        { tag: 'rm-reminder', close: vi.fn() }
      ]
      mockRegistration.getNotifications.mockResolvedValue(existingNotifications)
      
      const enabledState = {
        permission: 'enabled',
        backoffStage: 1,
        lastShownAt: Date.now() - 4 * 24 * 60 * 60 * 1000, // 4 days ago
        lastVariantIdx: 0
      }
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(enabledState))
      
      const { result } = renderHook(() => useReminder())
      
      await act(async () => {
        await result.current.reschedule()
      })
      
      // Should close rm-reminder notifications only
      expect(existingNotifications[0].close).toHaveBeenCalled()
      expect(existingNotifications[2].close).toHaveBeenCalled()
      expect(existingNotifications[1].close).not.toHaveBeenCalled()
      expect(mockRegistration.getNotifications).toHaveBeenCalledWith({ tag: 'rm-reminder' })
    })

    it('handles backoff stages correctly - stage 3 stops scheduling', async () => {
      // Spec: FR-16.1 - Nach Stage 3 (24 Tage) wird stumm geschaltet
      const maxStageState = {
        permission: 'enabled',
        backoffStage: 3,
        lastShownAt: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
        lastVariantIdx: 4
      }
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(maxStageState))
      
      const { result } = renderHook(() => useReminder())
      
      expect(result.current.state.backoffStage).toBe(3)
      
      await act(async () => {
        await result.current.reschedule()
      })
      
      // Should clear existing but not schedule new notifications at stage 3+
      expect(mockRegistration.getNotifications).toHaveBeenCalledWith({ tag: 'rm-reminder' })
    })

    it('does not schedule when permission is none', async () => {
      const { result } = renderHook(() => useReminder())
      
      await act(async () => {
        await result.current.reschedule()
      })
      
      // Should not try to get notifications when permission is none
      expect(mockRegistration.getNotifications).not.toHaveBeenCalled()
    })

    it('handles showTrigger not available (iOS fallback)', async () => {
      // Spec: NFR iOS-Verhalten - showTrigger deaktiviert + Hinweis
      installNotification('default', vi.fn().mockResolvedValue('granted'), false)
      
      const { result } = renderHook(() => useReminder())
      
      await act(async () => {
        await result.current.enable()
      })
      
      // Should handle gracefully when showTrigger not available
      expect(result.current.state.permission).toBe('enabled')
    })
  })

  describe('legacy compatibility (for migration reference)', () => {
    it('does not prompt when notifications are not supported at all', async () => {
      const useReminder = await loadHook()
      const { result } = renderHook(() => useReminder())
      // Legacy behavior still supported during transition
      expect(result.current.state.permission).toBe('none')
    })

    it('does not prompt when showTrigger is unavailable', async () => {
      installNotification('default', async () => 'granted', false)
      const useReminder = await loadHook()
      const { result } = renderHook(() => useReminder())
      // Should handle iOS fallback case
      expect(result.current.state.permission).toBe('none')
    })
  })
})

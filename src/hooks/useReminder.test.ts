import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const REMINDER_PREF_KEY = 'rm-reminder-pref'
const NEW_REMINDER_KEY = 'rm-reminder-state'

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage })

// Mock ServiceWorker registration
const mockRegistration = {
  showNotification: vi.fn(),
  getNotifications: vi.fn()
}
Object.defineProperty(navigator, 'serviceWorker', {
  value: { ready: Promise.resolve(mockRegistration) },
  writable: true
})

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
    mockLocalStorage.getItem.mockReturnValue(null)
    mockRegistration.getNotifications.mockResolvedValue([])
    uninstallNotification()
  })

  afterEach(() => {
    uninstallNotification()
    vi.restoreAllMocks()
  })

  describe('Legacy Tests (Backward Compatibility)', () => {

  it('does not prompt when notifications are not supported at all', async () => {
    const useReminder = await loadHook()
    const { result } = renderHook(() => useReminder())
    expect(result.current.showPrompt).toBe(false)
    expect(result.current.isEnabled).toBe(false)
  })

  it('does not prompt when showTrigger is unavailable (fallback browsers)', async () => {
    installNotification('default', async () => 'granted', /* withShowTrigger */ false)
    const useReminder = await loadHook()
    const { result } = renderHook(() => useReminder())
    expect(result.current.showPrompt).toBe(false)
  })

  it('offers the prompt when notifications + showTrigger are available and pref is "none"', async () => {
    installNotification('default', async () => 'granted', true)
    const useReminder = await loadHook()
    const { result } = renderHook(() => useReminder())
    expect(result.current.showPrompt).toBe(true)
  })

  it('restores "enabled" preference from localStorage', async () => {
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === NEW_REMINDER_KEY) return JSON.stringify({ permission: 'enabled', backoffStage: 0 })
      return null
    })
    installNotification('granted', async () => 'granted', true)
    const useReminder = await loadHook()
    const { result } = renderHook(() => useReminder())
    expect(result.current.isEnabled).toBe(true)
    expect(result.current.showPrompt).toBe(false)
  })

  it('restores "dismissed" preference and hides the prompt', async () => {
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === NEW_REMINDER_KEY) return JSON.stringify({ permission: 'dismissed', backoffStage: 0 })
      return null
    })
    installNotification('default', async () => 'granted', true)
    const useReminder = await loadHook()
    const { result } = renderHook(() => useReminder())
    expect(result.current.showPrompt).toBe(false)
    expect(result.current.isEnabled).toBe(false)
  })

  it('dismissPrompt stores the "dismissed" preference', async () => {
    installNotification('default', async () => 'granted', true)
    const useReminder = await loadHook()
    const { result } = renderHook(() => useReminder())
    act(() => result.current.dismissPrompt())
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(NEW_REMINDER_KEY, expect.stringContaining('"permission":"dismissed"'))
    expect(result.current.showPrompt).toBe(false)
  })

  it('requestPermission switches to "enabled" on grant', async () => {
    const req = vi.fn<() => Promise<NotificationPermission>>().mockResolvedValue('granted')
    installNotification('default', req, true)
    const useReminder = await loadHook()
    const { result } = renderHook(() => useReminder())
    await act(async () => { await result.current.requestPermission() })
    expect(req).toHaveBeenCalled()
    await waitFor(() => expect(result.current.isEnabled).toBe(true))
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(NEW_REMINDER_KEY, expect.stringContaining('"permission":"enabled"'))
  })

  it('requestPermission switches to "dismissed" on denial', async () => {
    const req = vi.fn<() => Promise<NotificationPermission>>().mockResolvedValue('denied')
    installNotification('default', req, true)
    const useReminder = await loadHook()
    const { result } = renderHook(() => useReminder())
    await act(async () => { await result.current.requestPermission() })
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(NEW_REMINDER_KEY, expect.stringContaining('"permission":"dismissed"'))
    expect(result.current.isEnabled).toBe(false)
  })

  })

  describe('REQ-016 Enhanced Functionality', () => {

    describe('Legacy Migration (FR-16.13)', () => {
      it('removes old rm-reminder-pref key on first mount', async () => {
        mockLocalStorage.getItem.mockImplementation((key) => {
          if (key === REMINDER_PREF_KEY) return 'enabled'
          return null
        })
        installNotification('granted', async () => 'granted', true)
        
        const useReminder = await loadHook()
        renderHook(() => useReminder())
        
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(REMINDER_PREF_KEY)
      })

      it('handles missing legacy key gracefully', async () => {
        installNotification('default', async () => 'granted', true)
        
        const useReminder = await loadHook()
        renderHook(() => useReminder())
        
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(REMINDER_PREF_KEY)
      })
    })

    describe('New State Structure', () => {
      it('initializes with default state when no saved data exists', async () => {
        installNotification('default', async () => 'granted', true)
        
        const useReminder = await loadHook()
        const { result } = renderHook(() => useReminder())
        
        expect(result.current.state).toEqual({
          permission: 'none',
          backoffStage: 0,
          lastShownAt: undefined,
          lastVariantIdx: undefined
        })
      })

      it('loads existing state from new localStorage key', async () => {
        const savedState = {
          permission: 'enabled' as const,
          backoffStage: 2 as const,
          lastShownAt: 1714147200000,
          lastVariantIdx: 3
        }
        mockLocalStorage.getItem.mockImplementation((key) => {
          if (key === NEW_REMINDER_KEY) return JSON.stringify(savedState)
          return null
        })
        installNotification('granted', async () => 'granted', true)
        
        const useReminder = await loadHook()
        const { result } = renderHook(() => useReminder())
        
        expect(result.current.state).toEqual(savedState)
        expect(result.current.isEnabled).toBe(true)
      })

      it('persists state changes to new localStorage key', async () => {
        installNotification('default', async () => 'granted', true)
        
        const useReminder = await loadHook()
        const { result } = renderHook(() => useReminder())
        
        act(() => {
          result.current.dismissPrompt()
        })
        
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          NEW_REMINDER_KEY,
          expect.stringContaining('"permission":"dismissed"')
        )
      })
    })

    describe('Backoff Stage Management', () => {
      it('starts at stage 0 initially', async () => {
        installNotification('default', async () => 'granted', true)
        
        const useReminder = await loadHook()
        const { result } = renderHook(() => useReminder())
        
        expect(result.current.state.backoffStage).toBe(0)
      })

      it('resets backoff stage to 1 when rescheduling after inactivity', async () => {
        const savedState = {
          permission: 'enabled' as const,
          backoffStage: 3 as const,
          lastShownAt: Date.now() - (25 * 24 * 60 * 60 * 1000) // 25 days ago
        }
        mockLocalStorage.getItem.mockImplementation((key) => {
          if (key === NEW_REMINDER_KEY) return JSON.stringify(savedState)
          return null
        })
        installNotification('granted', async () => 'granted', true)
        
        const useReminder = await loadHook()
        const { result } = renderHook(() => useReminder())
        
        await act(async () => {
          await result.current.reschedule()
        })
        
        expect(result.current.state.backoffStage).toBe(1)
      })

      it('caps backoff stage at maximum of 3', async () => {
        const savedState = {
          permission: 'enabled' as const,
          backoffStage: 3 as const,
          lastShownAt: Date.now() - (30 * 24 * 60 * 60 * 1000) // 30 days ago
        }
        mockLocalStorage.getItem.mockImplementation((key) => {
          if (key === NEW_REMINDER_KEY) return JSON.stringify(savedState)
          return null
        })
        installNotification('granted', async () => 'granted', true)
        
        const useReminder = await loadHook()
        const { result } = renderHook(() => useReminder())
        
        await act(async () => {
          await result.current.reschedule()
        })
        
        // Should reset to 1, not exceed 3
        expect(result.current.state.backoffStage).toBe(1)
      })
    })

    describe('New API Methods', () => {
      it('provides reschedule method', async () => {
        installNotification('granted', async () => 'granted', true)
        
        const useReminder = await loadHook()
        const { result } = renderHook(() => useReminder())
        
        expect(typeof result.current.reschedule).toBe('function')
      })

      it('provides disable method', async () => {
        installNotification('granted', async () => 'granted', true)
        
        const useReminder = await loadHook()
        const { result } = renderHook(() => useReminder())
        
        expect(typeof result.current.disable).toBe('function')
      })

      it('disable method resets permission to none', async () => {
        const savedState = {
          permission: 'enabled' as const,
          backoffStage: 2 as const
        }
        mockLocalStorage.getItem.mockImplementation((key) => {
          if (key === NEW_REMINDER_KEY) return JSON.stringify(savedState)
          return null
        })
        installNotification('granted', async () => 'granted', true)
        
        const useReminder = await loadHook()
        const { result } = renderHook(() => useReminder())
        
        act(() => {
          result.current.disable()
        })
        
        expect(result.current.state.permission).toBe('none')
        expect(result.current.isEnabled).toBe(false)
        expect(result.current.state.backoffStage).toBe(0)
      })
    })

    describe('Notification Scheduling', () => {
      it('clears existing notifications before scheduling new ones', async () => {
        const existingNotifications = [
          { tag: 'rm-reminder', close: vi.fn() },
          { tag: 'other-notification', close: vi.fn() }
        ]
        mockRegistration.getNotifications.mockResolvedValue(existingNotifications)
        
        const savedState = {
          permission: 'enabled' as const,
          backoffStage: 0 as const
        }
        mockLocalStorage.getItem.mockImplementation((key) => {
          if (key === NEW_REMINDER_KEY) return JSON.stringify(savedState)
          return null
        })
        installNotification('granted', async () => 'granted', true)
        
        const useReminder = await loadHook()
        const { result } = renderHook(() => useReminder())
        
        await act(async () => {
          await result.current.reschedule()
        })
        
        expect(existingNotifications[0].close).toHaveBeenCalled()
        expect(existingNotifications[1].close).not.toHaveBeenCalled() // Different tag
      })

      it('updates lastShownAt when scheduling new notification', async () => {
        const savedState = {
          permission: 'enabled' as const,
          backoffStage: 0 as const
        }
        mockLocalStorage.getItem.mockImplementation((key) => {
          if (key === NEW_REMINDER_KEY) return JSON.stringify(savedState)
          return null
        })
        installNotification('granted', async () => 'granted', true)
        
        const useReminder = await loadHook()
        const { result } = renderHook(() => useReminder())
        
        const beforeTime = Date.now()
        await act(async () => {
          await result.current.reschedule()
        })
        const afterTime = Date.now()
        
        expect(result.current.state.lastShownAt).toBeGreaterThanOrEqual(beforeTime)
        expect(result.current.state.lastShownAt).toBeLessThanOrEqual(afterTime)
      })
    })

    describe('Backward Compatibility', () => {
      it('maintains all original properties in return interface', async () => {
        installNotification('default', async () => 'granted', true)
        
        const useReminder = await loadHook()
        const { result } = renderHook(() => useReminder())
        
        // Original interface
        expect(result.current).toHaveProperty('showPrompt')
        expect(result.current).toHaveProperty('requestPermission')
        expect(result.current).toHaveProperty('dismissPrompt')
        expect(result.current).toHaveProperty('isEnabled')
        
        // New REQ-016 interface
        expect(result.current).toHaveProperty('state')
        expect(result.current).toHaveProperty('reschedule')
        expect(result.current).toHaveProperty('disable')
      })
    })
  })
})

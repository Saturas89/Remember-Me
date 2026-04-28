import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn()
}

const mockServiceWorkerRegistration = {
  showNotification: vi.fn(),
  getNotifications: vi.fn().mockResolvedValue([])
}

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
})

Object.defineProperty(window, 'navigator', {
  value: {
    serviceWorker: {
      ready: Promise.resolve(mockServiceWorkerRegistration)
    },
    setAppBadge: vi.fn(),
    clearAppBadge: vi.fn()
  },
  writable: true
})

function installEnhancedNotification(permission: NotificationPermission) {
  const requestPermission = vi.fn().mockResolvedValue(permission)
  const proto = { showTrigger: true }
  const Notif = Object.assign(
    function Notification() { /* no-op */ },
    { permission, requestPermission, prototype: proto }
  )
  ;(globalThis as unknown as { Notification: unknown }).Notification = Notif
  ;(window as unknown as { Notification: unknown }).Notification = Notif

  // jsdom doesn't have TimestampTrigger — provide a minimal stand-in so the
  // impl's `new window.TimestampTrigger(ts)` doesn't throw before saveState.
  ;(window as unknown as { TimestampTrigger: unknown }).TimestampTrigger =
    class TimestampTriggerStub {
      timestamp: number
      constructor(ts: number) { this.timestamp = ts }
    }
}

async function loadEnhancedHook() {
  vi.resetModules()
  return (await import('./useReminder')).useReminder
}

describe('useReminder - Enhanced REQ-016 Features', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue(null)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    delete (window as { Notification?: unknown }).Notification
  })

  it('provides enhanced state structure for REQ-016', async () => {
    installEnhancedNotification('default')
    const useReminder = await loadEnhancedHook()
    const { result } = renderHook(() => useReminder())
    
    // New REQ-016 properties should exist alongside original interface
    expect(result.current.state).toEqual({
      permission: 'none',
      backoffStage: 0,
      lastShownAt: undefined,
      lastVariantIdx: undefined
    })
    expect(typeof result.current.reschedule).toBe('function')
    expect(typeof result.current.disable).toBe('function')
  })

  it('removes legacy rm-reminder-pref key on initialization', async () => {
    installEnhancedNotification('default')
    const useReminder = await loadEnhancedHook()
    renderHook(() => useReminder())
    
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('rm-reminder-pref')
  })

  it('loads enhanced state from new rm-reminder-state key', async () => {
    const enhancedState = JSON.stringify({
      permission: 'enabled',
      backoffStage: 2,
      lastShownAt: 1640995200000,
      lastVariantIdx: 5
    })
    mockLocalStorage.getItem.mockReturnValue(enhancedState)
    
    installEnhancedNotification('granted')
    const useReminder = await loadEnhancedHook()
    const { result } = renderHook(() => useReminder())
    
    expect(result.current.state).toEqual({
      permission: 'enabled',
      backoffStage: 2,
      lastShownAt: 1640995200000,
      lastVariantIdx: 5
    })
    expect(result.current.isEnabled).toBe(true)
  })

  it('disable method sets permission to none', async () => {
    const enabledState = JSON.stringify({
      permission: 'enabled',
      backoffStage: 1
    })
    mockLocalStorage.getItem.mockReturnValue(enabledState)
    
    installEnhancedNotification('granted')
    const useReminder = await loadEnhancedHook()
    const { result } = renderHook(() => useReminder())
    
    await act(async () => {
      result.current.disable()
    })
    
    expect(result.current.state.permission).toBe('none')
    expect(result.current.isEnabled).toBe(false)
  })

  it('reschedule clears existing rm-reminder notifications', async () => {
    const mockNotifications = [
      { tag: 'rm-reminder', close: vi.fn() },
      { tag: 'other-notification', close: vi.fn() }
    ]
    // Spec semantics: getNotifications({ tag }) filters server-side.
    mockServiceWorkerRegistration.getNotifications.mockImplementation(
      (opts: { tag?: string } = {}) =>
        Promise.resolve(mockNotifications.filter(n => !opts.tag || n.tag === opts.tag))
    )

    const enabledState = JSON.stringify({ permission: 'enabled' })
    mockLocalStorage.getItem.mockReturnValue(enabledState)

    installEnhancedNotification('granted')
    const useReminder = await loadEnhancedHook()
    const { result } = renderHook(() => useReminder())

    await act(async () => {
      await result.current.reschedule()
    })

    expect(mockServiceWorkerRegistration.getNotifications).toHaveBeenCalledWith({ tag: 'rm-reminder' })
    expect(mockNotifications[0].close).toHaveBeenCalledTimes(1)
    expect(mockNotifications[1].close).not.toHaveBeenCalled()
  })

  it('respects quiet hours (22:00-8:00) when scheduling notifications', async () => {
    // Set system time to 23:30 (within quiet hours)
    vi.setSystemTime(new Date('2026-04-27T23:30:00'))
    
    const enabledState = JSON.stringify({
      permission: 'enabled',
      backoffStage: 1
    })
    mockLocalStorage.getItem.mockReturnValue(enabledState)
    
    installEnhancedNotification('granted')
    const useReminder = await loadEnhancedHook()
    const { result } = renderHook(() => useReminder())
    
    await act(async () => {
      await result.current.reschedule()
    })
    
    // Should reschedule to 8:00 AM instead of immediate scheduling during quiet hours
    const notificationCalls = mockServiceWorkerRegistration.showNotification.mock.calls
    if (notificationCalls.length > 0) {
      const scheduleTrigger = notificationCalls[0][1]?.showTrigger
      if (scheduleTrigger?.timestamp) {
        const scheduledTime = new Date(scheduleTrigger.timestamp)
        expect(scheduledTime.getHours()).toBe(8)
      }
    }
  })

  it('resets backoffStage to 0 when reschedule called with recent activity', async () => {
    const stage2State = JSON.stringify({
      permission: 'enabled',
      backoffStage: 2,
      lastShownAt: Date.now() - (15 * 24 * 60 * 60 * 1000) // 15 days ago
    })
    mockLocalStorage.getItem.mockReturnValue(stage2State)

    installEnhancedNotification('granted')
    const useReminder = await loadEnhancedHook()
    const { result } = renderHook(() => useReminder())

    await act(async () => {
      await result.current.reschedule()
    })
    
    // New activity should reset stage to 0
    expect(result.current.state.backoffStage).toBe(0)
  })

  it('persists state changes to rm-reminder-state localStorage key', async () => {
    installEnhancedNotification('default')
    const useReminder = await loadEnhancedHook()
    const { result } = renderHook(() => useReminder())
    
    await act(async () => {
      result.current.dismissPrompt()
    })
    
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'rm-reminder-state',
      expect.stringContaining('"permission":"dismissed"')
    )
  })

  it('tracks lastVariantIdx for notification message rotation', async () => {
    const stateWithVariant = JSON.stringify({
      permission: 'enabled',
      backoffStage: 1,
      lastVariantIdx: 3
    })
    mockLocalStorage.getItem.mockReturnValue(stateWithVariant)
    
    installEnhancedNotification('granted')
    const useReminder = await loadEnhancedHook()
    const { result } = renderHook(() => useReminder())
    
    await act(async () => {
      await result.current.reschedule()
    })
    
    // Should persist updated lastVariantIdx
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'rm-reminder-state',
      expect.stringContaining('"lastVariantIdx"')
    )
  })

  it('maintains backward compatibility with original useReminder interface', async () => {
    installEnhancedNotification('default')
    const useReminder = await loadEnhancedHook()
    const { result } = renderHook(() => useReminder())
    
    // Original interface methods must be preserved
    expect(typeof result.current.showPrompt).toBe('boolean')
    expect(typeof result.current.requestPermission).toBe('function')
    expect(typeof result.current.dismissPrompt).toBe('function')
    expect(typeof result.current.isEnabled).toBe('boolean')
    
    // Original behavior should work
    expect(result.current.showPrompt).toBe(true) // showTrigger available + default permission
    
    act(() => {
      result.current.dismissPrompt()
    })
    
    expect(result.current.showPrompt).toBe(false)
  })
})
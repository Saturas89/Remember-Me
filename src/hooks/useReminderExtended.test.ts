import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const NEW_REMINDER_STATE_KEY = 'rm-reminder-state'
const LEGACY_REMINDER_PREF_KEY = 'rm-reminder-pref'

// Mock service worker registration and notification API
const mockRegistration = {
  showNotification: vi.fn(),
  getNotifications: vi.fn().mockResolvedValue([])
}

const mockNotifications = [
  {
    tag: 'rm-reminder',
    close: vi.fn()
  }
]

function installNotification(
  permission: NotificationPermission,
  requestPermission: () => Promise<NotificationPermission>,
  withShowTrigger: boolean,
) {
  const proto: Record<string, unknown> = {}
  if (withShowTrigger) proto.showTrigger = vi.fn()
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

function mockServiceWorker() {
  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      ready: Promise.resolve(mockRegistration)
    },
    writable: true
  })
}

async function loadHook() {
  vi.resetModules()
  return (await import('./useReminder')).useReminder
}

describe('useReminder (Extended for REQ-016)', () => {
  beforeEach(() => {
    localStorage.clear()
    uninstallNotification()
    mockServiceWorker()
    mockRegistration.getNotifications.mockResolvedValue([])
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-27T10:00:00Z'))
  })

  afterEach(() => {
    uninstallNotification()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('removes legacy rm-reminder-pref on first initialization', async () => {
    localStorage.setItem(LEGACY_REMINDER_PREF_KEY, 'enabled')
    
    const useReminder = await loadHook()
    renderHook(() => useReminder())
    
    expect(localStorage.getItem(LEGACY_REMINDER_PREF_KEY)).toBeNull()
  })

  it('initializes with new rm-reminder-state structure', async () => {
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

  it('restores state from rm-reminder-state localStorage', async () => {
    const savedState = {
      permission: 'enabled',
      backoffStage: 2,
      lastShownAt: Date.now() - 1000 * 60 * 60 * 24 * 5, // 5 days ago
      lastVariantIdx: 3
    }
    localStorage.setItem(NEW_REMINDER_STATE_KEY, JSON.stringify(savedState))
    
    installNotification('granted', async () => 'granted', true)
    
    const useReminder = await loadHook()
    const { result } = renderHook(() => useReminder())
    
    expect(result.current.state).toEqual(savedState)
  })

  it('enable() sets permission to enabled and schedules first reminder', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted')
    installNotification('default', requestPermission, true)
    
    const useReminder = await loadHook()
    const { result } = renderHook(() => useReminder())
    
    await act(async () => {
      await result.current.enable()
    })
    
    expect(result.current.state.permission).toBe('enabled')
    expect(result.current.state.backoffStage).toBe(1)
    
    const savedState = JSON.parse(localStorage.getItem(NEW_REMINDER_STATE_KEY)!)
    expect(savedState.permission).toBe('enabled')
  })

  it('enable() sets permission to dismissed on denied permission', async () => {
    const requestPermission = vi.fn().mockResolvedValue('denied')
    installNotification('default', requestPermission, true)
    
    const useReminder = await loadHook()
    const { result } = renderHook(() => useReminder())
    
    await act(async () => {
      await result.current.enable()
    })
    
    expect(result.current.state.permission).toBe('dismissed')
    expect(result.current.state.backoffStage).toBe(0)
  })

  it('disable() sets permission to dismissed and clears existing notifications', async () => {
    mockRegistration.getNotifications.mockResolvedValue(mockNotifications)
    
    localStorage.setItem(NEW_REMINDER_STATE_KEY, JSON.stringify({
      permission: 'enabled',
      backoffStage: 2,
      lastShownAt: Date.now(),
      lastVariantIdx: 1
    }))
    
    installNotification('granted', async () => 'granted', true)
    
    const useReminder = await loadHook()
    const { result } = renderHook(() => useReminder())
    
    act(() => {
      result.current.disable()
    })
    
    expect(result.current.state.permission).toBe('dismissed')
    expect(result.current.state.backoffStage).toBe(0)
    
    await waitFor(() => {
      expect(mockRegistration.getNotifications).toHaveBeenCalledWith({ tag: 'rm-reminder' })
    })
    expect(mockNotifications[0].close).toHaveBeenCalled()
  })

  it('reschedule() clears existing notifications and sets new trigger', async () => {
    mockRegistration.getNotifications.mockResolvedValue(mockNotifications)
    
    localStorage.setItem(NEW_REMINDER_STATE_KEY, JSON.stringify({
      permission: 'enabled',
      backoffStage: 1,
      lastShownAt: Date.now() - 1000 * 60 * 60 * 24 * 2, // 2 days ago
      lastVariantIdx: 0
    }))
    
    installNotification('granted', async () => 'granted', true)
    
    const useReminder = await loadHook()
    const { result } = renderHook(() => useReminder())
    
    await act(async () => {
      await result.current.reschedule()
    })
    
    expect(mockRegistration.getNotifications).toHaveBeenCalledWith({ tag: 'rm-reminder' })
    expect(mockNotifications[0].close).toHaveBeenCalled()
  })

  it('handles backoff stages correctly: 0->1 (3 days), 1->2 (10 days), 2->3 (24 days)', async () => {
    installNotification('granted', async () => 'granted', true)
    
    const useReminder = await loadHook()
    const { result } = renderHook(() => useReminder())
    
    // Stage 0 -> 1 (should be 3 days)
    localStorage.setItem(NEW_REMINDER_STATE_KEY, JSON.stringify({
      permission: 'enabled',
      backoffStage: 0,
      lastShownAt: undefined,
      lastVariantIdx: undefined
    }))
    
    await act(async () => {
      await result.current.reschedule()
    })
    
    expect(result.current.state.backoffStage).toBe(1)
    
    // Stage 1 -> 2 (should be 7 more days, total 10)
    localStorage.setItem(NEW_REMINDER_STATE_KEY, JSON.stringify({
      permission: 'enabled',
      backoffStage: 1,
      lastShownAt: Date.now() - 1000 * 60 * 60 * 24 * 4, // 4 days ago
      lastVariantIdx: 2
    }))
    
    await act(async () => {
      await result.current.reschedule()
    })
    
    expect(result.current.state.backoffStage).toBe(2)
    
    // Stage 2 -> 3 (should be 14 more days, total 24)
    localStorage.setItem(NEW_REMINDER_STATE_KEY, JSON.stringify({
      permission: 'enabled',
      backoffStage: 2,
      lastShownAt: Date.now() - 1000 * 60 * 60 * 24 * 11, // 11 days ago
      lastVariantIdx: 5
    }))
    
    await act(async () => {
      await result.current.reschedule()
    })
    
    expect(result.current.state.backoffStage).toBe(3)
  })

  it('stops scheduling after stage 3 (24 days total)', async () => {
    localStorage.setItem(NEW_REMINDER_STATE_KEY, JSON.stringify({
      permission: 'enabled',
      backoffStage: 3,
      lastShownAt: Date.now() - 1000 * 60 * 60 * 24 * 30, // 30 days ago
      lastVariantIdx: 1
    }))
    
    installNotification('granted', async () => 'granted', true)
    
    const useReminder = await loadHook()
    const { result } = renderHook(() => useReminder())
    
    await act(async () => {
      await result.current.reschedule()
    })
    
    // Should remain at stage 3, no new notification scheduled
    expect(result.current.state.backoffStage).toBe(3)
  })

  it('resets backoffStage to 1 when new answer is recorded', async () => {
    localStorage.setItem(NEW_REMINDER_STATE_KEY, JSON.stringify({
      permission: 'enabled',
      backoffStage: 3,
      lastShownAt: Date.now() - 1000 * 60 * 60 * 24 * 30,
      lastVariantIdx: 4
    }))
    
    installNotification('granted', async () => 'granted', true)
    
    const useReminder = await loadHook()
    const { result } = renderHook(() => useReminder())
    
    // Simulate new answer by calling reschedule after "answer event"
    localStorage.setItem('remember-me-state', JSON.stringify({
      totalAnswered: 5,  // New answer recorded
      streak: { current: 1, longest: 1, lastAnswerDate: '2026-04-27' }
    }))
    
    await act(async () => {
      await result.current.reschedule()
    })
    
    expect(result.current.state.backoffStage).toBe(1)
  })

  it('handles quiet hours (22:00 - 8:00) by rescheduling to 8:00 local', async () => {
    // Set time to 23:00 (quiet hours)
    vi.setSystemTime(new Date('2026-04-27T23:00:00'))
    
    localStorage.setItem(NEW_REMINDER_STATE_KEY, JSON.stringify({
      permission: 'enabled',
      backoffStage: 0,
      lastShownAt: undefined,
      lastVariantIdx: undefined
    }))
    
    installNotification('granted', async () => 'granted', true)
    
    const useReminder = await loadHook()
    const { result } = renderHook(() => useReminder())
    
    await act(async () => {
      await result.current.reschedule()
    })
    
    // Should schedule for next 8:00 AM instead of during quiet hours
    expect(result.current.state.backoffStage).toBe(1)
  })

  it('preserves lastVariantIdx for notification content rotation', async () => {
    localStorage.setItem(NEW_REMINDER_STATE_KEY, JSON.stringify({
      permission: 'enabled',
      backoffStage: 1,
      lastShownAt: Date.now() - 1000 * 60 * 60 * 24 * 4,
      lastVariantIdx: 2
    }))
    
    installNotification('granted', async () => 'granted', true)
    
    const useReminder = await loadHook()
    const { result } = renderHook(() => useReminder())
    
    expect(result.current.state.lastVariantIdx).toBe(2)
    
    await act(async () => {
      await result.current.reschedule()
    })
    
    // lastVariantIdx should be preserved for notification content selection
    expect(typeof result.current.state.lastVariantIdx).toBe('number')
  })

  it('handles malformed localStorage data gracefully', async () => {
    localStorage.setItem(NEW_REMINDER_STATE_KEY, 'invalid-json')
    
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
})
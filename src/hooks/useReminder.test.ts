import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const REMINDER_PREF_KEY = 'rm-reminder-pref'
const REMINDER_STATE_KEY = 'rm-reminder-state'

function readPermission(): string | null {
  const raw = localStorage.getItem(REMINDER_STATE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw).permission ?? null
  } catch {
    return null
  }
}

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
    localStorage.clear()
    uninstallNotification()
  })

  afterEach(() => {
    uninstallNotification()
    vi.restoreAllMocks()
  })

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

  it('restores "enabled" preference from rm-reminder-state', async () => {
    localStorage.setItem(REMINDER_STATE_KEY, JSON.stringify({ permission: 'enabled', backoffStage: 0 }))
    installNotification('granted', async () => 'granted', true)
    const useReminder = await loadHook()
    const { result } = renderHook(() => useReminder())
    expect(result.current.isEnabled).toBe(true)
    expect(result.current.showPrompt).toBe(false)
  })

  it('restores "dismissed" preference and hides the prompt', async () => {
    localStorage.setItem(REMINDER_STATE_KEY, JSON.stringify({ permission: 'dismissed', backoffStage: 0 }))
    installNotification('default', async () => 'granted', true)
    const useReminder = await loadHook()
    const { result } = renderHook(() => useReminder())
    expect(result.current.showPrompt).toBe(false)
    expect(result.current.isEnabled).toBe(false)
  })

  it('deletes the legacy rm-reminder-pref key on mount (FR-16.13)', async () => {
    localStorage.setItem(REMINDER_PREF_KEY, 'enabled')
    installNotification('default', async () => 'granted', true)
    const useReminder = await loadHook()
    renderHook(() => useReminder())
    expect(localStorage.getItem(REMINDER_PREF_KEY)).toBeNull()
  })

  it('dismissPrompt stores the "dismissed" preference', async () => {
    installNotification('default', async () => 'granted', true)
    const useReminder = await loadHook()
    const { result } = renderHook(() => useReminder())
    act(() => result.current.dismissPrompt())
    expect(readPermission()).toBe('dismissed')
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
    expect(readPermission()).toBe('enabled')
  })

  it('requestPermission switches to "dismissed" on denial', async () => {
    const req = vi.fn<() => Promise<NotificationPermission>>().mockResolvedValue('denied')
    installNotification('default', req, true)
    const useReminder = await loadHook()
    const { result } = renderHook(() => useReminder())
    await act(async () => { await result.current.requestPermission() })
    expect(readPermission()).toBe('dismissed')
    expect(result.current.isEnabled).toBe(false)
  })
})

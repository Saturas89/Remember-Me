import { useState, useEffect, useCallback } from 'react'
import { getNotificationContent } from '../utils/notificationContent'

const REMINDER_STATE_KEY = 'rm-reminder-state'
const REMINDER_TAG = 'rm-reminder'

// Backoff schedule (hours)
const BACKOFF_SCHEDULE = [72, 240, 576] // 3 days, 10 days, 24 days

export interface ReminderInternalState {
  permission: 'none' | 'enabled' | 'dismissed'
  backoffStage: 0 | 1 | 2 | 3
  lastShownAt?: number
  lastVariantIdx?: number
}

export interface UseReminderReturn {
  // Existing methods (unchanged for compatibility)
  showPrompt: boolean
  requestPermission: () => Promise<void>
  dismissPrompt: () => void
  isEnabled: boolean
  
  // New for REQ-016
  state: ReminderInternalState
  reschedule: () => Promise<void>
  disable: () => void
}

function getNextScheduleTime(hoursFromNow: number): number {
  const targetTime = Date.now() + (hoursFromNow * 60 * 60 * 1000)
  const targetDate = new Date(targetTime)
  
  // Check if target falls in quiet hours (22:00-8:00)
  const hour = targetDate.getHours()
  if (hour >= 22 || hour < 8) {
    // Shift to 8:00 local time
    const shifted = new Date(targetDate)
    shifted.setHours(8, 0, 0, 0)
    
    // If we're already past 8:00 today, move to 8:00 tomorrow
    if (shifted <= new Date()) {
      shifted.setDate(shifted.getDate() + 1)
    }
    
    return shifted.getTime()
  }
  
  return targetTime
}

export function useReminder(): UseReminderReturn {
  const [state, setState] = useState<ReminderInternalState>(() => {
    // Clean up old key on first init
    if (typeof window !== 'undefined') {
      localStorage.removeItem('rm-reminder-pref')
    }
    
    try {
      const stored = localStorage.getItem(REMINDER_STATE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as ReminderInternalState
        return {
          permission: parsed.permission || 'none',
          backoffStage: parsed.backoffStage || 0,
          lastShownAt: parsed.lastShownAt,
          lastVariantIdx: parsed.lastVariantIdx
        }
      }
    } catch {
      // ignore corrupt data
    }
    
    return {
      permission: 'none',
      backoffStage: 0
    }
  })

  const saveState = useCallback((newState: ReminderInternalState) => {
    setState(newState)
    localStorage.setItem(REMINDER_STATE_KEY, JSON.stringify(newState))
  }, [])

  // We only show prompt if permission is 'none' and showTrigger is supported
  const canPrompt = typeof window !== 'undefined' && 
                   'Notification' in window && 
                   'showTrigger' in Notification.prototype && 
                   state.permission === 'none'

  const scheduleNextNotification = useCallback(async (nextStage?: number) => {
    if (typeof window === 'undefined' || 
        !('serviceWorker' in navigator) || 
        !('Notification' in window) ||
        state.permission !== 'enabled') return

    if (Notification.permission !== 'granted') return

    try {
      const registration = await navigator.serviceWorker.ready

      // Cancel existing reminders
      const notifications = await registration.getNotifications({ tag: REMINDER_TAG })
      notifications.forEach(n => n.close())

      const stage = nextStage ?? state.backoffStage
      
      // Stage 3+ means we're in silent mode
      if (stage >= 3) return

      // Check if showTrigger is supported (fallback for unsupported browsers)
      if (!('showTrigger' in Notification.prototype)) return

      const hoursDelay = BACKOFF_SCHEDULE[stage] || BACKOFF_SCHEDULE[0]
      const scheduleTime = getNextScheduleTime(hoursDelay)
      
      // @ts-expect-error - TimestampTrigger is experimental
      const trigger = new window.TimestampTrigger(scheduleTime)
      
      // Get notification content
      const locale = (navigator.language || 'de').startsWith('de') ? 'de' : 'en'
      const content = getNotificationContent({
        locale,
        lastVariantIdx: state.lastVariantIdx
      })

      await registration.showNotification(content.title, {
        body: content.body,
        icon: '/pwa-192x192.png',
        tag: REMINDER_TAG,
        // @ts-expect-error - showTrigger is experimental
        showTrigger: trigger,
        data: { url: '/' }
      })

      // Update state with new variant index and schedule time
      saveState({
        ...state,
        backoffStage: stage as 0 | 1 | 2 | 3,
        lastShownAt: Date.now(),
        lastVariantIdx: content.variantIdx
      })
      
    } catch (e) {
      console.error('Error scheduling notification:', e)
    }
  }, [state, saveState])

  // Badge API support
  const updateBadge = useCallback(async () => {
    if (typeof window === 'undefined' || !('navigator' in window) || !navigator.setAppBadge) return
    
    // This would need integration with question data to count open questions
    // For now, just clear on app focus
    try {
      if (document.visibilityState === 'visible') {
        navigator.clearAppBadge?.()
      }
    } catch (e) {
      // Silently ignore badge API errors
    }
  }, [])

  // Listen for visibility changes to reschedule
  useEffect(() => {
    if (state.permission !== 'enabled') return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateBadge()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [state.permission, updateBadge])

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return

    try {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        const newState: ReminderInternalState = {
          ...state,
          permission: 'enabled',
          backoffStage: 0
        }
        saveState(newState)
        // Schedule first notification immediately after permission granted
        scheduleNextNotification(0)
      } else {
        saveState({ ...state, permission: 'dismissed' })
      }
    } catch (e) {
      console.error('Error requesting notification permission', e)
    }
  }, [state, saveState, scheduleNextNotification])

  const dismissPrompt = useCallback(() => {
    saveState({ ...state, permission: 'dismissed' })
  }, [state, saveState])

  const reschedule = useCallback(async () => {
    if (state.permission === 'enabled') {
      // Reset to stage 0 and reschedule
      await scheduleNextNotification(0)
    }
  }, [state.permission, scheduleNextNotification])

  const disable = useCallback(() => {
    saveState({ 
      permission: 'none',
      backoffStage: 0,
      lastShownAt: undefined,
      lastVariantIdx: undefined
    })
    
    // Clear any scheduled notifications
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.getNotifications({ tag: REMINDER_TAG }).then(notifications => {
          notifications.forEach(n => n.close())
        })
      }).catch(() => {
        // ignore errors
      })
    }
  }, [saveState])

  return {
    showPrompt: canPrompt,
    requestPermission,
    dismissPrompt,
    isEnabled: state.permission === 'enabled',
    state,
    reschedule,
    disable
  }
}

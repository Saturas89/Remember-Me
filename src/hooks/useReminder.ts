import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from '../locales'
import { 
  generateNotificationContent, 
  calculateNextReminderTime, 
  adjustForSilentHours,
  type ReminderState 
} from '../utils/notificationContent'
import type { Answer } from '../types'

const NEW_REMINDER_KEY = 'rm-reminder-state'
const LEGACY_REMINDER_KEY = 'rm-reminder-pref'
const REMINDER_TAG = 'rm-reminder'

export function useReminder(
  answers: Record<string, Answer>,
  profileName: string
) {
  const { locale } = useTranslation()
  
  const [reminderState, setReminderState] = useState<ReminderState>(() => {
    // Clean up legacy key on first load (FR-16.13)
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LEGACY_REMINDER_KEY)
    }
    
    try {
      const stored = localStorage.getItem(NEW_REMINDER_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as ReminderState
        return {
          permission: parsed.permission || 'none',
          backoffStage: parsed.backoffStage || 0,
          lastShownAt: parsed.lastShownAt,
          lastVariantIdx: parsed.lastVariantIdx
        }
      }
    } catch {
      // Ignore parsing errors
    }
    
    return {
      permission: 'none',
      backoffStage: 0
    }
  })

  // Save state to localStorage
  const saveReminderState = useCallback((state: ReminderState) => {
    setReminderState(state)
    try {
      localStorage.setItem(NEW_REMINDER_KEY, JSON.stringify(state))
    } catch (e) {
      console.error('Failed to save reminder state:', e)
    }
  }, [])

  // Check if OS notifications are supported
  const hasNotificationSupport = typeof window !== 'undefined' && 
    'Notification' in window && 
    'showTrigger' in Notification.prototype

  // Check if we should show the permission prompt
  const canPrompt = hasNotificationSupport && 
    reminderState.permission === 'none' && 
    typeof window !== 'undefined' &&
    Notification.permission !== 'denied'

  // Check current notification permission status
  const getPermissionStatus = useCallback(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported'
    }
    return Notification.permission
  }, [])

  // Cancel existing notifications
  const cancelExistingNotifications = useCallback(async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    
    try {
      const registration = await navigator.serviceWorker.ready
      const notifications = await registration.getNotifications({ tag: REMINDER_TAG })
      notifications.forEach(n => n.close())
    } catch (e) {
      console.error('Error canceling notifications:', e)
    }
  }, [])

  // Schedule next reminder notification
  const scheduleNotification = useCallback(async () => {
    if (typeof window === 'undefined' || !hasNotificationSupport) return
    if (Notification.permission !== 'granted' || reminderState.permission !== 'enabled') return
    if (reminderState.backoffStage >= 3) return // No more reminders after stage 3

    try {
      await cancelExistingNotifications()

      const nextStage = Math.min(reminderState.backoffStage + 1, 3) as 0 | 1 | 2 | 3
      const rawTimestamp = calculateNextReminderTime(nextStage)
      const adjustedTimestamp = adjustForSilentHours(rawTimestamp)

      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready
        
        // Generate notification content
        const content = generateNotificationContent(
          locale,
          answers,
          profileName,
          reminderState.lastVariantIdx
        )

        // @ts-expect-error - TimestampTrigger is experimental
        const trigger = new window.TimestampTrigger(adjustedTimestamp)

        await registration.showNotification(content.title, {
          body: content.body,
          icon: '/pwa-192x192.png',
          tag: REMINDER_TAG,
          // @ts-expect-error - showTrigger is experimental
          showTrigger: trigger,
          data: { 
            url: content.questionId ? `/question/${content.questionId}` : '/',
            questionId: content.questionId
          }
        })

        // Update state with new backoff stage and variant index
        saveReminderState({
          ...reminderState,
          backoffStage: nextStage,
          lastShownAt: adjustedTimestamp,
          lastVariantIdx: content.questionId ? reminderState.lastVariantIdx : 
            ((reminderState.lastVariantIdx ?? -1) + 1) % 10 // Assume max 10 variants
        })
      }
    } catch (e) {
      console.error('Error scheduling notification:', e)
    }
  }, [hasNotificationSupport, reminderState, cancelExistingNotifications, locale, answers, profileName, saveReminderState])

  // Reset backoff stage when user answers or opens app
  const resetBackoffStage = useCallback(() => {
    if (reminderState.backoffStage > 0) {
      saveReminderState({
        ...reminderState,
        backoffStage: 0
      })
    }
  }, [reminderState, saveReminderState])

  // Handle app visibility change
  useEffect(() => {
    if (reminderState.permission !== 'enabled') return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        resetBackoffStage()
        scheduleNotification()
        
        // Clear app badge when app opens
        if ('clearAppBadge' in navigator) {
          navigator.clearAppBadge().catch(() => {
            // Ignore errors - not all browsers support this
          })
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [reminderState.permission, resetBackoffStage, scheduleNotification])

  // Set app badge when there are unanswered questions
  useEffect(() => {
    if (typeof window === 'undefined' || !('setAppBadge' in navigator)) return
    if (reminderState.permission !== 'enabled') return

    // Count unanswered questions
    const unansweredCount = Object.keys(answers).filter(questionId => {
      const answer = answers[questionId]
      return !answer || (!answer.value.trim() && !(answer.imageIds?.length))
    }).length

    if (unansweredCount > 0) {
      navigator.setAppBadge(unansweredCount).catch(() => {
        // Ignore errors - not all browsers support this
      })
    }
  }, [answers, reminderState.permission])

  // Schedule notification when enabled
  useEffect(() => {
    if (reminderState.permission === 'enabled') {
      scheduleNotification()
    } else {
      cancelExistingNotifications()
    }
  }, [reminderState.permission, scheduleNotification, cancelExistingNotifications])

  // Request notification permission
  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return false

    try {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        saveReminderState({
          ...reminderState,
          permission: 'enabled'
        })
        return true
      } else {
        saveReminderState({
          ...reminderState,
          permission: 'dismissed'
        })
        return false
      }
    } catch (e) {
      console.error('Error requesting notification permission', e)
      return false
    }
  }, [reminderState, saveReminderState])

  // Dismiss permission prompt
  const dismissPrompt = useCallback(() => {
    saveReminderState({
      ...reminderState,
      permission: 'dismissed'
    })
  }, [reminderState, saveReminderState])

  // Toggle reminder on/off
  const toggleReminder = useCallback(async (enabled: boolean) => {
    if (enabled && Notification.permission !== 'granted') {
      return await requestPermission()
    } else {
      saveReminderState({
        ...reminderState,
        permission: enabled ? 'enabled' : 'dismissed'
      })
      return enabled
    }
  }, [reminderState, requestPermission, saveReminderState])

  return {
    showPrompt: canPrompt,
    isEnabled: reminderState.permission === 'enabled',
    permissionStatus: getPermissionStatus(),
    hasNotificationSupport,
    backoffStage: reminderState.backoffStage,
    requestPermission,
    dismissPrompt,
    toggleReminder,
    resetBackoffStage
  }
}

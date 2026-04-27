import { useState, useEffect, useCallback } from 'react'
import { getNotificationContent } from '../utils/notificationContent'
import { getCategoriesForLocale } from '../data/categories'

const REMINDER_STATE_KEY = 'rm-reminder-state'
const REMINDER_LEGACY_KEY = 'rm-reminder-pref'
const REMINDER_TAG = 'rm-reminder'

// Backoff delays in milliseconds
const STAGE_DELAYS = {
  1: 3 * 24 * 60 * 60 * 1000,   // 3 days
  2: 7 * 24 * 60 * 60 * 1000,   // 7 more days (10 total)
  3: 14 * 24 * 60 * 60 * 1000,  // 14 more days (24 total)
}

export interface ReminderState {
  permission: 'none' | 'enabled' | 'dismissed'
  backoffStage: 0 | 1 | 2 | 3
  lastShownAt?: number
  lastVariantIdx?: number
}

export interface UseReminderReturn {
  state: ReminderState
  enable: () => Promise<void>
  disable: () => void
  reschedule: () => Promise<void>
}

function loadReminderState(): ReminderState {
  try {
    const raw = localStorage.getItem(REMINDER_STATE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ReminderState>
      return {
        permission: parsed.permission ?? 'none',
        backoffStage: parsed.backoffStage ?? 0,
        lastShownAt: parsed.lastShownAt,
        lastVariantIdx: parsed.lastVariantIdx,
      }
    }
  } catch {
    // ignore corrupt data
  }
  return { permission: 'none', backoffStage: 0 }
}

function saveReminderState(state: ReminderState): void {
  try {
    localStorage.setItem(REMINDER_STATE_KEY, JSON.stringify(state))
  } catch (err) {
    console.error('remember-me: failed to persist reminder state', err)
  }
}

function getNextUnuseredQuestion(): { questionId: string; questionTitle: string } | null {
  try {
    // Get current answers
    const appStateRaw = localStorage.getItem('remember-me-state')
    const answers = appStateRaw ? JSON.parse(appStateRaw).answers || {} : {}
    
    // Get current locale (assuming German as default)
    const locale: 'de' | 'en' = 'de' // TODO: could be extracted from app state or browser
    const categories = getCategoriesForLocale(locale)
    
    // Find first unanswered question
    for (const category of categories) {
      for (const question of category.questions) {
        const answer = answers[question.id]
        const hasAnswer = answer && (
          answer.value?.trim() ||
          answer.imageIds?.length > 0 ||
          answer.videoIds?.length > 0 ||
          answer.audioId ||
          answer.audioTranscript?.trim()
        )
        
        if (!hasAnswer) {
          return {
            questionId: question.id,
            questionTitle: question.text
          }
        }
      }
    }
    
    return null
  } catch {
    return null
  }
}

function isInQuietHours(): boolean {
  const now = new Date()
  const hour = now.getHours()
  return hour >= 22 || hour < 8
}

function getNextTriggerTime(stage: 1 | 2 | 3): number {
  let triggerTime = Date.now() + STAGE_DELAYS[stage]
  
  // Check if trigger falls in quiet hours (22:00 - 08:00 local time)
  const triggerDate = new Date(triggerTime)
  const hour = triggerDate.getHours()
  
  if (hour >= 22 || hour < 8) {
    // Move to 8:00 AM same day if after midnight, or next day if before midnight
    const targetDate = new Date(triggerDate)
    if (hour >= 22) {
      targetDate.setDate(targetDate.getDate() + 1)
    }
    targetDate.setHours(8, 0, 0, 0)
    triggerTime = targetDate.getTime()
  }
  
  return triggerTime
}

export function useReminder(): UseReminderReturn {
  const [state, setState] = useState<ReminderState>(() => loadReminderState())

  // Clean up legacy key on mount (once per browser lifetime)
  useEffect(() => {
    localStorage.removeItem(REMINDER_LEGACY_KEY)
  }, [])

  const scheduleNotification = useCallback(async (nextStage?: 1 | 2 | 3) => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return
    if (state.permission !== 'enabled') return

    try {
      const registration = await navigator.serviceWorker.ready

      // Cancel existing reminders
      const notifications = await registration.getNotifications({ tag: REMINDER_TAG })
      notifications.forEach(n => n.close())

      // Don't schedule if we're at max stage
      const stage = nextStage ?? (state.backoffStage + 1)
      if (stage > 3) return

      // Check if showTrigger is supported (Chromium only)
      if ('showTrigger' in Notification.prototype) {
        const triggerTime = getNextTriggerTime(stage as 1 | 2 | 3)
        const nextQuestion = getNextUnusuredQuestion()
        
        // Get notification content
        const content = getNotificationContent({
          locale: 'de', // TODO: use actual locale
          questionTitle: nextQuestion?.questionTitle,
          lastVariantIdx: state.lastVariantIdx
        })

        // @ts-expect-error - TimestampTrigger is experimental
        const trigger = new window.TimestampTrigger(triggerTime)

        await registration.showNotification(content.title, {
          body: content.body,
          icon: '/pwa-192x192.png',
          tag: REMINDER_TAG,
          // @ts-expect-error - showTrigger is experimental
          showTrigger: trigger,
          data: { 
            url: nextQuestion ? `/quiz/${nextQuestion.questionId.split('-')[0]}` : '/',
            questionId: nextQuestion?.questionId
          }
        })

        // Update state
        const updated: ReminderState = {
          ...state,
          backoffStage: stage as 0 | 1 | 2 | 3,
          lastShownAt: Date.now(),
          lastVariantIdx: content.variantIdx
        }
        setState(updated)
        saveReminderState(updated)
      }
    } catch (e) {
      console.error('Error scheduling notification:', e)
    }
  }, [state])

  const reschedule = useCallback(async () => {
    // Reset to stage 1 when user becomes active again
    const updated: ReminderState = {
      ...state,
      backoffStage: 0, // Will become 1 in scheduleNotification
      lastShownAt: undefined
    }
    setState(updated)
    saveReminderState(updated)
    
    if (state.permission === 'enabled') {
      await scheduleNotification(1)
    }
  }, [state, scheduleNotification])

  const enable = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return

    try {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        const updated: ReminderState = {
          ...state,
          permission: 'enabled',
          backoffStage: 0
        }
        setState(updated)
        saveReminderState(updated)
        
        // Schedule first notification
        await scheduleNotification(1)
        
        // Set up badge if supported
        if ('setAppBadge' in navigator) {
          const nextQuestion = getNextUnuseredQuestion()
          if (nextQuestion) {
            try {
              // Count total unanswered questions
              const appStateRaw = localStorage.getItem('remember-me-state')
              const answers = appStateRaw ? JSON.parse(appStateRaw).answers || {} : {}
              const categories = getCategoriesForLocale('de')
              
              let unansweredCount = 0
              for (const category of categories) {
                for (const question of category.questions) {
                  const answer = answers[question.id]
                  const hasAnswer = answer && (
                    answer.value?.trim() ||
                    answer.imageIds?.length > 0 ||
                    answer.videoIds?.length > 0 ||
                    answer.audioId ||
                    answer.audioTranscript?.trim()
                  )
                  if (!hasAnswer) unansweredCount++
                }
              }
              
              if (unansweredCount > 0) {
                await navigator.setAppBadge(unansweredCount)
              }
            } catch {
              // Badge API not supported, ignore silently
            }
          }
        }
      } else {
        const updated: ReminderState = {
          ...state,
          permission: 'dismissed'
        }
        setState(updated)
        saveReminderState(updated)
      }
    } catch (e) {
      console.error('Error requesting notification permission', e)
    }
  }, [state, scheduleNotification])

  const disable = useCallback(() => {
    const updated: ReminderState = {
      ...state,
      permission: 'dismissed'
    }
    setState(updated)
    saveReminderState(updated)

    // Cancel existing notifications
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.getNotifications({ tag: REMINDER_TAG }).then(notifications => {
          notifications.forEach(n => n.close())
        })
      })
    }

    // Clear app badge
    if ('clearAppBadge' in navigator) {
      navigator.clearAppBadge().catch(() => {
        // Ignore errors
      })
    }
  }, [state])

  // Set up visibility change listener to reschedule when app is opened
  useEffect(() => {
    if (state.permission !== 'enabled') return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        reschedule()
        
        // Clear app badge when opening app
        if ('clearAppBadge' in navigator) {
          navigator.clearAppBadge().catch(() => {
            // Ignore errors
          })
        }
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [state.permission, reschedule])

  return {
    state,
    enable,
    disable,
    reschedule
  }
}

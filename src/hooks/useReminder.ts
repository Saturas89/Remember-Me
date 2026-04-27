import { useState, useEffect, useCallback } from 'react'
import { getNotificationContent } from '../utils/notificationContent'
import { useTranslation } from '../locales'

const REMINDER_STATE_KEY = 'rm-reminder-state'
const REMINDER_TAG = 'rm-reminder'

// Backoff stages: 3 days, 10 days, 24 days
const BACKOFF_DELAYS = [
  3 * 24 * 60 * 60 * 1000,  // Stage 1: 3 days
  7 * 24 * 60 * 60 * 1000,  // Stage 2: +7 days (total 10)
  14 * 24 * 60 * 60 * 1000, // Stage 3: +14 days (total 24)
]

export interface ReminderInternalState {
  permission: 'none' | 'enabled' | 'dismissed'
  backoffStage: 0 | 1 | 2 | 3
  lastShownAt?: number
  lastVariantIdx?: number
}

type LegacyReminderState = 'none' | 'prompting' | 'enabled' | 'dismissed'

function loadReminderState(): ReminderInternalState {
  try {
    const raw = localStorage.getItem(REMINDER_STATE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as ReminderInternalState
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
}

function saveReminderState(state: ReminderInternalState): void {
  try {
    localStorage.setItem(REMINDER_STATE_KEY, JSON.stringify(state))
  } catch (err) {
    console.error('remember-me: failed to persist reminder state', err)
  }
}

function isInQuietHours(): boolean {
  const now = new Date()
  const hours = now.getHours()
  return hours >= 22 || hours < 8
}

function adjustForQuietHours(timestamp: number): number {
  const date = new Date(timestamp)
  const hours = date.getHours()
  
  if (hours >= 22 || hours < 8) {
    // Move to 8:00 AM same day or next day
    const adjusted = new Date(date)
    if (hours >= 22) {
      // Late night, move to 8 AM next day
      adjusted.setDate(adjusted.getDate() + 1)
    }
    adjusted.setHours(8, 0, 0, 0)
    return adjusted.getTime()
  }
  
  return timestamp
}

async function getNextOpenQuestion(): Promise<{ id: string; title: string } | null> {
  try {
    // Try to get from localStorage
    const stateRaw = localStorage.getItem('remember-me-state')
    if (!stateRaw) return null
    
    const state = JSON.parse(stateRaw)
    const answers = state.answers || {}
    
    // Import categories dynamically to avoid circular dependencies
    const { getCategoriesForLocale } = await import('../data/categories')
    const categories = getCategoriesForLocale('de') // Default to German
    
    for (const category of categories) {
      for (const question of category.questions) {
        const answer = answers[question.id]
        if (!answer || (!answer.value?.trim() && !(answer.imageIds?.length > 0))) {
          return { id: question.id, title: question.text }
        }
      }
    }
  } catch (e) {
    console.error('Error getting next open question:', e)
  }
  return null
}

export interface UseReminderReturn {
  // === Bestehende Methoden (UNVERÄNDERT — werden von App.tsx/ReminderBanner.tsx genutzt) ===
  showPrompt: boolean
  requestPermission: () => Promise<void>
  dismissPrompt: () => void
  isEnabled: boolean

  // === Neu für REQ-016 ===
  state: ReminderInternalState
  reschedule: () => Promise<void>
  disable: () => void
}

export function useReminder(): UseReminderReturn {
  const { locale } = useTranslation()
  const [internalState, setInternalState] = useState<ReminderInternalState>(() => loadReminderState())
  
  // Clean up legacy storage on mount (exactly once per browser lifetime)
  useEffect(() => {
    const legacyKey = 'rm-reminder-pref'
    if (localStorage.getItem(legacyKey)) {
      localStorage.removeItem(legacyKey)
    }
  }, [])

  // We only show prompt if permission is 'none' and notification triggers are supported
  // (since we rely on showTrigger to schedule notifications in the future without a push server)
  const canPrompt = typeof window !== 'undefined' && 'Notification' in window && 'showTrigger' in Notification.prototype && internalState.permission === 'none'

  const scheduleNotification = useCallback(async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return
    if (internalState.permission !== 'enabled') return

    // Don't schedule if we're at stage 3+ (final stage reached)
    if (internalState.backoffStage >= 3) return

    try {
      const registration = await navigator.serviceWorker.ready

      // Cancel existing reminders first
      const notifications = await registration.getNotifications({ tag: REMINDER_TAG })
      notifications.forEach(n => n.close())

      // Check if showTrigger is supported
      if ('showTrigger' in Notification.prototype) {
        // Calculate delay based on current backoff stage
        const delay = BACKOFF_DELAYS[internalState.backoffStage] || BACKOFF_DELAYS[0]
        let triggerTime = Date.now() + delay
        
        // Adjust for quiet hours
        triggerTime = adjustForQuietHours(triggerTime)
        
        // Get next open question for personalized content
        const nextQuestion = await getNextOpenQuestion()
        const content = getNotificationContent({
          locale,
          questionTitle: nextQuestion?.title,
          lastVariantIdx: internalState.lastVariantIdx
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
            url: '/',
            questionId: nextQuestion?.id
          }
        })
        
        // Update state with new variant index
        const newState: ReminderInternalState = {
          ...internalState,
          lastVariantIdx: content.variantIdx,
          lastShownAt: Date.now()
        }
        setInternalState(newState)
        saveReminderState(newState)
      }
    } catch (e) {
      console.error('Error scheduling notification:', e)
    }
  }, [internalState, locale])

  // Reschedule notifications on app open/active
  useEffect(() => {
    if (internalState.permission === 'enabled') {
      scheduleNotification()
    }
  }, [internalState.permission, scheduleNotification])

  // Listen to visibility change to reschedule when user comes back
  useEffect(() => {
    if (internalState.permission !== 'enabled') return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleNotification()
        // Clear badge on app open
        if ('clearAppBadge' in navigator) {
          navigator.clearAppBadge?.()
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [internalState.permission, scheduleNotification])

  const requestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return

    try {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        const newState: ReminderInternalState = {
          ...internalState,
          permission: 'enabled',
          backoffStage: 0
        }
        setInternalState(newState)
        saveReminderState(newState)
      } else {
        const newState: ReminderInternalState = {
          ...internalState,
          permission: 'dismissed'
        }
        setInternalState(newState)
        saveReminderState(newState)
      }
    } catch (e) {
      console.error('Error requesting notification permission', e)
    }
  }

  const dismissPrompt = () => {
    const newState: ReminderInternalState = {
      ...internalState,
      permission: 'dismissed'
    }
    setInternalState(newState)
    saveReminderState(newState)
  }

  const reschedule = useCallback(async () => {
    // Reset backoff stage and reschedule
    const newState: ReminderInternalState = {
      ...internalState,
      backoffStage: 0
    }
    setInternalState(newState)
    saveReminderState(newState)
    
    if (newState.permission === 'enabled') {
      await scheduleNotification()
    }
  }, [internalState, scheduleNotification])

  const disable = useCallback(() => {
    const newState: ReminderInternalState = {
      ...internalState,
      permission: 'dismissed'
    }
    setInternalState(newState)
    saveReminderState(newState)
  }, [internalState])

  // Update badge API when there are open questions
  useEffect(() => {
    if (internalState.permission === 'enabled' && 'setAppBadge' in navigator) {
      getNextOpenQuestion().then(nextQuestion => {
        if (nextQuestion) {
          // Count total unanswered questions for badge
          try {
            const stateRaw = localStorage.getItem('remember-me-state')
            if (stateRaw) {
              const state = JSON.parse(stateRaw)
              const answers = state.answers || {}
              import('../data/categories').then(({ getCategoriesForLocale }) => {
                const categories = getCategoriesForLocale('de')
                let openCount = 0
                for (const category of categories) {
                  for (const question of category.questions) {
                    const answer = answers[question.id]
                    if (!answer || (!answer.value?.trim() && !(answer.imageIds?.length > 0))) {
                      openCount++
                    }
                  }
                }
                if (openCount > 0) {
                  navigator.setAppBadge?.(openCount)
                }
              })
            }
          } catch (e) {
            console.error('Error setting app badge:', e)
          }
        }
      })
    }
  }, [internalState.permission])

  return {
    // === Bestehende Methoden (UNVERÄNDERT) ===
    showPrompt: canPrompt,
    requestPermission,
    dismissPrompt,
    isEnabled: internalState.permission === 'enabled',

    // === Neu für REQ-016 ===
    state: internalState,
    reschedule,
    disable
  }
}

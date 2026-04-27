import { useState, useEffect, useCallback } from 'react'
import { getCategoriesForLocale } from '../data/categories'
import { getNotificationContent } from '../utils/notificationContent'
import type { Locale } from '../locales/types'

const REMINDER_STATE_KEY = 'rm-reminder-state'
const REMINDER_TAG = 'rm-reminder'

export interface ReminderState {
  permission: 'none' | 'enabled' | 'dismissed'
  backoffStage: 0 | 1 | 2 | 3
  lastShownAt?: number
  lastVariantIdx?: number
}

export interface UseReminderReturn {
  state: ReminderState
  enable: () => Promise<void>     // Permission-Prompt + scheduling
  disable: () => void
  reschedule: () => Promise<void> // bei visibilitychange/answer
}

// Backoff delays in milliseconds
const BACKOFF_DELAYS = [
  3 * 24 * 60 * 60 * 1000,  // Stage 1: 3 days
  7 * 24 * 60 * 60 * 1000,  // Stage 2: +7 days (total 10)
  14 * 24 * 60 * 60 * 1000, // Stage 3: +14 days (total 24)
]

function getNextUnansweredQuestion(answers: Record<string, any>, locale: Locale) {
  const categories = getCategoriesForLocale(locale)
  
  for (const category of categories) {
    for (const question of category.questions) {
      if (!answers[question.id]) {
        return { id: question.id, title: question.text }
      }
    }
  }
  
  return null
}

function isInQuietHours(): boolean {
  const now = new Date()
  const hour = now.getHours()
  return hour >= 22 || hour < 8
}

function adjustForQuietHours(timestamp: number): number {
  const date = new Date(timestamp)
  const hour = date.getHours()
  
  if (hour >= 22 || hour < 8) {
    // Move to 8:00 AM same day (if before 8 AM) or next day (if after 10 PM)
    const adjustedDate = new Date(date)
    if (hour >= 22) {
      adjustedDate.setDate(adjustedDate.getDate() + 1)
    }
    adjustedDate.setHours(8, 0, 0, 0)
    return adjustedDate.getTime()
  }
  
  return timestamp
}

export function useReminder(): UseReminderReturn {
  const [state, setState] = useState<ReminderState>(() => {
    // Remove old reminder preference on first load
    if (typeof window !== 'undefined') {
      localStorage.removeItem('rm-reminder-pref')
    }
    
    try {
      const stored = localStorage.getItem(REMINDER_STATE_KEY)
      if (stored) {
        return JSON.parse(stored) as ReminderState
      }
    } catch {
      // ignore corrupt data
    }
    
    return {
      permission: 'none',
      backoffStage: 0,
    }
  })

  // Save state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(REMINDER_STATE_KEY, JSON.stringify(state))
    } catch (e) {
      console.error('Failed to save reminder state:', e)
    }
  }, [state])

  // Schedule notification based on backoff stage
  const scheduleNotification = useCallback(async (answers: Record<string, any> = {}, locale: Locale = 'de') => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return
    if (state.permission !== 'enabled') return
    if (state.backoffStage >= 3) return // Silent after stage 3

    try {
      const registration = await navigator.serviceWorker.ready

      // Cancel existing reminders first
      const notifications = await registration.getNotifications({ tag: REMINDER_TAG })
      notifications.forEach(n => n.close())

      // Check if showTrigger is supported
      if ('showTrigger' in Notification.prototype) {
        const delay = BACKOFF_DELAYS[state.backoffStage] || BACKOFF_DELAYS[0]
        let targetTime = Date.now() + delay
        
        // Adjust for quiet hours
        targetTime = adjustForQuietHours(targetTime)

        // Get next unanswered question if available
        const nextQuestion = getNextUnansweredQuestion(answers, locale)
        
        // Generate notification content
        const content = getNotificationContent({
          locale,
          questionTitle: nextQuestion?.title,
          lastVariantIdx: state.lastVariantIdx,
        })

        // Update variant index
        setState(prev => ({
          ...prev,
          lastVariantIdx: content.variantIdx
        }))

        // @ts-expect-error - TimestampTrigger is experimental
        const trigger = new window.TimestampTrigger(targetTime)

        await registration.showNotification(content.title, {
          body: content.body,
          icon: '/pwa-192x192.png',
          tag: REMINDER_TAG,
          // @ts-expect-error - showTrigger is experimental
          showTrigger: trigger,
          data: { 
            url: nextQuestion ? `/quiz/${nextQuestion.id.split('-')[0]}` : '/',
            questionId: nextQuestion?.id
          }
        })

        // Update state with scheduling info
        setState(prev => ({
          ...prev,
          lastShownAt: targetTime,
        }))
      }
    } catch (e) {
      console.error('Error scheduling notification:', e)
    }
  }, [state])

  // Update app badge with open questions count
  const updateBadge = useCallback(async (answers: Record<string, any> = {}, locale: Locale = 'de') => {
    if (typeof window === 'undefined' || !('navigator' in window)) return
    if (state.permission !== 'enabled') return

    try {
      const categories = getCategoriesForLocale(locale)
      let openQuestions = 0
      
      for (const category of categories) {
        for (const question of category.questions) {
          if (!answers[question.id]) {
            openQuestions++
          }
        }
      }

      if ('setAppBadge' in navigator) {
        if (openQuestions > 0) {
          // @ts-expect-error - setAppBadge is experimental
          await navigator.setAppBadge(openQuestions)
        } else {
          // @ts-expect-error - clearAppBadge is experimental
          await navigator.clearAppBadge()
        }
      }
    } catch (e) {
      // Silent fail - badge API not supported
    }
  }, [state.permission])

  // Clear badge when app becomes visible
  useEffect(() => {
    if (state.permission !== 'enabled') return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        try {
          if ('clearAppBadge' in navigator) {
            // @ts-expect-error - clearAppBadge is experimental
            navigator.clearAppBadge()
          }
        } catch {
          // Silent fail
        }
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [state.permission])

  const enable = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return

    try {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        setState(prev => ({
          ...prev,
          permission: 'enabled',
          backoffStage: 0,
        }))
      } else {
        setState(prev => ({
          ...prev,
          permission: 'dismissed'
        }))
      }
    } catch (e) {
      console.error('Error requesting notification permission', e)
    }
  }, [])

  const disable = useCallback(() => {
    setState(prev => ({
      ...prev,
      permission: 'dismissed'
    }))
    
    // Cancel any existing notifications
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.getNotifications({ tag: REMINDER_TAG }).then(notifications => {
          notifications.forEach(n => n.close())
        })
      }).catch(() => {
        // Silent fail
      })
    }
  }, [])

  const reschedule = useCallback(async (answers: Record<string, any> = {}, locale: Locale = 'de') => {
    if (state.permission === 'enabled') {
      // Reset to stage 1 on new activity
      setState(prev => ({
        ...prev,
        backoffStage: 0,
      }))
      
      await scheduleNotification(answers, locale)
      await updateBadge(answers, locale)
    }
  }, [state.permission, scheduleNotification, updateBadge])

  return {
    state,
    enable,
    disable,
    reschedule
  }
}

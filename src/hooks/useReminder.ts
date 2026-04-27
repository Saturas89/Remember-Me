import { useState, useEffect, useCallback } from 'react'

const REMINDER_PREF_KEY = 'rm-reminder-pref'
const REMINDER_TAG = 'rm-reminder'
// 2 days in milliseconds
const REMINDER_DELAY = 2 * 24 * 60 * 60 * 1000

type ReminderState = 'none' | 'prompting' | 'enabled' | 'dismissed'

export function useReminder() {
  const [state, setState] = useState<ReminderState>(() => {
    return (localStorage.getItem(REMINDER_PREF_KEY) as ReminderState) || 'none'
  })

  // We only show prompt if preference is 'none' and notification triggers are supported
  // (since we rely on showTrigger to schedule notifications in the future without a push server)
  const canPrompt = typeof window !== 'undefined' && 'Notification' in window && 'showTrigger' in Notification.prototype && state === 'none'

  // Schedule or reschedule the notification
  const scheduleNotification = useCallback(async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return

    try {
      const registration = await navigator.serviceWorker.ready

      // Cancel existing reminder first
      const notifications = await registration.getNotifications({ tag: REMINDER_TAG })
      notifications.forEach(n => n.close())

      // Check if showTrigger is supported
      if ('showTrigger' in Notification.prototype) {
        // @ts-expect-error - TimestampTrigger is experimental
        const trigger = new window.TimestampTrigger(Date.now() + REMINDER_DELAY)

        await registration.showNotification('Zeit für Erinnerungen!', {
          body: 'Wir haben dich seit 2 Tagen nicht gesehen. Schreibe weiter an deinem Vermächtnis!',
          icon: '/pwa-192x192.png',
          tag: REMINDER_TAG,
          // @ts-expect-error - showTrigger is experimental
          showTrigger: trigger,
          data: { url: '/' }
        })
      }
    } catch (e) {
      console.error('Error scheduling notification:', e)
    }
  }, [])

  // Every time app is opened/active, we push the notification 2 days into the future
  useEffect(() => {
    if (state === 'enabled') {
      scheduleNotification()
    }
  }, [state, scheduleNotification])

  // Optionally listen to visibility change to reschedule when user comes back
  useEffect(() => {
    if (state !== 'enabled') return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleNotification()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [state, scheduleNotification])

  const requestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return

    try {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        setState('enabled')
        localStorage.setItem(REMINDER_PREF_KEY, 'enabled')
      } else {
        setState('dismissed')
        localStorage.setItem(REMINDER_PREF_KEY, 'dismissed')
      }
    } catch (e) {
      console.error('Error requesting notification permission', e)
    }
  }

  const dismissPrompt = () => {
    setState('dismissed')
    localStorage.setItem(REMINDER_PREF_KEY, 'dismissed')
  }

  return {
    showPrompt: canPrompt,
    requestPermission,
    dismissPrompt,
    isEnabled: state === 'enabled'
  }
}

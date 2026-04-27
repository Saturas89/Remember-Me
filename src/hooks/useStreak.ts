import { useCallback, useEffect } from 'react'
import { useTranslation } from '../locales'
import type { AppState } from '../types'

export interface StreakData {
  current: number
  longest: number
  lastAnswerDate: string
}

const MILESTONE_THRESHOLDS = [10, 25, 50, 100]

export function useStreak(
  state: AppState,
  onStateChange: (state: AppState) => void
) {
  const { t, locale } = useTranslation()

  // Calculate total answered questions
  const getTotalAnswered = useCallback(() => {
    return Object.values(state.answers).filter(
      a => a.value.trim() || (a.imageIds?.length ?? 0) > 0
    ).length
  }, [state.answers])

  // Update streak data when a new answer is added
  const updateStreak = useCallback((answeredAt: string = new Date().toISOString()) => {
    const totalAnswered = getTotalAnswered()
    const today = answeredAt.split('T')[0] // Get YYYY-MM-DD format
    
    const currentStreak = state.streak || { current: 0, longest: 0, lastAnswerDate: '' }
    const lastDate = currentStreak.lastAnswerDate.split('T')[0]
    
    let newCurrent = currentStreak.current
    let newLongest = currentStreak.longest

    if (lastDate !== today) {
      // Different day - increment current streak
      newCurrent = currentStreak.current + 1
      newLongest = Math.max(newLongest, newCurrent)
    }
    // Same day - no streak change, just update last answer date

    const newStreak: StreakData = {
      current: newCurrent,
      longest: newLongest,
      lastAnswerDate: answeredAt
    }

    // Check for milestone achievement
    const previousTotal = totalAnswered - 1
    const milestone = MILESTONE_THRESHOLDS.find(
      threshold => previousTotal < threshold && totalAnswered >= threshold
    )

    if (milestone) {
      triggerMilestoneNotification(milestone)
    }

    // Update state
    onStateChange({
      ...state,
      streak: newStreak
    })
  }, [state, onStateChange, getTotalAnswered, t, locale])

  // Reset streak on app opening if gap is too long
  const checkStreakReset = useCallback(() => {
    if (!state.streak) return

    const lastDate = new Date(state.streak.lastAnswerDate)
    const now = new Date()
    const daysDiff = Math.floor((now.getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000))

    // Reset streak if more than 1 day gap
    if (daysDiff > 1 && state.streak.current > 0) {
      onStateChange({
        ...state,
        streak: {
          ...state.streak,
          current: 0
        }
      })
    }
  }, [state, onStateChange])

  // Trigger milestone celebration notification
  const triggerMilestoneNotification = useCallback(async (milestone: number) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return

    const title = t.reminder?.milestone?.title || `🎉 Meilenstein erreicht!`
    const body = (t.reminder?.milestone?.body || `Glückwunsch! Du hast {count} Fragen beantwortet!`)
      .replace('{count}', String(milestone))

    try {
      if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready
        await registration.showNotification(title, {
          body,
          icon: '/pwa-192x192.png',
          tag: 'rm-milestone',
          data: { url: '/' },
          requireInteraction: true
        })
      } else {
        // Fallback to in-app toast (would be handled by parent component)
        console.log('Milestone achieved:', milestone)
      }
    } catch (e) {
      console.error('Error showing milestone notification:', e)
    }
  }, [t])

  // Initialize streak check on app load
  useEffect(() => {
    checkStreakReset()
  }, [checkStreakReset])

  return {
    streak: state.streak || { current: 0, longest: 0, lastAnswerDate: '' },
    updateStreak,
    checkStreakReset,
    totalAnswered: getTotalAnswered()
  }
}
import { useState, useEffect, useCallback } from 'react'

export interface StreakState {
  current: number
  longest: number
  lastAnswerDate: string   // ISO 8601 (YYYY-MM-DD)
}

export interface UseStreakReturn {
  streak: StreakState
  totalAnswered: number
  recordAnswer: (answeredAt?: string, totalAnswered?: number) => void
  checkStreakReset: () => void
}

const STREAK_STORAGE_KEY = 'rm-streak-state'

function getToday(): string {
  return new Date().toISOString().split('T')[0] // YYYY-MM-DD format
}

function getYesterday(): string {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return yesterday.toISOString().split('T')[0]
}

function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1 + 'T00:00:00Z')
  const d2 = new Date(date2 + 'T00:00:00Z')
  const diffTime = Math.abs(d2.getTime() - d1.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

function loadStreak(): StreakState {
  try {
    const raw = localStorage.getItem(STREAK_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as StreakState
      return {
        current: parsed.current ?? 0,
        longest: parsed.longest ?? 0,
        lastAnswerDate: parsed.lastAnswerDate ?? getToday(),
      }
    }
  } catch {
    // ignore corrupt data
  }
  return { current: 0, longest: 0, lastAnswerDate: getToday() }
}

function saveStreak(streak: StreakState): void {
  try {
    localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(streak))
  } catch (err) {
    console.error('remember-me: failed to persist streak state', err)
  }
}

async function triggerMilestoneNotification(count: number): Promise<void> {
  const milestones = [10, 25, 50, 100]
  if (!milestones.includes(count)) return

  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) return

  try {
    const registration = await navigator.serviceWorker.ready
    
    if (Notification.permission === 'granted') {
      const title = 'Meilenstein erreicht! 🎉'
      const body = `Du hast ${count} Fragen beantwortet - ein wichtiger Schritt für dein Vermächtnis!`
      
      await registration.showNotification(title, {
        body,
        icon: '/pwa-192x192.png',
        tag: 'rm-milestone',
        data: { url: '/profile' }
      })
    } else {
      // Fallback: trigger in-app toast if permission not granted
      // This would be handled by the component consuming useStreak
      console.info('Milestone reached:', count, 'answers')
    }
  } catch (e) {
    console.error('Error showing milestone notification:', e)
  }
}

export function useStreak(): UseStreakReturn {
  const [streak, setStreak] = useState<StreakState>(() => loadStreak())
  const [totalAnswered, setTotalAnswered] = useState(0)

  // Load total answered count from localStorage on mount
  useEffect(() => {
    try {
      const appState = localStorage.getItem('remember-me-state')
      if (appState) {
        const parsed = JSON.parse(appState)
        const answersCount = Object.keys(parsed.answers || {}).length
        setTotalAnswered(answersCount)
      }
    } catch {
      // ignore
    }
  }, [])

  const checkStreakReset = useCallback(() => {
    const today = getToday()
    const yesterday = getYesterday()
    
    if (streak.lastAnswerDate !== today && streak.lastAnswerDate !== yesterday) {
      // More than 1 day since last answer - reset current streak
      const updated = { ...streak, current: 0 }
      setStreak(updated)
      saveStreak(updated)
    }
  }, [streak])

  const recordAnswer = useCallback((answeredAt?: string, newTotalAnswered?: number) => {
    const answerDate = answeredAt || getToday()
    const today = getToday()
    const yesterday = getYesterday()
    
    let newCurrent = streak.current
    
    if (answerDate === today) {
      // Answer today
      if (streak.lastAnswerDate === yesterday) {
        // Continue streak
        newCurrent = streak.current + 1
      } else if (streak.lastAnswerDate === today) {
        // Already answered today, don't change streak
        newCurrent = streak.current
      } else {
        // Start new streak
        newCurrent = 1
      }
    } else if (answerDate === yesterday) {
      // Answer yesterday
      if (streak.lastAnswerDate === yesterday) {
        // Already counted yesterday
        newCurrent = streak.current
      } else {
        // Start or continue streak
        newCurrent = streak.current + 1
      }
    } else {
      // Answer from other date - start new streak if it's the most recent
      newCurrent = 1
    }
    
    const newLongest = Math.max(streak.longest, newCurrent)
    const updated: StreakState = {
      current: newCurrent,
      longest: newLongest,
      lastAnswerDate: answerDate
    }
    
    setStreak(updated)
    saveStreak(updated)
    
    // Update total answered count and trigger milestone if provided
    if (newTotalAnswered !== undefined) {
      setTotalAnswered(newTotalAnswered)
      triggerMilestoneNotification(newTotalAnswered)
    }
  }, [streak])

  // Check for streak reset on component mount and when visibility changes
  useEffect(() => {
    checkStreakReset()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkStreakReset()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [checkStreakReset])

  return {
    streak,
    totalAnswered,
    recordAnswer,
    checkStreakReset,
  }
}
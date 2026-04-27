import { useState, useEffect, useCallback } from 'react'

export interface StreakState {
  current: number
  longest: number
  lastAnswerDate: string   // ISO 8601 (YYYY-MM-DD)
}

export interface UseStreakReturn {
  streak: StreakState
  totalAnswered: number
  /**
   * Aktualisiert Streak nach einer neuen Antwort.
   * @param answeredAt  ISO-Datum (YYYY-MM-DD), default = heute lokal
   * @param totalAnswered  neue Gesamtzahl beantworteter Fragen (für Meilenstein-Trigger)
   */
  recordAnswer: (answeredAt?: string, totalAnswered?: number) => void
  /** Setzt current=0 wenn lastAnswerDate > 1 Tag her ist */
  checkStreakReset: () => void
}

const STREAK_KEY = 'rm-streak-state'

function getTodayLocalDate(): string {
  return new Date().toISOString().split('T')[0]
}

function getDateDifference(date1: string, date2: string): number {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  return Math.floor((d2.getTime() - d1.getTime()) / (24 * 60 * 60 * 1000))
}

async function triggerMilestoneNotification(count: number) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  const milestones = [10, 25, 50, 100]
  if (!milestones.includes(count)) return

  try {
    const registration = await navigator.serviceWorker.ready
    await registration.showNotification('Meilenstein erreicht! 🎉', {
      body: `Du hast ${count} Fragen beantwortet! Großartige Leistung.`,
      icon: '/pwa-192x192.png',
      tag: 'rm-milestone',
      data: { url: '/' }
    })
  } catch (e) {
    console.error('Error showing milestone notification:', e)
  }
}

export function useStreak(): UseStreakReturn {
  const [streak, setStreak] = useState<StreakState>(() => {
    try {
      const stored = localStorage.getItem(STREAK_KEY)
      if (stored) {
        return JSON.parse(stored) as StreakState
      }
    } catch {
      // ignore corrupt data
    }
    return {
      current: 0,
      longest: 0,
      lastAnswerDate: ''
    }
  })

  const [totalAnswered, setTotalAnswered] = useState(0)

  useEffect(() => {
    try {
      localStorage.setItem(STREAK_KEY, JSON.stringify(streak))
    } catch (e) {
      console.error('Failed to save streak state:', e)
    }
  }, [streak])

  const checkStreakReset = useCallback(() => {
    if (!streak.lastAnswerDate) return

    const today = getTodayLocalDate()
    const daysSince = getDateDifference(streak.lastAnswerDate, today)
    
    if (daysSince > 1 && streak.current > 0) {
      setStreak(prev => ({
        ...prev,
        current: 0
      }))
    }
  }, [streak.lastAnswerDate, streak.current])

  const recordAnswer = useCallback(async (answeredAt?: string, newTotalAnswered?: number) => {
    const answerDate = answeredAt || getTodayLocalDate()
    const today = getTodayLocalDate()
    
    setStreak(prev => {
      const daysSinceLastAnswer = prev.lastAnswerDate 
        ? getDateDifference(prev.lastAnswerDate, answerDate)
        : 0

      let newCurrent = prev.current
      
      if (!prev.lastAnswerDate || daysSinceLastAnswer === 1) {
        // First answer or consecutive day
        newCurrent = prev.current + 1
      } else if (daysSinceLastAnswer === 0 && prev.lastAnswerDate === answerDate) {
        // Same day as previous answer, don't increment
        newCurrent = prev.current
      } else if (daysSinceLastAnswer > 1) {
        // Streak broken, start fresh
        newCurrent = 1
      }

      const newLongest = Math.max(prev.longest, newCurrent)

      return {
        current: newCurrent,
        longest: newLongest,
        lastAnswerDate: answerDate
      }
    })

    if (newTotalAnswered !== undefined) {
      setTotalAnswered(newTotalAnswered)
      // Trigger milestone notification if needed
      await triggerMilestoneNotification(newTotalAnswered)
    }
  }, [])

  return {
    streak,
    totalAnswered,
    recordAnswer,
    checkStreakReset
  }
}
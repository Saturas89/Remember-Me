import { useCallback, useEffect } from 'react'
import { useAnswers } from './useAnswers'

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

function getLocalISODate(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1 + 'T00:00:00')
  const d2 = new Date(date2 + 'T00:00:00')
  return Math.floor((d2.getTime() - d1.getTime()) / (24 * 60 * 60 * 1000))
}

async function triggerMilestoneNotification(count: number, locale: 'de' | 'en' = 'de') {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  
  try {
    const registration = await navigator.serviceWorker.ready
    const title = locale === 'de' ? 'Meilenstein erreicht! 🎉' : 'Milestone reached! 🎉'
    const body = locale === 'de' 
      ? `Du hast ${count} Fragen beantwortet! Deine Geschichte nimmt Form an.`
      : `You've answered ${count} questions! Your story is taking shape.`
    
    await registration.showNotification(title, {
      body,
      icon: '/pwa-192x192.png',
      tag: 'rm-milestone',
      data: { url: '/archive' }
    })
  } catch (e) {
    console.error('Error showing milestone notification:', e)
  }
}

export function useStreak(): UseStreakReturn {
  const { isLoaded, answers, streak: storedStreak, saveStreak } = useAnswers()
  
  const defaultStreak: StreakState = {
    current: 0,
    longest: 0,
    lastAnswerDate: getLocalISODate()
  }
  
  const streak = storedStreak || defaultStreak
  const totalAnswered = Object.values(answers).filter(
    a => a.value.trim() !== '' || 
         (a.imageIds?.length ?? 0) > 0 || 
         (a.videoIds?.length ?? 0) > 0 || 
         !!a.audioId || 
         !!a.audioTranscript
  ).length

  const recordAnswer = useCallback((answeredAt?: string, totalAnsweredCount?: number) => {
    if (!isLoaded) return
    
    const today = answeredAt || getLocalISODate()
    const currentStreak = streak
    const daysSince = daysBetween(currentStreak.lastAnswerDate, today)
    
    let newCurrent: number
    if (daysSince === 0) {
      // Same day, keep current streak
      newCurrent = currentStreak.current
    } else if (daysSince === 1) {
      // Next day, increment streak
      newCurrent = currentStreak.current + 1
    } else {
      // Gap > 1 day, reset to 1
      newCurrent = 1
    }
    
    const newLongest = Math.max(currentStreak.longest, newCurrent)
    const actualCount = totalAnsweredCount ?? totalAnswered + 1
    
    // Check for milestones (10, 25, 50, 100)
    const milestones = [10, 25, 50, 100]
    if (milestones.includes(actualCount)) {
      const locale = (navigator.language || 'de').startsWith('de') ? 'de' : 'en'
      triggerMilestoneNotification(actualCount, locale)
    }
    
    const updatedStreak = {
      current: newCurrent,
      longest: newLongest,
      lastAnswerDate: today
    }
    
    saveStreak(updatedStreak)
  }, [isLoaded, streak, totalAnswered, saveStreak])

  const checkStreakReset = useCallback(() => {
    if (!isLoaded) return
    
    const today = getLocalISODate()
    const daysSince = daysBetween(streak.lastAnswerDate, today)
    
    if (daysSince > 1 && streak.current > 0) {
      const updatedStreak = {
        ...streak,
        current: 0
      }
      saveStreak(updatedStreak)
    }
  }, [isLoaded, streak, saveStreak])

  // Check for streak reset on mount and periodically
  useEffect(() => {
    checkStreakReset()
  }, [checkStreakReset])

  return {
    streak,
    totalAnswered,
    recordAnswer,
    checkStreakReset
  }
}
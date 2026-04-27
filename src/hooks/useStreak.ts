import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'remember-me-state'

export interface StreakState {
  current: number
  longest: number
  lastAnswerDate: string // ISO 8601 (YYYY-MM-DD)
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

function getTodayISOString(): string {
  const now = new Date()
  return now.toISOString().split('T')[0] // YYYY-MM-DD
}

function getDateDiffInDays(date1: string, date2: string): number {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  const diffTime = Math.abs(d2.getTime() - d1.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

function loadStreakFromStorage(): StreakState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.streak) {
        return {
          current: parsed.streak.current || 0,
          longest: parsed.streak.longest || 0,
          lastAnswerDate: parsed.streak.lastAnswerDate || getTodayISOString()
        }
      }
    }
  } catch {
    // ignore corrupt data
  }
  
  return {
    current: 0,
    longest: 0,
    lastAnswerDate: getTodayISOString()
  }
}

function saveStreakToStorage(streak: StreakState): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    let data = {}
    if (raw) {
      data = JSON.parse(raw)
    }
    data = { ...data, streak }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (err) {
    console.error('remember-me: failed to persist streak', err)
  }
}

function getTotalAnsweredCount(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.answers) {
        return Object.values(parsed.answers).filter((a: any) => 
          a.value?.trim() || (a.imageIds?.length ?? 0) > 0
        ).length
      }
    }
  } catch {
    // ignore
  }
  return 0
}

async function sendMilestoneNotification(milestone: number, type: 'answers' | 'category', categoryName?: string) {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return
  }
  
  if (Notification.permission !== 'granted') {
    return
  }
  
  try {
    const registration = await navigator.serviceWorker.ready
    
    let title = ''
    let body = ''
    
    if (type === 'answers') {
      title = milestone >= 100 ? 'Unglaublich!' : milestone >= 50 ? 'Großartig!' : milestone >= 25 ? 'Fantastisch!' : 'Gut gemacht!'
      body = `Du hast ${milestone} Fragen beantwortet!`
    } else if (type === 'category' && categoryName) {
      title = 'Kategorie abgeschlossen!'
      body = `Du hast alle Fragen in "${categoryName}" beantwortet!`
    }
    
    await registration.showNotification(title, {
      body,
      icon: '/pwa-192x192.png',
      tag: 'rm-milestone',
      data: { url: '/' }
    })
  } catch (e) {
    console.error('Error sending milestone notification:', e)
  }
}

export function useStreak(): UseStreakReturn {
  const [streak, setStreak] = useState<StreakState>(() => loadStreakFromStorage())
  const [totalAnswered, setTotalAnswered] = useState(() => getTotalAnsweredCount())
  
  // Load initial values on mount
  useEffect(() => {
    setStreak(loadStreakFromStorage())
    setTotalAnswered(getTotalAnsweredCount())
  }, [])
  
  const recordAnswer = useCallback((answeredAt?: string, newTotalAnswered?: number) => {
    const today = answeredAt || getTodayISOString()
    
    setStreak(current => {
      const daysSinceLastAnswer = getDateDiffInDays(current.lastAnswerDate, today)
      
      let newCurrent = current.current
      
      if (daysSinceLastAnswer === 0) {
        // Same day, keep streak
        newCurrent = current.current
      } else if (daysSinceLastAnswer === 1) {
        // Next day, increment streak
        newCurrent = current.current + 1
      } else {
        // Gap > 1 day, reset streak
        newCurrent = 1
      }
      
      const newLongest = Math.max(current.longest, newCurrent)
      
      const newState: StreakState = {
        current: newCurrent,
        longest: newLongest,
        lastAnswerDate: today
      }
      
      saveStreakToStorage(newState)
      return newState
    })
    
    // Update total count and check for milestones
    if (typeof newTotalAnswered === 'number') {
      const previousTotal = totalAnswered
      setTotalAnswered(newTotalAnswered)
      
      // Check for milestone notifications
      const milestones = [10, 25, 50, 100]
      const reachedMilestone = milestones.find(m => 
        previousTotal < m && newTotalAnswered >= m
      )
      
      if (reachedMilestone) {
        sendMilestoneNotification(reachedMilestone, 'answers')
      }
    }
  }, [totalAnswered])
  
  const checkStreakReset = useCallback(() => {
    const today = getTodayISOString()
    
    setStreak(current => {
      const daysSinceLastAnswer = getDateDiffInDays(current.lastAnswerDate, today)
      
      if (daysSinceLastAnswer > 1) {
        const resetState: StreakState = {
          ...current,
          current: 0
        }
        saveStreakToStorage(resetState)
        return resetState
      }
      
      return current
    })
  }, [])
  
  return {
    streak,
    totalAnswered,
    recordAnswer,
    checkStreakReset
  }
}
import { useCallback, useEffect } from 'react'
import type { Answer, AppState } from '../types'

export interface StreakState {
  current: number
  longest: number
  lastAnswerDate: string   // ISO 8601 (YYYY-MM-DD)
}

export interface UseStreakArgs {
  isLoaded: boolean
  answers: Record<string, Answer>
  streak: AppState['streak']
  saveStreak: (streak: StreakState) => void
}

export interface UseStreakReturn {
  streak: StreakState
  totalAnswered: number
  recordAnswer: (answeredAt?: string) => void
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

// Compute-Hook: nimmt useAnswers-Werte explizit als Argumente. Vermeidet die
// zweite useState-Instanz, die entstehen würde, wenn der Hook intern noch
// einmal useAnswers() aufruft — siehe docs/req-016-pr74-postmortem.md.
export function useStreak(args: UseStreakArgs): UseStreakReturn {
  const { isLoaded, answers, streak: storedStreak, saveStreak } = args

  const defaultStreak: StreakState = {
    current: 0,
    longest: 0,
    lastAnswerDate: ''  // empty = no prior answer recorded
  }

  const streak = storedStreak || defaultStreak
  const totalAnswered = Object.values(answers).filter(
    a => a.value.trim() !== '' ||
         (a.imageIds?.length ?? 0) > 0 ||
         (a.videoIds?.length ?? 0) > 0 ||
         !!a.audioId ||
         !!a.audioTranscript
  ).length

  const recordAnswer = useCallback((answeredAt?: string) => {
    if (!isLoaded) return

    const today = answeredAt || getLocalISODate()
    const currentStreak = streak

    let newCurrent: number
    if (!currentStreak.lastAnswerDate) {
      // First answer ever
      newCurrent = 1
    } else {
      const daysSince = daysBetween(currentStreak.lastAnswerDate, today)
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
    }

    const newLongest = Math.max(currentStreak.longest, newCurrent)

    saveStreak({
      current: newCurrent,
      longest: newLongest,
      lastAnswerDate: today
    })
  }, [isLoaded, streak, saveStreak])

  const checkStreakReset = useCallback(() => {
    if (!isLoaded) return

    const today = getLocalISODate()
    const daysSince = daysBetween(streak.lastAnswerDate, today)

    if (daysSince > 1 && streak.current > 0) {
      saveStreak({
        ...streak,
        current: 0
      })
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

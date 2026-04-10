import { useState, useCallback } from 'react'
import type { Profile, AppState } from '../types'

const STORAGE_KEY = 'remember-me-state'

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as AppState
  } catch {
    // ignore corrupt data
  }
  return { profile: null, answers: {} }
}

function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function useAnswers() {
  const [state, setState] = useState<AppState>(loadState)

  const saveAnswer = useCallback((questionId: string, categoryId: string, value: string) => {
    setState(prev => {
      const existing = prev.answers[questionId]
      const now = new Date().toISOString()
      const next: AppState = {
        ...prev,
        answers: {
          ...prev.answers,
          [questionId]: {
            id: questionId,
            questionId,
            categoryId,
            value,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
          },
        },
      }
      saveState(next)
      return next
    })
  }, [])

  const deleteAnswer = useCallback((questionId: string) => {
    setState(prev => {
      const { [questionId]: _removed, ...rest } = prev.answers
      const next: AppState = { ...prev, answers: rest }
      saveState(next)
      return next
    })
  }, [])

  const saveProfile = useCallback((profile: Profile) => {
    setState(prev => {
      const next: AppState = { ...prev, profile }
      saveState(next)
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    const fresh: AppState = { profile: null, answers: {} }
    saveState(fresh)
    setState(fresh)
  }, [])

  const getAnswer = useCallback(
    (questionId: string): string => state.answers[questionId]?.value ?? '',
    [state.answers],
  )

  const getCategoryProgress = useCallback(
    (categoryId: string, totalQuestions: number): number => {
      const answered = Object.values(state.answers).filter(
        a => a.categoryId === categoryId && a.value.trim() !== '',
      ).length
      return totalQuestions > 0 ? Math.round((answered / totalQuestions) * 100) : 0
    },
    [state.answers],
  )

  return {
    profile: state.profile,
    answers: state.answers,
    saveAnswer,
    deleteAnswer,
    saveProfile,
    clearAll,
    getAnswer,
    getCategoryProgress,
  }
}

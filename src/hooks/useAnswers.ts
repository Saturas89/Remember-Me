import { useState, useCallback } from 'react'
import type { Profile, AppState, Friend, FriendAnswer, AnswerExport } from '../types'

const STORAGE_KEY = 'remember-me-state'

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppState>
      // Forward-compatible: fill in new fields if missing
      return {
        profile: parsed.profile ?? null,
        answers: parsed.answers ?? {},
        friends: parsed.friends ?? [],
        friendAnswers: parsed.friendAnswers ?? [],
      }
    }
  } catch {
    // ignore corrupt data
  }
  return { profile: null, answers: {}, friends: [], friendAnswers: [] }
}

function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function useAnswers() {
  const [state, setState] = useState<AppState>(loadState)

  // ── Own answers ──────────────────────────────────────────

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

  // ── Friends ──────────────────────────────────────────────

  const addFriend = useCallback((name: string): Friend => {
    const friend: Friend = {
      id: `friend-${Date.now()}`,
      name: name.trim(),
      addedAt: new Date().toISOString(),
    }
    setState(prev => {
      const next: AppState = { ...prev, friends: [...prev.friends, friend] }
      saveState(next)
      return next
    })
    return friend
  }, [])

  const removeFriend = useCallback((friendId: string) => {
    setState(prev => {
      const next: AppState = {
        ...prev,
        friends: prev.friends.filter(f => f.id !== friendId),
        friendAnswers: prev.friendAnswers.filter(a => a.friendId !== friendId),
      }
      saveState(next)
      return next
    })
  }, [])

  /** Import answers sent back by a friend via export code */
  const importFriendAnswers = useCallback((data: AnswerExport) => {
    setState(prev => {
      const now = new Date().toISOString()
      const newAnswers: FriendAnswer[] = data.answers
        .filter(a => a.value.trim())
        .map(a => ({
          id: `${data.friendId}-${a.questionId}`,
          friendId: data.friendId,
          friendName: data.friendName,
          questionId: a.questionId,
          value: a.value,
          createdAt: now,
        }))
      // Replace any previous answers from this friend
      const filtered = prev.friendAnswers.filter(a => a.friendId !== data.friendId)
      const next: AppState = { ...prev, friendAnswers: [...filtered, ...newAnswers] }
      saveState(next)
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    const fresh: AppState = { profile: null, answers: {}, friends: [], friendAnswers: [] }
    saveState(fresh)
    setState(fresh)
  }, [])

  // ── Derived helpers ──────────────────────────────────────

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

  const getFriendAnswers = useCallback(
    (friendId: string): FriendAnswer[] =>
      state.friendAnswers.filter(a => a.friendId === friendId),
    [state.friendAnswers],
  )

  return {
    profile: state.profile,
    answers: state.answers,
    friends: state.friends,
    friendAnswers: state.friendAnswers,
    saveAnswer,
    deleteAnswer,
    saveProfile,
    addFriend,
    removeFriend,
    importFriendAnswers,
    clearAll,
    getAnswer,
    getCategoryProgress,
    getFriendAnswers,
  }
}

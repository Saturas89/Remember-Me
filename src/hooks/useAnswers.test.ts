import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAnswers } from './useAnswers'
import { exportAsBackup } from '../utils/export'
import type { ExportData } from '../utils/export'
import type { Friend } from '../types'

const STORAGE_KEY = 'remember-me-state'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeBackup(overrides: Partial<ExportData> = {}): string {
  return exportAsBackup({
    profile: { name: 'Anna', createdAt: '2024-01-01T00:00:00.000Z' },
    answers: {},
    friends: [],
    friendAnswers: [],
    customQuestions: [],
    ...overrides,
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useAnswers', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // ── Initial state ───────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts with null profile and empty collections', () => {
      const { result } = renderHook(() => useAnswers())
      expect(result.current.profile).toBeNull()
      expect(result.current.answers).toEqual({})
      expect(result.current.friends).toEqual([])
      expect(result.current.friendAnswers).toEqual([])
      expect(result.current.customQuestions).toEqual([])
    })

    it('loads existing profile from localStorage', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        profile: { name: 'Anna', createdAt: '2024-01-01T00:00:00.000Z' },
        answers: {},
        friends: [],
        friendAnswers: [],
        customQuestions: [],
      }))
      const { result } = renderHook(() => useAnswers())
      expect(result.current.profile?.name).toBe('Anna')
    })

    it('handles corrupt localStorage data without throwing', () => {
      localStorage.setItem(STORAGE_KEY, '{ not: valid JSON }}}')
      expect(() => renderHook(() => useAnswers())).not.toThrow()
      const { result } = renderHook(() => useAnswers())
      expect(result.current.profile).toBeNull()
    })

    it('fills in missing fields for forward-compatibility', () => {
      // Older data format missing some fields
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        profile: { name: 'Max', createdAt: '2024-01-01T00:00:00.000Z' },
        answers: {},
        // friends, friendAnswers, customQuestions absent
      }))
      const { result } = renderHook(() => useAnswers())
      expect(result.current.friends).toEqual([])
      expect(result.current.friendAnswers).toEqual([])
      expect(result.current.customQuestions).toEqual([])
    })
  })

  // ── saveAnswer ──────────────────────────────────────────────────────────────

  describe('saveAnswer', () => {
    it('creates an answer with correct fields', () => {
      const { result } = renderHook(() => useAnswers())
      act(() => { result.current.saveAnswer('q-1', 'childhood', 'Berlin') })
      const ans = result.current.answers['q-1']
      expect(ans.value).toBe('Berlin')
      expect(ans.categoryId).toBe('childhood')
      expect(ans.questionId).toBe('q-1')
      expect(ans.createdAt).toBeTruthy()
      expect(ans.updatedAt).toBeTruthy()
    })

    it('preserves createdAt when updating an existing answer', () => {
      const { result } = renderHook(() => useAnswers())
      act(() => { result.current.saveAnswer('q-1', 'childhood', 'Erstantwort') })
      const original = result.current.answers['q-1'].createdAt
      act(() => { result.current.saveAnswer('q-1', 'childhood', 'Geändert') })
      expect(result.current.answers['q-1'].createdAt).toBe(original)
      expect(result.current.answers['q-1'].value).toBe('Geändert')
    })

    it('persists the answer to localStorage immediately (REQ-003 FR-3.1)', () => {
      const { result } = renderHook(() => useAnswers())
      act(() => { result.current.saveAnswer('q-1', 'childhood', 'Gespeichert') })
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
      expect(stored.answers['q-1'].value).toBe('Gespeichert')
    })

    it('survives a fresh hook mount (persisted in localStorage)', () => {
      const { result: r1 } = renderHook(() => useAnswers())
      act(() => { r1.current.saveAnswer('q-1', 'childhood', 'Ich bleibe') })

      // Simulate reload — new hook instance reads from localStorage
      const { result: r2 } = renderHook(() => useAnswers())
      expect(r2.current.answers['q-1'].value).toBe('Ich bleibe')
    })
  })

  // ── saveProfile ─────────────────────────────────────────────────────────────

  describe('saveProfile', () => {
    it('saves profile and makes it available', () => {
      const { result } = renderHook(() => useAnswers())
      act(() => {
        result.current.saveProfile({ name: 'Lena', birthYear: 1985, createdAt: '2024-01-01T00:00:00.000Z' })
      })
      expect(result.current.profile?.name).toBe('Lena')
      expect(result.current.profile?.birthYear).toBe(1985)
    })

    it('persists profile to localStorage', () => {
      const { result } = renderHook(() => useAnswers())
      act(() => {
        result.current.saveProfile({ name: 'Klaus', createdAt: '2024-01-01T00:00:00.000Z' })
      })
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
      expect(stored.profile.name).toBe('Klaus')
    })
  })

  // ── getCategoryProgress ─────────────────────────────────────────────────────

  describe('getCategoryProgress', () => {
    it('returns 0 for a category with no answers', () => {
      const { result } = renderHook(() => useAnswers())
      expect(result.current.getCategoryProgress('childhood', 10)).toBe(0)
    })

    it('returns 100 when all questions are answered', () => {
      const { result } = renderHook(() => useAnswers())
      act(() => {
        result.current.saveAnswer('q-1', 'childhood', 'A')
        result.current.saveAnswer('q-2', 'childhood', 'B')
      })
      expect(result.current.getCategoryProgress('childhood', 2)).toBe(100)
    })

    it('returns correct percentage for partial completion', () => {
      const { result } = renderHook(() => useAnswers())
      act(() => { result.current.saveAnswer('q-1', 'childhood', 'A') })
      expect(result.current.getCategoryProgress('childhood', 4)).toBe(25)
    })

    it('ignores answers from other categories', () => {
      const { result } = renderHook(() => useAnswers())
      act(() => { result.current.saveAnswer('q-1', 'family', 'A') })
      expect(result.current.getCategoryProgress('childhood', 10)).toBe(0)
    })

    it('counts image-only answers (no text value) as answered', () => {
      const { result } = renderHook(() => useAnswers())
      act(() => { result.current.setAnswerImages('q-1', 'childhood', ['img-1']) })
      expect(result.current.getCategoryProgress('childhood', 10)).toBe(10)
    })

    it('does not count whitespace-only answers', () => {
      const { result } = renderHook(() => useAnswers())
      act(() => { result.current.saveAnswer('q-1', 'childhood', '   ') })
      expect(result.current.getCategoryProgress('childhood', 10)).toBe(0)
    })
  })

  // ── friends ─────────────────────────────────────────────────────────────────

  describe('addFriend', () => {
    it('creates a friend with correct fields', () => {
      const { result } = renderHook(() => useAnswers())
      act(() => { result.current.addFriend('Klaus') })
      expect(result.current.friends).toHaveLength(1)
      expect(result.current.friends[0].name).toBe('Klaus')
      expect(result.current.friends[0].id).toMatch(/^friend-/)
      expect(result.current.friends[0].addedAt).toBeTruthy()
    })

    it('trims whitespace from name', () => {
      const { result } = renderHook(() => useAnswers())
      act(() => { result.current.addFriend('  Petra  ') })
      expect(result.current.friends[0].name).toBe('Petra')
    })
  })

  describe('removeFriend', () => {
    it('removes the friend from the list', () => {
      const { result } = renderHook(() => useAnswers())
      let friend!: Friend
      act(() => { friend = result.current.addFriend('Klaus') })
      act(() => { result.current.removeFriend(friend.id) })
      expect(result.current.friends).toHaveLength(0)
    })

    it('removes all answers belonging to that friend (REQ-003)', () => {
      const { result } = renderHook(() => useAnswers())
      let friend!: Friend
      act(() => { friend = result.current.addFriend('Klaus') })
      act(() => {
        result.current.importFriendAnswers({
          friendId: friend.id,
          friendName: 'Klaus',
          answers: [{ questionId: 'q-1', value: 'Antwort' }],
        })
      })
      expect(result.current.friendAnswers).toHaveLength(1)
      act(() => { result.current.removeFriend(friend.id) })
      expect(result.current.friendAnswers).toHaveLength(0)
    })

    it('preserves answers from other friends', () => {
      // Use static IDs to avoid Date.now() collisions when IDs are generated synchronously
      const { result } = renderHook(() => useAnswers())
      act(() => {
        result.current.importFriendAnswers({ friendId: 'f-static-a', friendName: 'Klaus', answers: [{ questionId: 'q-1', value: 'A' }] })
      })
      act(() => {
        result.current.importFriendAnswers({ friendId: 'f-static-b', friendName: 'Petra', answers: [{ questionId: 'q-2', value: 'B' }] })
      })
      expect(result.current.friendAnswers).toHaveLength(2)
      act(() => { result.current.removeFriend('f-static-a') })
      expect(result.current.friendAnswers).toHaveLength(1)
      expect(result.current.friendAnswers[0].friendId).toBe('f-static-b')
    })
  })

  // ── importFriendAnswers ─────────────────────────────────────────────────────

  describe('importFriendAnswers', () => {
    it('stores only non-empty answer values', () => {
      const { result } = renderHook(() => useAnswers())
      act(() => {
        result.current.importFriendAnswers({
          friendId: 'f-1',
          friendName: 'Klaus',
          answers: [
            { questionId: 'q-1', value: 'Echte Antwort' },
            { questionId: 'q-2', value: '   ' },
            { questionId: 'q-3', value: '' },
          ],
        })
      })
      expect(result.current.friendAnswers).toHaveLength(1)
      expect(result.current.friendAnswers[0].questionId).toBe('q-1')
    })

    it('replaces all previous answers from the same friend', () => {
      const { result } = renderHook(() => useAnswers())
      act(() => {
        result.current.importFriendAnswers({
          friendId: 'f-1', friendName: 'Klaus',
          answers: [{ questionId: 'q-1', value: 'Alt' }],
        })
      })
      act(() => {
        result.current.importFriendAnswers({
          friendId: 'f-1', friendName: 'Klaus',
          answers: [{ questionId: 'q-2', value: 'Neu' }],
        })
      })
      expect(result.current.friendAnswers).toHaveLength(1)
      expect(result.current.friendAnswers[0].questionId).toBe('q-2')
    })

    it('preserves answers from different friends', () => {
      const { result } = renderHook(() => useAnswers())
      act(() => {
        result.current.importFriendAnswers({ friendId: 'f-1', friendName: 'Klaus', answers: [{ questionId: 'q-1', value: 'A' }] })
        result.current.importFriendAnswers({ friendId: 'f-2', friendName: 'Petra', answers: [{ questionId: 'q-2', value: 'B' }] })
      })
      act(() => {
        result.current.importFriendAnswers({ friendId: 'f-1', friendName: 'Klaus', answers: [{ questionId: 'q-3', value: 'C' }] })
      })
      expect(result.current.friendAnswers).toHaveLength(2)
      expect(result.current.friendAnswers.find(a => a.friendId === 'f-2')).toBeTruthy()
    })

    it('stores questionText from the export for resilient archive display', () => {
      const { result } = renderHook(() => useAnswers())
      act(() => {
        result.current.importFriendAnswers({
          friendId: 'f-1',
          friendName: 'Klaus',
          answers: [{ questionId: 'q-1', value: 'Antwort', questionText: 'Was schätzt du?' }],
        })
      })
      expect(result.current.friendAnswers[0].questionText).toBe('Was schätzt du?')
    })
  })

  // ── importCustomQuestions ───────────────────────────────────────────────────

  describe('importCustomQuestions', () => {
    it('adds new questions to the list', () => {
      const { result } = renderHook(() => useAnswers())
      act(() => {
        result.current.importCustomQuestions([{
          id: 'cq-ext-1',
          text: 'Lieblingsgericht?',
          type: 'text',
          createdAt: '2024-01-01T00:00:00.000Z',
        }])
      })
      expect(result.current.customQuestions).toHaveLength(1)
    })

    it('deduplicates by text (case-insensitive)', () => {
      const { result } = renderHook(() => useAnswers())
      act(() => { result.current.addCustomQuestion('Lieblingsgericht?') })
      act(() => {
        result.current.importCustomQuestions([{
          id: 'cq-external',
          text: 'LIEBLINGSGERICHT?', // same text, different case
          type: 'text',
          createdAt: '2024-01-01T00:00:00.000Z',
        }])
      })
      expect(result.current.customQuestions).toHaveLength(1)
    })

    it('adds questions not already present', () => {
      const { result } = renderHook(() => useAnswers())
      act(() => { result.current.addCustomQuestion('Frage A') })
      act(() => {
        result.current.importCustomQuestions([
          { id: 'cq-b', text: 'Frage B', type: 'text', createdAt: '2024-01-01T00:00:00.000Z' },
        ])
      })
      expect(result.current.customQuestions).toHaveLength(2)
    })
  })

  // ── restoreBackup ───────────────────────────────────────────────────────────

  describe('restoreBackup (REQ-004 FR-4.6)', () => {
    it('restores profile from a valid backup', () => {
      const { result } = renderHook(() => useAnswers())
      act(() => {
        result.current.restoreBackup(makeBackup({
          profile: { name: 'Restored', createdAt: '2024-01-01T00:00:00.000Z' },
        }))
      })
      expect(result.current.profile?.name).toBe('Restored')
    })

    it('restores answers from a valid backup', () => {
      const backup = makeBackup({
        answers: {
          'q-1': {
            id: 'q-1', questionId: 'q-1', categoryId: 'childhood',
            value: 'Backup-Wert',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        },
      })
      const { result } = renderHook(() => useAnswers())
      act(() => { result.current.restoreBackup(backup) })
      expect(result.current.answers['q-1'].value).toBe('Backup-Wert')
    })

    it('returns { ok: true } on success', () => {
      const { result } = renderHook(() => useAnswers())
      let res: { ok: boolean } = { ok: false }
      act(() => { res = result.current.restoreBackup(makeBackup()) })
      expect(res.ok).toBe(true)
    })

    it('returns { ok: false } for wrong $type', () => {
      const { result } = renderHook(() => useAnswers())
      let res: { ok: boolean; error?: string } = { ok: true }
      act(() => {
        res = result.current.restoreBackup(JSON.stringify({ $type: 'not-a-backup' }))
      })
      expect(res.ok).toBe(false)
      expect(res.error).toBeTruthy()
    })

    it('returns { ok: false } for malformed JSON', () => {
      const { result } = renderHook(() => useAnswers())
      let res: { ok: boolean } = { ok: true }
      act(() => { res = result.current.restoreBackup('{ invalid json }}}') })
      expect(res.ok).toBe(false)
    })

    it('does not modify state when backup is invalid', () => {
      const { result } = renderHook(() => useAnswers())
      act(() => {
        result.current.saveProfile({ name: 'Existing', createdAt: '2024-01-01T00:00:00.000Z' })
      })
      act(() => {
        result.current.restoreBackup(JSON.stringify({ $type: 'wrong-type' }))
      })
      expect(result.current.profile?.name).toBe('Existing')
    })
  })
})

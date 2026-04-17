import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
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
    it('starts with null profile and empty collections', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
      expect(result.current.profile).toBeNull()
      expect(result.current.answers).toEqual({})
      expect(result.current.friends).toEqual([])
      expect(result.current.friendAnswers).toEqual([])
      expect(result.current.customQuestions).toEqual([])
    })

    it('loads existing profile from localStorage', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        profile: { name: 'Anna', createdAt: '2024-01-01T00:00:00.000Z' },
        answers: {},
        friends: [],
        friendAnswers: [],
        customQuestions: [],
      }))
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
      expect(result.current.profile?.name).toBe('Anna')
    })

    it('handles corrupt localStorage data without throwing', async () => {
      localStorage.setItem(STORAGE_KEY, '{ not: valid JSON }}}')
      expect(() => renderHook(() => useAnswers())).not.toThrow()
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
      expect(result.current.profile).toBeNull()
    })

    it('fills in missing fields for forward-compatibility', async () => {
      // Older data format missing some fields
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        profile: { name: 'Max', createdAt: '2024-01-01T00:00:00.000Z' },
        answers: {},
        // friends, friendAnswers, customQuestions absent
      }))
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
      expect(result.current.friends).toEqual([])
      expect(result.current.friendAnswers).toEqual([])
      expect(result.current.customQuestions).toEqual([])
    })
  })

  // ── saveAnswer ──────────────────────────────────────────────────────────────

  describe('saveAnswer', () => {
    it('creates an answer with correct fields', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
      act(() => { result.current.saveAnswer('q-1', 'childhood', 'Berlin') })
      const ans = result.current.answers['q-1']
      expect(ans.value).toBe('Berlin')
      expect(ans.categoryId).toBe('childhood')
      expect(ans.questionId).toBe('q-1')
      expect(ans.createdAt).toBeTruthy()
      expect(ans.updatedAt).toBeTruthy()
    })

    it('preserves createdAt when updating an existing answer', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
      act(() => { result.current.saveAnswer('q-1', 'childhood', 'Erstantwort') })
      const original = result.current.answers['q-1'].createdAt
      act(() => { result.current.saveAnswer('q-1', 'childhood', 'Geändert') })
      expect(result.current.answers['q-1'].createdAt).toBe(original)
      expect(result.current.answers['q-1'].value).toBe('Geändert')
    })

    it('persists the answer to localStorage immediately (REQ-003 FR-3.1)', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
      act(() => { result.current.saveAnswer('q-1', 'childhood', 'Gespeichert') })
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
      expect(stored.answers['q-1'].value).toBe('Gespeichert')
    })

    it('survives a fresh hook mount (persisted in localStorage)', async () => {
      const { result: r1 } = renderHook(() => useAnswers())
      await waitFor(() => expect(r1.current.isLoaded).toBe(true))
      act(() => { r1.current.saveAnswer('q-1', 'childhood', 'Ich bleibe') })

      // Simulate reload — new hook instance reads from localStorage
      const { result: r2 } = renderHook(() => useAnswers())
      await waitFor(() => expect(r2.current.isLoaded).toBe(true))
      expect(r2.current.answers['q-1'].value).toBe('Ich bleibe')
    })
  })

  // ── saveProfile ─────────────────────────────────────────────────────────────

  describe('saveProfile', () => {
    it('saves profile and makes it available', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
      act(() => {
        result.current.saveProfile({ name: 'Lena', birthYear: 1985, createdAt: '2024-01-01T00:00:00.000Z' })
      })
      expect(result.current.profile?.name).toBe('Lena')
      expect(result.current.profile?.birthYear).toBe(1985)
    })

    it('persists profile to localStorage', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
      act(() => {
        result.current.saveProfile({ name: 'Klaus', createdAt: '2024-01-01T00:00:00.000Z' })
      })
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
      expect(stored.profile.name).toBe('Klaus')
    })
  })

  // ── getCategoryProgress ─────────────────────────────────────────────────────

  describe('getCategoryProgress', () => {
    it('returns 0 for a category with no answers', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
      expect(result.current.getCategoryProgress('childhood', 10)).toBe(0)
    })

    it('returns 100 when all questions are answered', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
      act(() => {
        result.current.saveAnswer('q-1', 'childhood', 'A')
        result.current.saveAnswer('q-2', 'childhood', 'B')
      })
      expect(result.current.getCategoryProgress('childhood', 2)).toBe(100)
    })

    it('returns correct percentage for partial completion', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
      act(() => { result.current.saveAnswer('q-1', 'childhood', 'A') })
      expect(result.current.getCategoryProgress('childhood', 4)).toBe(25)
    })

    it('ignores answers from other categories', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
      act(() => { result.current.saveAnswer('q-1', 'family', 'A') })
      expect(result.current.getCategoryProgress('childhood', 10)).toBe(0)
    })

    it('counts image-only answers (no text value) as answered', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
      act(() => { result.current.setAnswerImages('q-1', 'childhood', ['img-1']) })
      expect(result.current.getCategoryProgress('childhood', 10)).toBe(10)
    })

    it('counts video-only answers (videoIds, no text) as answered', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
      act(() => { result.current.setAnswerVideos('q-1', 'childhood', ['vid-001']) })
      expect(result.current.getCategoryProgress('childhood', 10)).toBe(10)
    })

    it('counts audio-file answers (audioId, no text) as answered', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
      act(() => { result.current.setAnswerAudio('q-1', 'childhood', 'aud-001', '2024-06-01T10:00:00.000Z') })
      expect(result.current.getCategoryProgress('childhood', 10)).toBe(10)
    })

    it('counts transcript-only answers (audioTranscript, no audioId, no text) as answered', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
      act(() => { result.current.setAnswerAudio('q-1', 'childhood', undefined, '2024-06-01T10:00:00.000Z', 'Transkription') })
      expect(result.current.getCategoryProgress('childhood', 10)).toBe(10)
    })

    it('does not count whitespace-only answers', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
      act(() => { result.current.saveAnswer('q-1', 'childhood', '   ') })
      expect(result.current.getCategoryProgress('childhood', 10)).toBe(0)
    })
  })

  // ── friends ─────────────────────────────────────────────────────────────────

  describe('addFriend', () => {
    it('creates a friend with correct fields', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
      act(() => { result.current.addFriend('Klaus') })
      expect(result.current.friends).toHaveLength(1)
      expect(result.current.friends[0].name).toBe('Klaus')
      expect(result.current.friends[0].id).toMatch(/^friend-/)
      expect(result.current.friends[0].addedAt).toBeTruthy()
    })

    it('trims whitespace from name', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
      act(() => { result.current.addFriend('  Petra  ') })
      expect(result.current.friends[0].name).toBe('Petra')
    })
  })

  describe('removeFriend', () => {
    it('removes the friend from the list', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
      let friend!: Friend
      act(() => { friend = result.current.addFriend('Klaus') })
      act(() => { result.current.removeFriend(friend.id) })
      expect(result.current.friends).toHaveLength(0)
    })

    it('removes all answers belonging to that friend (REQ-003)', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
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

    it('preserves answers from other friends', async () => {
      // Use static IDs to avoid Date.now() collisions when IDs are generated synchronously
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
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
    it('stores only non-empty answer values', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
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

    it('replaces all previous answers from the same friend', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
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

    it('preserves answers from different friends', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
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

    it('stores questionText from the export for resilient archive display', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
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
    it('adds new questions to the list', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
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

    it('deduplicates by text (case-insensitive)', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
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

    it('adds questions not already present', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
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
    it('restores profile from a valid backup', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
      act(() => {
        result.current.restoreBackup(makeBackup({
          profile: { name: 'Restored', createdAt: '2024-01-01T00:00:00.000Z' },
        }))
      })
      expect(result.current.profile?.name).toBe('Restored')
    })

    it('restores answers from a valid backup', async () => {
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
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
      act(() => { result.current.restoreBackup(backup) })
      expect(result.current.answers['q-1'].value).toBe('Backup-Wert')
    })

    it('returns { ok: true } on success', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
      let res: { ok: boolean } = { ok: false }
      act(() => { res = result.current.restoreBackup(makeBackup()) })
      expect(res.ok).toBe(true)
    })

    it('returns { ok: false } for wrong $type', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
      let res: { ok: boolean; error?: string } = { ok: true }
      act(() => {
        res = result.current.restoreBackup(JSON.stringify({ $type: 'not-a-backup' }))
      })
      expect(res.ok).toBe(false)
      expect(res.error).toBeTruthy()
    })

    it('returns { ok: false } for malformed JSON', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
      let res: { ok: boolean; error?: string } = { ok: true }
      act(() => { res = result.current.restoreBackup('{ invalid json }}}') })
      expect(res.ok).toBe(false)
      expect(res.error).toBe('Die Datei konnte nicht gelesen werden. Ist es eine gültige Backup-Datei?')
    })

    it('does not modify state when backup is invalid', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
      act(() => {
        result.current.saveProfile({ name: 'Existing', createdAt: '2024-01-01T00:00:00.000Z' })
      })
      act(() => {
        result.current.restoreBackup(JSON.stringify({ $type: 'wrong-type' }))
      })
      expect(result.current.profile?.name).toBe('Existing')
    })
  })

  // ── setAnswerAudio / getAnswerAudioId (REQ-009) ─────────────────────────────

  describe('setAnswerAudio (REQ-009)', () => {
    it('stores audioId on a new answer', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
      act(() => {
        result.current.setAnswerAudio('q-a', 'childhood', 'aud-001', '2024-06-01T10:00:00.000Z')
      })
      expect(result.current.getAnswerAudioId('q-a')).toBe('aud-001')
    })

    it('preserves existing value and imageIds when setting audio', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
      act(() => { result.current.saveAnswer('q-a', 'childhood', 'Meine Antwort') })
      act(() => {
        result.current.setAnswerAudio('q-a', 'childhood', 'aud-002', '2024-06-01T10:00:00.000Z')
      })
      expect(result.current.answers['q-a'].value).toBe('Meine Antwort')
      expect(result.current.answers['q-a'].audioId).toBe('aud-002')
    })

    it('clears audioId when set to undefined', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
      act(() => {
        result.current.setAnswerAudio('q-a', 'childhood', 'aud-003', '2024-06-01T10:00:00.000Z')
      })
      act(() => {
        result.current.setAnswerAudio('q-a', 'childhood', undefined, undefined)
      })
      expect(result.current.getAnswerAudioId('q-a')).toBeUndefined()
    })

    it('persists audioId to localStorage', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
      act(() => {
        result.current.setAnswerAudio('q-a', 'childhood', 'aud-persist', '2024-06-01T10:00:00.000Z')
      })
      const stored = JSON.parse(localStorage.getItem('remember-me-state')!)
      expect(stored.answers['q-a'].audioId).toBe('aud-persist')
    })

    it('stores audioTranscript when provided', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
      act(() => {
        result.current.setAnswerAudio('q-a', 'childhood', 'aud-001', '2024-06-01T10:00:00.000Z', 'Ich wuchs in München auf.')
      })
      expect(result.current.answers['q-a'].audioTranscript).toBe('Ich wuchs in München auf.')
    })

    it('stores transcript without audioId (transcript-only mode)', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
      act(() => {
        result.current.setAnswerAudio('q-a', 'childhood', undefined, '2024-06-01T10:00:00.000Z', 'Transkription ohne Audio-Datei')
      })
      expect(result.current.getAnswerAudioId('q-a')).toBeUndefined()
      expect(result.current.getAnswerTranscript('q-a')).toBe('Transkription ohne Audio-Datei')
    })

    it('preserves existing transcript when updating audioId without new transcript', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
      act(() => {
        result.current.setAnswerAudio('q-a', 'childhood', 'aud-001', '2024-06-01T10:00:00.000Z', 'Erste Transkription')
      })
      act(() => {
        result.current.setAnswerAudio('q-a', 'childhood', undefined, undefined)
      })
      expect(result.current.answers['q-a'].audioTranscript).toBe('Erste Transkription')
    })

    it('persists audioTranscript to localStorage', async () => {
      const { result } = renderHook(() => useAnswers())
      await waitFor(() => expect(result.current.isLoaded).toBe(true))
      act(() => {
        result.current.setAnswerAudio('q-a', 'childhood', 'aud-001', '2024-06-01T10:00:00.000Z', 'Gespeicherter Text')
      })
      const stored = JSON.parse(localStorage.getItem('remember-me-state')!)
      expect(stored.answers['q-a'].audioTranscript).toBe('Gespeicherter Text')
    })
  })
})

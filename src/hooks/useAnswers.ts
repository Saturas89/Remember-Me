import { useState, useCallback, useEffect } from 'react'
import { BACKUP_TYPE } from '../utils/export'
import type { Profile, AppState, Answer, Friend, FriendAnswer, AnswerExport, CustomQuestion, FriendAnswerZipPayload, OnlineSharingState } from '../types'

const STORAGE_KEY = 'remember-me-state'

async function loadStateAsync(): Promise<AppState> {
  // Wrap in Promise to ensure we don't block the main thread for large parses
  return new Promise((resolve) => {
    // Avoid setTimeout to prevent artificial delay, use Promise.resolve().then to defer
    Promise.resolve().then(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<AppState>
          resolve({
            profile: parsed.profile ?? null,
            answers: parsed.answers ?? {},
            friends: parsed.friends ?? [],
            friendAnswers: parsed.friendAnswers ?? [],
            customQuestions: parsed.customQuestions ?? [],
            onlineSharing: parsed.onlineSharing, // undefined unless opted in
          })
          return
        }
      } catch {
        // ignore corrupt data
      }
      resolve({ profile: null, answers: {}, friends: [], friendAnswers: [], customQuestions: [] })
    })
  })
}

function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (err) {
    // Most commonly QuotaExceededError – avoid crashing the setState
    // callback, but make the failure visible in the console so users
    // can report storage-full issues.
    console.error('remember-me: failed to persist state', err)
  }
}

export function useAnswers() {
  const [isLoaded, setIsLoaded] = useState(false)
  const [state, setState] = useState<AppState>({ profile: null, answers: {}, friends: [], friendAnswers: [], customQuestions: [] })

  useEffect(() => {
    loadStateAsync().then((loaded) => {
      setState(loaded)
      setIsLoaded(true)
    })
  }, [])

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
            ...existing,
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

  const setAnswerImages = useCallback((questionId: string, categoryId: string, imageIds: string[]) => {
    setState(prev => {
      const existing = prev.answers[questionId]
      const now = new Date().toISOString()
      const next: AppState = {
        ...prev,
        answers: {
          ...prev.answers,
          [questionId]: {
            ...existing,
            id: questionId,
            questionId,
            categoryId,
            value: existing?.value ?? '',
            imageIds,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
          },
        },
      }
      saveState(next)
      return next
    })
  }, [])

  const setAnswerVideos = useCallback((questionId: string, categoryId: string, videoIds: string[]) => {
    setState(prev => {
      const existing = prev.answers[questionId]
      const now = new Date().toISOString()
      const next: AppState = {
        ...prev,
        answers: {
          ...prev.answers,
          [questionId]: {
            ...existing,
            id: questionId,
            questionId,
            categoryId,
            value: existing?.value ?? '',
            videoIds,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
          },
        },
      }
      saveState(next)
      return next
    })
  }, [])

  const setAnswerAudio = useCallback((
    questionId: string,
    categoryId: string,
    audioId: string | undefined,
    audioTranscribedAt: string | undefined,
    audioTranscript?: string,
  ) => {
    setState(prev => {
      const existing = prev.answers[questionId]
      const now = new Date().toISOString()
      const next: AppState = {
        ...prev,
        answers: {
          ...prev.answers,
          [questionId]: {
            ...existing,
            id: questionId,
            questionId,
            categoryId,
            value: existing?.value ?? '',
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
            audioId,
            audioTranscribedAt,
            audioTranscript: audioTranscript ?? existing?.audioTranscript,
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

  const addFriend = useCallback((
    name: string,
    id?: string,
    online?: Friend['online'],
  ): Friend => {
    const friend: Friend = {
      id: id ?? `friend-${Date.now()}-${crypto.randomUUID()}`,
      name: name.trim(),
      addedAt: new Date().toISOString(),
      ...(online ? { online } : {}),
    }
    setState(prev => {
      // If a friend with the same online.deviceId already exists, update in
      // place rather than duplicating – contact handshakes can be re-opened.
      if (online) {
        const existing = prev.friends.find(f => f.online?.deviceId === online.deviceId)
        if (existing) {
          const next: AppState = {
            ...prev,
            friends: prev.friends.map(f =>
              f.online?.deviceId === online.deviceId
                ? { ...f, name: friend.name, online: { ...f.online, ...online } }
                : f,
            ),
          }
          saveState(next)
          return next
        }
      }
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
          questionText: a.questionText,
          value: a.value,
          createdAt: now,
        }))
      // Replace any previous answers from this friend
      const filtered = prev.friendAnswers.filter(a => a.friendId !== data.friendId)

      // Auto-create a Friend entry when we don't know this friend yet.
      // This is the common path now that the invite link is generic: the
      // inviter doesn't enter the friend's name up-front – it arrives with
      // the answer bundle.
      let friends = prev.friends
      const existing = friends.find(f => f.id === data.friendId)
      if (!existing) {
        friends = [
          ...friends,
          {
            id: data.friendId,
            name: data.friendName || 'Anonym',
            addedAt: now,
          },
        ]
      } else if (data.friendName && existing.name !== data.friendName) {
        // Update the stored name if the friend resubmitted under a different name.
        friends = friends.map(f =>
          f.id === data.friendId ? { ...f, name: data.friendName } : f,
        )
      }

      const next: AppState = {
        ...prev,
        friends,
        friendAnswers: [...filtered, ...newAnswers],
      }
      saveState(next)
      return next
    })
  }, [])

  /** Import friend answers that arrived as a ZIP (with media IDs already remapped). */
  const importFriendAnswerZipData = useCallback((payload: FriendAnswerZipPayload) => {
    setState(prev => {
      const now = new Date().toISOString()
      const newAnswers: FriendAnswer[] = payload.answers
        .filter(a => a.value.trim() || a.imageFiles?.length || a.audioFile || a.videoFiles?.length)
        .map(a => ({
          id: `${payload.friendId}-${a.questionId}`,
          friendId: payload.friendId,
          friendName: payload.friendName,
          questionId: a.questionId,
          questionText: a.questionText,
          value: a.value,
          imageIds: a.imageFiles?.length ? a.imageFiles : undefined,
          videoIds: a.videoFiles?.length ? a.videoFiles : undefined,
          audioId: a.audioFile,
          createdAt: now,
        }))
      const filtered = prev.friendAnswers.filter(a => a.friendId !== payload.friendId)

      let friends = prev.friends
      const existing = friends.find(f => f.id === payload.friendId)
      if (!existing) {
        friends = [
          ...friends,
          { id: payload.friendId, name: payload.friendName || 'Anonym', addedAt: now },
        ]
      } else if (payload.friendName && existing.name !== payload.friendName) {
        friends = friends.map(f =>
          f.id === payload.friendId ? { ...f, name: payload.friendName } : f,
        )
      }

      const next: AppState = { ...prev, friends, friendAnswers: [...filtered, ...newAnswers] }
      saveState(next)
      return next
    })
  }, [])

  // ── Custom questions ─────────────────────────────────────

  const addCustomQuestion = useCallback((
    text: string,
    type: CustomQuestion['type'] = 'text',
    helpText?: string,
    options?: string[],
  ): CustomQuestion => {
    const q: CustomQuestion = {
      id: `cq-${Date.now()}-${crypto.randomUUID()}`,
      text: text.trim(),
      type,
      helpText,
      options,
      createdAt: new Date().toISOString(),
    }
    setState(prev => {
      const next: AppState = { ...prev, customQuestions: [...prev.customQuestions, q] }
      saveState(next)
      return next
    })
    return q
  }, [])

  const removeCustomQuestion = useCallback((id: string) => {
    setState(prev => {
      const next: AppState = {
        ...prev,
        customQuestions: prev.customQuestions.filter(q => q.id !== id),
      }
      saveState(next)
      return next
    })
  }, [])

  /** Import a question pack – skip questions already present (by text match) */
  const importCustomQuestions = useCallback((incoming: CustomQuestion[]) => {
    setState(prev => {
      const existingTexts = new Set(prev.customQuestions.map(q => q.text.trim().toLowerCase()))
      const toAdd = incoming.filter(q => !existingTexts.has(q.text.trim().toLowerCase()))
      if (toAdd.length === 0) return prev
      const next: AppState = {
        ...prev,
        customQuestions: [...prev.customQuestions, ...toAdd],
      }
      saveState(next)
      return next
    })
  }, [])

  /** Import a batch of social-media entries as custom questions + answers in one transaction */
  const importSocialMediaEntries = useCallback((
    entries: Array<{
      questionText: string
      description: string
      imageIds: string[]
      eventDate?: string
      importSource?: Answer['importSource']
    }>
  ) => {
    setState(prev => {
      let next = prev
      const now = new Date().toISOString()
      for (const entry of entries) {
        const qid = `imp-${Date.now()}-${crypto.randomUUID()}`
        const q: CustomQuestion = {
          id: qid,
          text: entry.questionText || 'Importierte Erinnerung',
          type: 'text',
          createdAt: now,
        }
        const answer: Answer = {
          id: qid,
          questionId: qid,
          categoryId: 'custom',
          value: entry.description,
          imageIds: entry.imageIds.length > 0 ? entry.imageIds : undefined,
          createdAt: entry.eventDate ?? now,
          updatedAt: now,
          eventDate: entry.eventDate,
          importSource: entry.importSource,
        }
        next = {
          ...next,
          customQuestions: [...next.customQuestions, q],
          answers: { ...next.answers, [qid]: answer },
        }
      }
      saveState(next)
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    const fresh: AppState = {
      profile: null,
      answers: {},
      friends: [],
      friendAnswers: [],
      customQuestions: [],
    }
    saveState(fresh)
    setState(fresh)
  }, [])

  // ── Online sharing opt-in ────────────────────────────────────
  //
  // Persistence only. Actually talking to Supabase happens in a lazy-loaded
  // module that is only imported when onlineSharing.enabled === true. See
  // useOnlineSync / supabaseClient.

  const setOnlineSharing = useCallback((patch: Partial<OnlineSharingState> | undefined) => {
    setState(prev => {
      const next: AppState = {
        ...prev,
        onlineSharing: patch
          ? { ...(prev.onlineSharing ?? { enabled: false }), ...patch }
          : undefined,
      }
      saveState(next)
      return next
    })
  }, [])

  const enableOnlineSharing = useCallback(() => {
    setOnlineSharing({ enabled: true, activatedAt: new Date().toISOString() })
  }, [setOnlineSharing])

  const disableOnlineSharing = useCallback(() => {
    // Clears the whole block so no stale deviceId/publicKey remains. Caller
    // is responsible for asking the server to delete the corresponding rows
    // + for clearing the local device-key IndexedDB.
    setOnlineSharing(undefined)
  }, [setOnlineSharing])

  // Remove all friends that were linked online (leaves offline-only friends
  // and their answers untouched). Used when the user deactivates sharing.
  const removeOnlineFriends = useCallback(() => {
    setState(prev => {
      const onlineIds = new Set(prev.friends.filter(f => f.online).map(f => f.id))
      if (onlineIds.size === 0) return prev
      const next: AppState = {
        ...prev,
        friends: prev.friends.filter(f => !onlineIds.has(f.id)),
        friendAnswers: prev.friendAnswers.filter(a => !onlineIds.has(a.friendId)),
      }
      saveState(next)
      return next
    })
  }, [])

  /** Restore a full backup created by exportAsBackup() */
  const restoreBackup = useCallback((json: string): { ok: boolean; error?: string } => {
    try {
      const parsed = JSON.parse(json) as Record<string, unknown>
      if (parsed.$type !== BACKUP_TYPE) {
        return { ok: false, error: 'Unbekanntes Dateiformat. Bitte eine Backup-Datei von Remember Me verwenden.' }
      }
      const s = (parsed.state ?? {}) as Partial<AppState>
      const restored: AppState = {
        profile: s.profile ?? null,
        answers: s.answers ?? {},
        friends: s.friends ?? [],
        friendAnswers: s.friendAnswers ?? [],
        customQuestions: s.customQuestions ?? [],
      }
      saveState(restored)
      setState(restored)
      return { ok: true }
    } catch {
      return { ok: false, error: 'Die Datei konnte nicht gelesen werden. Ist es eine gültige Backup-Datei?' }
    }
  }, [])

  // ── Derived helpers ──────────────────────────────────────

  const getAnswer = useCallback(
    (questionId: string): string => state.answers[questionId]?.value ?? '',
    [state.answers],
  )

  const getAnswerImageIds = useCallback(
    (questionId: string): string[] => state.answers[questionId]?.imageIds ?? [],
    [state.answers],
  )

  const getAnswerVideoIds = useCallback(
    (questionId: string): string[] => state.answers[questionId]?.videoIds ?? [],
    [state.answers],
  )

  const getAnswerAudioId = useCallback(
    (questionId: string): string | undefined => state.answers[questionId]?.audioId,
    [state.answers],
  )

  const getAnswerTranscript = useCallback(
    (questionId: string): string | undefined => state.answers[questionId]?.audioTranscript,
    [state.answers],
  )

  const getCategoryProgress = useCallback(
    (categoryId: string, totalQuestions: number): number => {
      const answered = Object.values(state.answers).filter(
        a =>
          a.categoryId === categoryId &&
          (a.value.trim() !== '' ||
           (a.imageIds?.length ?? 0) > 0 ||
           (a.videoIds?.length ?? 0) > 0 ||
           !!a.audioId ||
           !!a.audioTranscript),
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
    isLoaded,
    profile: state.profile,
    answers: state.answers,
    friends: state.friends,
    friendAnswers: state.friendAnswers,
    customQuestions: state.customQuestions,
    onlineSharing: state.onlineSharing,
    saveAnswer,
    setAnswerImages,
    setAnswerVideos,
    setAnswerAudio,
    deleteAnswer,
    saveProfile,
    addFriend,
    removeFriend,
    importFriendAnswers,
    importFriendAnswerZipData,
    addCustomQuestion,
    removeCustomQuestion,
    importCustomQuestions,
    importSocialMediaEntries,
    clearAll,
    restoreBackup,
    enableOnlineSharing,
    disableOnlineSharing,
    setOnlineSharing,
    removeOnlineFriends,
    getAnswer,
    getAnswerImageIds,
    getAnswerVideoIds,
    getAnswerAudioId,
    getAnswerTranscript,
    getCategoryProgress,
    getFriendAnswers,
  }
}

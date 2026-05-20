// ── Auto-share queue (REQ-022) ───────────────────────────────────────────────
//
// Watches the user's Answers and the list of online Friends with
// `shareAll === true`. For every (answer, friend) pair that hasn't been
// shared yet (or whose answer was updated after the last share) it encrypts
// the memory and sends it via sharingService.shareMemoryToAllFriends().
//
// Idempotence: lives in IndexedDB (rm-share-log) keyed by `${answerId}-${friendDeviceId}`.
// Race-safety: brand-new friends get a 3 s debounce so a user accidentally
//   triggering the auto-accept can still uncheck "share all" before
//   their backlog goes out (REQ-022 §3 NFR + FR-22.11).
// Concurrency: a single in-flight slot. Failures back off 2 s → 4 s → 8 s →
//   16 s and after 4 attempts surrender; the next mount picks them up.

import { useEffect, useRef, useState } from 'react'
import type { Answer, Friend } from '../types'
import type { OnlineSyncAPI } from './useOnlineSync'
import type { Recipient } from '../utils/shareEncryption'
import { getShareLogEntry, setShareLogEntry } from '../utils/shareLogStore'

export interface UseAutoShareOptions {
  answers: Record<string, Answer>
  friends: Friend[]
  sync: OnlineSyncAPI
  ownerName: string
  enabled: boolean
  /** Resolves a human-readable question text for the given Answer. The hook
   *  doesn't know the question catalogue itself – callers in App.tsx pass
   *  a thin wrapper around CATEGORIES + customQuestions. */
  resolveQuestionText: (answer: Answer) => string
}

export interface UseAutoShareReturn {
  /** Approximate count of pairs still awaiting a share attempt. 0 means idle. */
  pending: number
  /** True while a backfill loop is actively processing pairs. */
  backfillInProgress: boolean
  /** Last error message bubbled up from sharingService, or null. */
  lastError: string | null
}

const NEW_FRIEND_DEBOUNCE_MS = 3_000
const RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 16_000]

export function useAutoShare(options: UseAutoShareOptions): UseAutoShareReturn {
  const [pending, setPending] = useState(0)
  const [backfillInProgress, setBackfillInProgress] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)

  // Mirror options through a ref so the async drain loop always sees the
  // latest values without becoming a useEffect dep itself.
  const optsRef = useRef(options)
  optsRef.current = options

  const inflightRef = useRef(false)
  const cancelledRef = useRef(false)
  // Null = first run; never debounce existing friends, only fresh additions.
  const knownFriendsRef = useRef<Set<string> | null>(null)
  const debounceTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    const { answers, friends, sync, enabled } = options
    if (!enabled || !sync.ready || !sync.service) return

    cancelledRef.current = false

    const drain = async () => {
      if (inflightRef.current) return
      inflightRef.current = true
      setBackfillInProgress(true)
      try {
        while (!cancelledRef.current) {
          const o = optsRef.current
          const active = o.friends.filter(f => f.online && f.online.shareAll === true)
          if (active.length === 0) break

          const next = await findNextPair(o.answers, active)
          if (!next || cancelledRef.current) break

          const recipient: Recipient = {
            deviceId: next.friend.online!.deviceId,
            publicKey: next.friend.online!.publicKey,
          }

          let succeeded = false
          let lastErr: Error | null = null
          for (let attempt = 0; attempt < RETRY_DELAYS_MS.length + 1; attempt++) {
            if (cancelledRef.current) break
            try {
              await o.sync.service!.shareMemoryToAllFriends(
                next.answer,
                o.resolveQuestionText(next.answer),
                [recipient],
                o.ownerName,
              )
              succeeded = true
              break
            } catch (err) {
              lastErr = err as Error
              if (attempt >= RETRY_DELAYS_MS.length) break
              await wait(RETRY_DELAYS_MS[attempt])
            }
          }

          if (succeeded) {
            await setShareLogEntry(
              next.answer.id,
              next.friend.online!.deviceId,
              new Date().toISOString(),
            )
            setLastError(null)
          } else if (lastErr) {
            setLastError(lastErr.message)
            // Stop the queue: the next mount / state change re-tries.
            break
          }
        }
      } finally {
        inflightRef.current = false
        setBackfillInProgress(false)
      }
    }

    // New-friend debounce: schedule a drain 3 s after a friend becomes
    // shareAll=true. Existing friends from prior renders are exempt.
    const activeNowIds = new Set(
      friends.filter(f => f.online?.shareAll === true).map(f => f.online!.deviceId),
    )
    if (knownFriendsRef.current === null) {
      knownFriendsRef.current = activeNowIds
    } else {
      for (const did of activeNowIds) {
        if (knownFriendsRef.current.has(did)) continue
        if (debounceTimersRef.current.has(did)) continue
        const timer = setTimeout(() => {
          debounceTimersRef.current.delete(did)
          void drain()
        }, NEW_FRIEND_DEBOUNCE_MS)
        debounceTimersRef.current.set(did, timer)
      }
      knownFriendsRef.current = activeNowIds
    }

    // Always try to drain on every relevant render. Drain bails early if
    // a queue is already running.
    void drain()

    // Approximate pending counter (FR-22 reporting only). Each render
    // re-counts (answers × shareAll-friends) sans share-log check, which
    // would require IndexedDB hits per render. Good-enough for UI.
    let canceled = false
    void (async () => {
      let count = 0
      for (const ans of Object.values(answers)) {
        if (!ans.value || !ans.value.trim()) continue
        for (const f of friends) {
          if (!f.online || f.online.shareAll !== true) continue
          const last = await getShareLogEntry(ans.id, f.online.deviceId)
          if (last === null || last < ans.updatedAt) count++
          if (canceled) return
        }
      }
      if (!canceled) setPending(count)
    })()

    return () => {
      canceled = true
      cancelledRef.current = true
    }
    // sync.service is a module reference – stable for the lifetime of the
    // hook once ready, so listing it here is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.answers, options.friends, options.enabled, options.sync.ready, options.sync.service, options.ownerName])

  // Cleanup debounce timers on unmount.
  useEffect(() => {
    return () => {
      for (const t of debounceTimersRef.current.values()) clearTimeout(t)
      debounceTimersRef.current.clear()
    }
  }, [])

  return { pending, backfillInProgress, lastError }
}

async function findNextPair(
  answers: Record<string, Answer>,
  activeFriends: Friend[],
): Promise<{ answer: Answer; friend: Friend } | null> {
  for (const ans of Object.values(answers)) {
    if (!ans.value || !ans.value.trim()) continue
    for (const friend of activeFriends) {
      const did = friend.online!.deviceId
      const last = await getShareLogEntry(ans.id, did)
      if (last !== null && last >= ans.updatedAt) continue
      return { answer: ans, friend }
    }
  }
  return null
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

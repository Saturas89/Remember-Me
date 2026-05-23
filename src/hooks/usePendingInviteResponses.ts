// ── Sandra-side polling: auto-add Ingrid once she accepts ────────────────────
//
// After Sandra shares a /join/CODE invite, this hook polls Supabase every
// 5 minutes (and on mount) to check whether a response appeared.
// When found, `addFriend` is called automatically and the code is marked done.

import { useEffect } from 'react'
import type { Friend } from '../types'
import { getPendingInvites, markInviteResponded, cleanupExpiredInvites } from '../utils/inviteLogStore'

type AddFriendFn = (
  name: string,
  inviteCode: undefined,
  online: NonNullable<Friend['online']>,
) => void

const POLL_INTERVAL_MS = 5 * 60 * 1000

export function usePendingInviteResponses(
  enabled: boolean,
  addFriend: AddFriendFn,
): void {
  useEffect(() => {
    if (!enabled) return

    async function checkResponses() {
      try {
        await cleanupExpiredInvites()
        const pending = await getPendingInvites()
        if (pending.length === 0) return

        const { pollInviteResponse } = await import('../utils/inviteService')
        for (const { code } of pending) {
          try {
            const response = await pollInviteResponse(code)
            if (!response) continue
            addFriend(response.displayName || 'Kontakt', undefined, {
              deviceId: response.deviceId,
              publicKey: response.publicKey,
              linkedAt: new Date().toISOString(),
              shareAll: true,
            })
            await markInviteResponded(code)
          } catch {
            // individual poll failure – skip and retry next cycle
          }
        }
      } catch {
        // store read failure – skip silently
      }
    }

    checkResponses()
    const interval = setInterval(checkResponses, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [enabled]) // eslint-disable-line react-hooks/exhaustive-deps
}

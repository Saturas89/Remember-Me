import type { AppState, Answer } from '../types'

function newerTimestamp(a: string | undefined, b: string | undefined): boolean {
  if (!a && !b) return false
  if (!a) return false
  if (!b) return true
  return a > b
}

function mergeAnswers(
  local: Record<string, Answer>,
  remote: Record<string, Answer>,
): Record<string, Answer> {
  const allIds = new Set([...Object.keys(local), ...Object.keys(remote)])
  const result: Record<string, Answer> = {}
  for (const id of allIds) {
    const l = local[id]
    const r = remote[id]
    if (!l) { result[id] = r; continue }
    if (!r) { result[id] = l; continue }
    // tie → remote wins (deterministic)
    result[id] = r.updatedAt >= l.updatedAt ? r : l
  }
  return result
}

/**
 * Union-merge two id-keyed collections. Items present only on the remote side
 * are appended so a freshly set-up device actually receives them; on an id
 * clash the local item wins (these records carry no `updatedAt`, and local is
 * the device the user is actively editing). Local order is preserved, with
 * remote-only items appended in remote order for determinism.
 *
 * NOTE: without tombstones this cannot propagate deletions — a record removed
 * on one device reappears from the other on the next sync. That is an accepted
 * trade-off versus the previous "local always wins" behaviour, which dropped
 * remote additions entirely (e.g. a new device synced zero friends / custom
 * questions, orphaning every answer that referenced a custom question).
 */
function mergeById<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const localIds = new Set(local.map(item => item.id))
  const result = [...local]
  for (const item of remote) {
    if (!localIds.has(item.id)) result.push(item)
  }
  return result
}

export function mergeStates(local: AppState, remote: AppState): AppState {
  const mergedAnswers = mergeAnswers(local.answers, remote.answers)

  const localProfileTs = local.profile?.updatedAt ?? local.profile?.createdAt
  const remoteProfileTs = remote.profile?.updatedAt ?? remote.profile?.createdAt
  const remoteProfileNewer =
    remote.profile !== null &&
    remote.profile !== undefined &&
    newerTimestamp(remoteProfileTs, localProfileTs)

  return {
    ...local,
    profile: remoteProfileNewer ? remote.profile : local.profile,
    answers: mergedAnswers,
    // Union-merge content collections so a new device receives remote items
    // instead of silently keeping its (empty) local set.
    friends: mergeById(local.friends, remote.friends),
    friendAnswers: mergeById(local.friendAnswers, remote.friendAnswers),
    customQuestions: mergeById(local.customQuestions, remote.customQuestions),
    // Device-local config stays local: online-sharing carries this device's
    // keypair, streak is per-device engagement, privateSync is this device's
    // provider setup.
    onlineSharing: local.onlineSharing,
    streak: local.streak,
    privateSync: local.privateSync,
  }
}

import type { AppState, Answer, DeletionTombstones } from '../types'

type TombstoneMap = Record<string, string>

function newerTimestamp(a: string | undefined, b: string | undefined): boolean {
  if (!a && !b) return false
  if (!a) return false
  if (!b) return true
  return a > b
}

/** Union two tombstone maps, keeping the latest deletion timestamp per id. */
function mergeTombstones(a: TombstoneMap = {}, b: TombstoneMap = {}): TombstoneMap {
  const out: TombstoneMap = { ...a }
  for (const [id, ts] of Object.entries(b)) {
    if (!out[id] || ts > out[id]) out[id] = ts
  }
  return out
}

/**
 * True when a tombstone for `id` should suppress a record whose own timestamp
 * is `recordTs`. A record survives a tombstone only if it was (re-)created or
 * edited strictly after the deletion — that is the "resurrection by edit" path
 * (the user re-added / re-answered after deleting).
 */
function isDeleted(tombstones: TombstoneMap, id: string, recordTs: string | undefined): boolean {
  const deletedAt = tombstones[id]
  if (!deletedAt) return false
  return !(recordTs !== undefined && recordTs > deletedAt)
}

function mergeAnswers(
  local: Record<string, Answer>,
  remote: Record<string, Answer>,
  tombstones: TombstoneMap,
): Record<string, Answer> {
  const allIds = new Set([...Object.keys(local), ...Object.keys(remote)])
  const result: Record<string, Answer> = {}
  for (const id of allIds) {
    const l = local[id]
    const r = remote[id]
    // tie → remote wins (deterministic)
    const winner = !l ? r : !r ? l : r.updatedAt >= l.updatedAt ? r : l
    if (isDeleted(tombstones, id, winner.updatedAt)) continue
    result[id] = winner
  }
  return result
}

/**
 * Union-merge two id-keyed collections. Items present only on the remote side
 * are appended so a freshly set-up device actually receives them. Local order
 * is preserved, with remote-only items appended in remote order for
 * determinism.
 *
 * On an id clash the side with the newer `createdAtOf` wins; ties keep the
 * local item. These records have no `updatedAt`, so `createdAtOf` is the only
 * recency signal — and for records that are *replaced* on edit (notably
 * `friendAnswer`, whose id is the deterministic `friendId-questionId` and whose
 * `createdAt` is re-stamped on every (re-)import) it is exactly the right one:
 * a friend's corrected resubmission imported on device A then propagates to
 * device B instead of B silently keeping its stale copy forever. For records
 * whose `createdAt` never changes after creation (`friend.addedAt`,
 * `customQuestion.createdAt`) the timestamps are equal, so the tie-break keeps
 * local and behaviour is unchanged.
 *
 * Deletions propagate via tombstones: an item is dropped when a tombstone for
 * its id exists, unless the item's own creation timestamp is newer than the
 * deletion (re-added after delete). `createdAtOf` extracts that timestamp.
 */
function mergeById<T extends { id: string }>(
  local: T[],
  remote: T[],
  tombstones: TombstoneMap,
  createdAtOf: (item: T) => string | undefined,
): T[] {
  const byId = new Map<string, T>()
  // Local first so it holds the slot (and its insertion order); a remote item
  // only displaces it on clash when strictly newer, and Map.set preserves the
  // existing key's position. Remote-only items are appended in remote order.
  for (const item of local) if (!byId.has(item.id)) byId.set(item.id, item)
  for (const item of remote) {
    const existing = byId.get(item.id)
    if (!existing) byId.set(item.id, item)
    else if (newerTimestamp(createdAtOf(item), createdAtOf(existing))) byId.set(item.id, item)
  }

  const result: T[] = []
  for (const item of byId.values()) {
    if (isDeleted(tombstones, item.id, createdAtOf(item))) continue
    result.push(item)
  }
  return result
}

export function mergeStates(local: AppState, remote: AppState): AppState {
  const deletions: DeletionTombstones = {
    answers: mergeTombstones(local.deletions?.answers, remote.deletions?.answers),
    friends: mergeTombstones(local.deletions?.friends, remote.deletions?.friends),
    friendAnswers: mergeTombstones(local.deletions?.friendAnswers, remote.deletions?.friendAnswers),
    customQuestions: mergeTombstones(local.deletions?.customQuestions, remote.deletions?.customQuestions),
  }

  const mergedAnswers = mergeAnswers(local.answers, remote.answers, deletions.answers ?? {})

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
    // instead of silently keeping its (empty) local set; tombstones still
    // propagate deletions across devices.
    friends: mergeById(local.friends, remote.friends, deletions.friends ?? {}, f => f.addedAt),
    friendAnswers: mergeById(local.friendAnswers, remote.friendAnswers, deletions.friendAnswers ?? {}, a => a.createdAt),
    customQuestions: mergeById(local.customQuestions, remote.customQuestions, deletions.customQuestions ?? {}, q => q.createdAt),
    deletions,
    // Device-local config stays local: online-sharing carries this device's
    // keypair, streak is per-device engagement, privateSync is this device's
    // provider setup.
    onlineSharing: local.onlineSharing,
    streak: local.streak,
    privateSync: local.privateSync,
  }
}

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

export function mergeStates(local: AppState, remote: AppState): AppState {
  const mergedAnswers = mergeAnswers(local.answers, remote.answers)

  const remoteProfileNewer =
    remote.profile?.createdAt !== undefined &&
    newerTimestamp(remote.profile.createdAt, local.profile?.createdAt)

  return {
    ...local,
    profile: remoteProfileNewer ? remote.profile : local.profile,
    answers: mergedAnswers,
    friends: local.friends,
    friendAnswers: local.friendAnswers,
    customQuestions: local.customQuestions,
    onlineSharing: local.onlineSharing,
    streak: local.streak,
    privateSync: local.privateSync,
  }
}

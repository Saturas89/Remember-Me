import type { DeletionTombstones } from '../types'

type Collection = keyof DeletionTombstones

/**
 * Return a new DeletionTombstones with `ids` recorded as deleted in `collection`
 * at timestamp `at`. Pure — never mutates the input. Producers call this on
 * delete so the merge can propagate the deletion to other devices instead of
 * letting them resurrect the record.
 */
export function recordDeletions(
  existing: DeletionTombstones | undefined,
  collection: Collection,
  ids: string[],
  at: string = new Date().toISOString(),
): DeletionTombstones {
  if (ids.length === 0) return existing ?? {}
  const next: DeletionTombstones = { ...existing }
  next[collection] = { ...(existing?.[collection] ?? {}) }
  for (const id of ids) next[collection]![id] = at
  return next
}

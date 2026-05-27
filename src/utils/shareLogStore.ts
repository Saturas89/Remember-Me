// ── Share log persistence (IndexedDB) ──────────────────────────────────────
//
// Per (answerId, friendDeviceId) we remember the lastSharedAt timestamp so
// the auto-share loop (REQ-022 §4.3 / FR-22.10) only re-encrypts when the
// underlying answer was updated after the last successful share.
//
// Cleared per-friend when the user pauses sharing for that contact
// (unshareAllWithFriend / FR-22.14) so a later toggle-on triggers a full
// backfill.

import { openIdb, idbGet, idbPut } from './idb'

const DB_NAME = 'rm-share-log'
const STORE = 'share-log'

function buildKey(answerId: string, friendDeviceId: string): string {
  return `${answerId}-${friendDeviceId}`
}

interface StoredEntry {
  lastSharedAt: string
}

export async function getShareLogEntry(
  answerId: string,
  friendDeviceId: string,
): Promise<string | null> {
  const db = await openIdb(DB_NAME, STORE)
  try {
    const entry = await idbGet<StoredEntry>(db, STORE, buildKey(answerId, friendDeviceId))
    return entry ? entry.lastSharedAt : null
  } finally {
    db.close()
  }
}

export async function setShareLogEntry(
  answerId: string,
  friendDeviceId: string,
  lastSharedAt: string,
): Promise<void> {
  const db = await openIdb(DB_NAME, STORE)
  try {
    await idbPut(db, STORE, { lastSharedAt } satisfies StoredEntry, buildKey(answerId, friendDeviceId))
  } finally {
    db.close()
  }
}

export async function deleteShareLogForFriend(
  friendDeviceId: string,
): Promise<void> {
  const db = await openIdb(DB_NAME, STORE)
  try {
    // Suffix match on the synthetic key. The keyset is small (#answers per
    // device × #friends) and only ever scanned on user-initiated pause, so a
    // linear cursor is fine.
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      const req = store.openCursor()
      const suffix = `-${friendDeviceId}`
      req.onsuccess = () => {
        const cursor = req.result
        if (!cursor) {
          resolve()
          return
        }
        const key = String(cursor.key)
        if (key.endsWith(suffix)) cursor.delete()
        cursor.continue()
      }
      req.onerror = () => reject(req.error)
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

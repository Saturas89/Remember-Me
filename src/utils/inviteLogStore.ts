// ── Pending invite log (IndexedDB) ──────────────────────────────────────────
//
// After Sandra creates a /join/CODE invite she stores the code here so the
// usePendingInviteResponses hook can poll Supabase and auto-add Ingrid once
// she accepts. Entries are cleaned up after 30 days (matching invite expiry).

import { openIdb, idbGet, idbPut, idbGetAll } from './idb'

const DB_NAME = 'rm-invite-log'
const STORE = 'pending-invites'
const EXPIRY_DAYS = 30

interface StoredInvite {
  code: string
  createdAt: string
  respondedAt?: string
}

export async function storePendingInvite(code: string): Promise<void> {
  const db = await openIdb(DB_NAME, STORE, 'code')
  try {
    await idbPut(db, STORE, { code, createdAt: new Date().toISOString() } satisfies StoredInvite)
  } finally {
    db.close()
  }
}

export async function getPendingInvites(): Promise<StoredInvite[]> {
  const db = await openIdb(DB_NAME, STORE, 'code')
  try {
    const all = await idbGetAll<StoredInvite>(db, STORE)
    return all.filter(r => !r.respondedAt)
  } finally {
    db.close()
  }
}

export async function markInviteResponded(code: string): Promise<void> {
  const db = await openIdb(DB_NAME, STORE, 'code')
  try {
    const existing = await idbGet<StoredInvite>(db, STORE, code)
    if (!existing) return
    await idbPut(db, STORE, { ...existing, respondedAt: new Date().toISOString() })
  } finally {
    db.close()
  }
}

export async function cleanupExpiredInvites(): Promise<void> {
  const cutoff = new Date(Date.now() - EXPIRY_DAYS * 24 * 3600 * 1000).toISOString()
  const db = await openIdb(DB_NAME, STORE, 'code')
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      const req = store.openCursor()
      req.onsuccess = () => {
        const cursor = req.result
        if (!cursor) { resolve(); return }
        const entry = cursor.value as StoredInvite
        if (entry.createdAt < cutoff) cursor.delete()
        cursor.continue()
      }
      req.onerror = () => reject(req.error)
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

// ── Pending invite log (IndexedDB) ──────────────────────────────────────────
//
// After Sandra creates a /join/CODE invite she stores the code here so the
// usePendingInviteResponses hook can poll Supabase and auto-add Ingrid once
// she accepts. Entries are cleaned up after 30 days (matching invite expiry).

const DB_NAME = 'rm-invite-log'
const STORE = 'pending-invites'
const EXPIRY_DAYS = 30

interface StoredInvite {
  code: string
  createdAt: string
  respondedAt?: string
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'code' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function storePendingInvite(code: string): Promise<void> {
  const db = await openDB()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const entry: StoredInvite = { code, createdAt: new Date().toISOString() }
      const req = tx.objectStore(STORE).put(entry)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

export async function getPendingInvites(): Promise<StoredInvite[]> {
  const db = await openDB()
  try {
    return await new Promise<StoredInvite[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).getAll()
      req.onsuccess = () => resolve((req.result as StoredInvite[]).filter(r => !r.respondedAt))
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

export async function markInviteResponded(code: string): Promise<void> {
  const db = await openDB()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      const getReq = store.get(code)
      getReq.onsuccess = () => {
        const existing = getReq.result as StoredInvite | undefined
        if (!existing) { resolve(); return }
        const putReq = store.put({ ...existing, respondedAt: new Date().toISOString() })
        putReq.onsuccess = () => resolve()
        putReq.onerror = () => reject(putReq.error)
      }
      getReq.onerror = () => reject(getReq.error)
    })
  } finally {
    db.close()
  }
}

export async function cleanupExpiredInvites(): Promise<void> {
  const cutoff = new Date(Date.now() - EXPIRY_DAYS * 24 * 3600 * 1000).toISOString()
  const db = await openDB()
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

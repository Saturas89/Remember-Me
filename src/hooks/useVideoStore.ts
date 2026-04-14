const DB_NAME = 'rm-videos'
const STORE   = 'videos'

// Module-level lazy-opened DB connection
let dbPromise: Promise<IDBDatabase> | null = null

function getDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror  = () => { dbPromise = null; reject(req.error) }
    })
  }
  return dbPromise
}

export async function addVideo(blob: Blob): Promise<string> {
  const id = `vid-${Date.now()}-${crypto.randomUUID()}`
  const db = await getDB()
  await new Promise<void>((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).put(blob, id)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
  return id
}

export async function getVideoBlob(id: string): Promise<Blob | null> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id)
    req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null)
    req.onerror   = () => reject(req.error)
  })
}

export async function removeVideo(id: string): Promise<void> {
  const db = await getDB()
  await new Promise<void>((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

/** Restore a video blob with its original ID (used during archive import). */
export async function putVideoById(id: string, blob: Blob): Promise<void> {
  const db = await getDB()
  await new Promise<void>((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).put(blob, id)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

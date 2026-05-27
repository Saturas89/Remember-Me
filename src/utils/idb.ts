// ── Shared IndexedDB primitives ───────────────────────────────────────────────
//
// Two open strategies:
//  - makeIdbSingleton  lazy module-level connection with error recovery; for
//                      high-frequency stores that stay open for the session
//                      (audio, video, images).
//  - openIdb           fresh connection per call; caller must call db.close();
//                      for low-frequency stores (shareLog, inviteLog).
//
// Generic CRUD wrappers (idbGet/idbPut/idbDelete/idbGetAll) remove the
// onsuccess/onerror boilerplate that was repeated across all six IDB modules.

/** Creates a lazy singleton DB connection.  getDB() re-opens automatically after
 *  an error, so callers never have to manage the lifetime. */
export function makeIdbSingleton(
  dbName: string,
  storeName: string,
  keyPath?: string,
): { getDB(): Promise<IDBDatabase> } {
  let dbPromise: Promise<IDBDatabase> | null = null
  return {
    getDB() {
      if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
          const req = indexedDB.open(dbName, 1)
          req.onupgradeneeded = () => {
            keyPath
              ? req.result.createObjectStore(storeName, { keyPath })
              : req.result.createObjectStore(storeName)
          }
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => { dbPromise = null; reject(req.error) }
        })
      }
      return dbPromise
    },
  }
}

/** Opens a fresh IDB connection (borrow style).  Caller is responsible for
 *  calling db.close() when done. */
export function openIdb(
  dbName: string,
  storeName: string,
  keyPath?: string,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1)
    req.onupgradeneeded = () => {
      keyPath
        ? req.result.createObjectStore(storeName, { keyPath })
        : req.result.createObjectStore(storeName)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Get a single value from a store by key. */
export function idbGet<T>(db: IDBDatabase, store: string, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

/** Put a value into a store.  When `key` is omitted the store's keyPath is used. */
export function idbPut(db: IDBDatabase, store: string, value: unknown, key?: IDBValidKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    const req = key !== undefined
      ? tx.objectStore(store).put(value, key)
      : tx.objectStore(store).put(value)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/** Delete a single entry by key. */
export function idbDelete(db: IDBDatabase, store: string, key: IDBValidKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readwrite').objectStore(store).delete(key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/** Return all values from a store. */
export function idbGetAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).getAll()
    req.onsuccess = () => resolve(req.result as T[])
    req.onerror = () => reject(req.error)
  })
}

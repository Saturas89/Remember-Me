import { useState, useCallback, useRef } from 'react'

const DB_NAME = 'rm-images'
const STORE = 'images'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function idbGet(db: IDBDatabase, id: string): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(id)
    req.onsuccess = () => resolve(req.result as string | undefined)
    req.onerror = () => reject(req.error)
  })
}

function idbPut(db: IDBDatabase, id: string, value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).put(value, id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

function idbDelete(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

function compressImage(file: File, maxDim = 1200, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Bild konnte nicht geladen werden'))
    }
    img.src = url
  })
}

export function useImageStore() {
  // cacheRef is the source of truth; cache state is only for triggering re-renders
  const cacheRef = useRef<Record<string, string>>({})
  const [cache, setCache] = useState<Record<string, string>>({})
  const dbRef = useRef<IDBDatabase | null>(null)
  const pendingRef = useRef(new Set<string>())

  async function getDB() {
    if (!dbRef.current) dbRef.current = await openDB()
    return dbRef.current
  }

  function pushToCache(entries: Record<string, string>) {
    Object.assign(cacheRef.current, entries)
    setCache({ ...cacheRef.current })
  }

  const loadImages = useCallback(async (ids: string[]) => {
    const toLoad = ids.filter(id => !cacheRef.current[id] && !pendingRef.current.has(id))
    if (toLoad.length === 0) return
    toLoad.forEach(id => pendingRef.current.add(id))
    try {
      const db = await getDB()
      const results: Record<string, string> = {}
      await Promise.all(
        toLoad.map(async id => {
          const val = await idbGet(db, id)
          if (val) results[id] = val
        }),
      )
      if (Object.keys(results).length > 0) pushToCache(results)
    } finally {
      toLoad.forEach(id => pendingRef.current.delete(id))
    }
  }, []) // stable – uses only refs

  const addImage = useCallback(async (file: File): Promise<string> => {
    const dataUrl = await compressImage(file)
    const id = `img-${Date.now()}-${crypto.randomUUID()}`
    const db = await getDB()
    await idbPut(db, id, dataUrl)
    pushToCache({ [id]: dataUrl })
    return id
  }, [])

  const removeImage = useCallback(async (id: string) => {
    const db = await getDB()
    await idbDelete(db, id)
    delete cacheRef.current[id]
    setCache({ ...cacheRef.current })
  }, [])

  return { cache, loadImages, addImage, removeImage }
}

// ── Module-level accessor for archive export (outside React) ──
let _exportDb: IDBDatabase | null = null
async function getExportDB(): Promise<IDBDatabase> {
  if (_exportDb) return _exportDb
  _exportDb = await openDB()
  return _exportDb
}

export async function getImageDataUrl(id: string): Promise<string | undefined> {
  const db = await getExportDB()
  return idbGet(db, id)
}

/** Restore an image with its original ID (used during archive import). */
export async function putImageById(id: string, dataUrl: string): Promise<void> {
  const db = await getExportDB()
  await idbPut(db, id, dataUrl)
}

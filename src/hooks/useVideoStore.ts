import { makeIdbSingleton, idbGet, idbPut, idbDelete } from '../utils/idb'

const DB_NAME = 'rm-videos'
const STORE   = 'videos'

const { getDB } = makeIdbSingleton(DB_NAME, STORE)

export async function addVideo(blob: Blob): Promise<string> {
  const id = `vid-${Date.now()}-${crypto.randomUUID()}`
  const db = await getDB()
  await idbPut(db, STORE, blob, id)
  return id
}

export async function getVideoBlob(id: string): Promise<Blob | null> {
  const db = await getDB()
  return (await idbGet<Blob>(db, STORE, id)) ?? null
}

export async function removeVideo(id: string): Promise<void> {
  const db = await getDB()
  await idbDelete(db, STORE, id)
}

/** Restore a video blob with its original ID (used during archive import). */
export async function putVideoById(id: string, blob: Blob): Promise<void> {
  const db = await getDB()
  await idbPut(db, STORE, blob, id)
}

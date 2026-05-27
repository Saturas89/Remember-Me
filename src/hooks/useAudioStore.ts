import { makeIdbSingleton, idbGet, idbPut, idbDelete } from '../utils/idb'

const DB_NAME = 'rm-audio'
const STORE   = 'audio'

const { getDB } = makeIdbSingleton(DB_NAME, STORE)

export async function addAudio(blob: Blob): Promise<string> {
  const id = `aud-${Date.now()}-${crypto.randomUUID()}`
  const db = await getDB()
  await idbPut(db, STORE, blob, id)
  return id
}

export async function getAudioBlob(id: string): Promise<Blob | null> {
  const db = await getDB()
  return (await idbGet<Blob>(db, STORE, id)) ?? null
}

export async function removeAudio(id: string): Promise<void> {
  const db = await getDB()
  await idbDelete(db, STORE, id)
}

/** Restore an audio blob with its original ID (used during archive import). */
export async function putAudioById(id: string, blob: Blob): Promise<void> {
  const db = await getDB()
  await idbPut(db, STORE, blob, id)
}

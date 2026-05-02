import type { MediaStoreAccessor } from './privateSyncProvider'
import { getImageDataUrl, putImageById } from '../hooks/useImageStore'
import { getAudioBlob, putAudioById } from '../hooks/useAudioStore'
import { getVideoBlob, putVideoById } from '../hooks/useVideoStore'

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] ?? 'application/octet-stream'
  const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0))
  return new Blob([bytes], { type: mime })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function getAllKeys(dbName: string, storeName: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(storeName)
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction(storeName, 'readonly')
      const kr = tx.objectStore(storeName).getAllKeys()
      kr.onsuccess = () => resolve(kr.result as string[])
      kr.onerror = () => reject(kr.error)
    }
    req.onerror = () => reject(req.error)
  })
}

export const defaultMediaAdapter: MediaStoreAccessor = {
  async getImageBlob(id) {
    const url = await getImageDataUrl(id)
    if (!url) return null
    return dataUrlToBlob(url)
  },

  async getAudioBlob(id) {
    return getAudioBlob(id)
  },

  async getVideoBlob(id) {
    return getVideoBlob(id)
  },

  async putImage(id, blob) {
    const dataUrl = await blobToDataUrl(blob)
    await putImageById(id, dataUrl)
  },

  async putAudio(id, blob) {
    await putAudioById(id, blob)
  },

  async putVideo(id, blob) {
    await putVideoById(id, blob)
  },

  async listLocalMediaIds() {
    const [images, audio, videos] = await Promise.all([
      getAllKeys('rm-images', 'images'),
      getAllKeys('rm-audio', 'audio'),
      getAllKeys('rm-videos', 'videos'),
    ])
    return { images, audio, videos }
  },
}

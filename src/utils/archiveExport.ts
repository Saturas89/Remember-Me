import JSZip from 'jszip'
import { exportAsBackup } from './export'
import { getAudioBlob } from '../hooks/useAudioStore'
import { getVideoBlob } from '../hooks/useVideoStore'
import { getImageDataUrl } from '../hooks/useImageStore'
import type { ExportData } from './export'

export interface ArchiveStats {
  photoCount:  number
  audioCount:  number
  videoCount:  number
  totalBytes:  number
}

export interface BuildOptions {
  data:        ExportData
  onProgress?: (step: string, pct: number) => void
}

export async function buildMemoryArchive({ data, onProgress }: BuildOptions): Promise<{ blob: Blob; stats: ArchiveStats }> {
  const zip = new JSZip()
  onProgress?.('Deine Erinnerungen werden zusammengestellt…', 5)

  // ── memories.json ──────────────────────────────────────
  zip.file('memories.json', exportAsBackup(data))

  // ── Collect media IDs ──────────────────────────────────
  const imageIds = Object.values(data.answers).flatMap(a => a.imageIds ?? [])
  const audioIds = Object.values(data.answers).map(a => a.audioId).filter(Boolean) as string[]
  const videoIds = Object.values(data.answers).flatMap(a => a.videoIds ?? [])

  const photos = zip.folder('photos')!
  const audio  = zip.folder('audio')!
  const videos = zip.folder('videos')!

  let photoCount = 0
  let audioCount = 0
  let videoCount = 0

  // ── Photos (0–40 %) ────────────────────────────────────
  for (let i = 0; i < imageIds.length; i++) {
    onProgress?.(
      imageIds.length === 1 ? 'Foto wird gesichert…' : `Foto ${i + 1} von ${imageIds.length} wird gesichert…`,
      10 + Math.round((i / Math.max(imageIds.length, 1)) * 30),
    )
    const dataUrl = await getImageDataUrl(imageIds[i])
    if (dataUrl) {
      const base64 = dataUrl.split(',')[1]
      photos.file(`${imageIds[i]}.jpg`, base64, { base64: true })
      photoCount++
    }
  }

  // ── Audio (40–65 %) ────────────────────────────────────
  let audioProcessed = 0
  await Promise.all(
    audioIds.map(async (audioId) => {
      const blob = await getAudioBlob(audioId)
      audioProcessed++
      onProgress?.(
        audioIds.length === 1 ? 'Sprachaufnahme wird gesichert…' : `Sprachaufnahme ${audioProcessed} von ${audioIds.length} wird gesichert…`,
        40 + Math.round(((audioProcessed - 1) / Math.max(audioIds.length, 1)) * 25),
      )
      if (blob) {
        const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
        audio.file(`${audioId}.${ext}`, blob)
        audioCount++
      }
    })
  )

  // ── Videos (65–90 %) ───────────────────────────────────
  for (let i = 0; i < videoIds.length; i++) {
    onProgress?.(
      videoIds.length === 1 ? 'Video wird gesichert…' : `Video ${i + 1} von ${videoIds.length} wird gesichert…`,
      65 + Math.round((i / Math.max(videoIds.length, 1)) * 25),
    )
    const blob = await getVideoBlob(videoIds[i])
    if (blob) {
      // Prefer mp4 for broadest compatibility; fall back to webm
      const ext = blob.type.includes('mp4') ? 'mp4'
                : blob.type.includes('webm') ? 'webm'
                : blob.type.includes('quicktime') ? 'mov'
                : 'mp4'
      videos.file(`${videoIds[i]}.${ext}`, blob)
      videoCount++
    }
  }

  onProgress?.('Fast fertig – alles wird sicher verpackt…', 93)
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  return { blob: zipBlob, stats: { photoCount, audioCount, videoCount, totalBytes: zipBlob.size } }
}

export function fmtBytes(bytes: number): string {
  if (bytes < 1024)             return `${bytes} B`
  if (bytes < 1024 * 1024)      return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

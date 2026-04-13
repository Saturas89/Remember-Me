import JSZip from 'jszip'
import { exportAsBackup } from './export'
import { getAudioBlob } from '../hooks/useAudioStore'
import { getImageDataUrl } from '../hooks/useImageStore'
import type { ExportData } from './export'

export interface ArchiveStats {
  photoCount:  number
  audioCount:  number
  totalBytes:  number
}

export interface BuildOptions {
  data:        ExportData
  onProgress?: (step: string, pct: number) => void
}

export async function buildMemoryArchive({ data, onProgress }: BuildOptions): Promise<{ blob: Blob; stats: ArchiveStats }> {
  const zip = new JSZip()
  onProgress?.('Deine Geschichte wird vorbereitet…', 5)

  // ── memories.json ──────────────────────────────────────
  zip.file('memories.json', exportAsBackup(data))

  // ── Collect media IDs ──────────────────────────────────
  const imageIds = Object.values(data.answers).flatMap(a => a.imageIds ?? [])
  const audioIds = Object.values(data.answers).map(a => a.audioId).filter(Boolean) as string[]

  const photos = zip.folder('photos')!
  const audio  = zip.folder('audio')!
  zip.folder('videos') // reserved for future video support

  let photoCount = 0
  let audioCount = 0

  // ── Photos ─────────────────────────────────────────────
  for (let i = 0; i < imageIds.length; i++) {
    onProgress?.(
      `Foto ${i + 1} von ${imageIds.length} wird gesichert…`,
      10 + Math.round((i / Math.max(imageIds.length, 1)) * 45),
    )
    const dataUrl = await getImageDataUrl(imageIds[i])
    if (dataUrl) {
      const base64 = dataUrl.split(',')[1]
      photos.file(`${imageIds[i]}.jpg`, base64, { base64: true })
      photoCount++
    }
  }

  // ── Audio ──────────────────────────────────────────────
  for (let i = 0; i < audioIds.length; i++) {
    onProgress?.(
      `Sprachaufnahme ${i + 1} von ${audioIds.length} wird gesichert…`,
      55 + Math.round((i / Math.max(audioIds.length, 1)) * 35),
    )
    const blob = await getAudioBlob(audioIds[i])
    if (blob) {
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
      audio.file(`${audioIds[i]}.${ext}`, blob)
      audioCount++
    }
  }

  onProgress?.('Archiv wird versiegelt…', 93)
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  return { blob: zipBlob, stats: { photoCount, audioCount, totalBytes: zipBlob.size } }
}

export function fmtBytes(bytes: number): string {
  if (bytes < 1024)             return `${bytes} B`
  if (bytes < 1024 * 1024)      return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

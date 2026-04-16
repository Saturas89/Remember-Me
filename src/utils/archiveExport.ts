import JSZip from 'jszip'
import { exportAsBackup } from './export'
import { getAudioBlob } from '../hooks/useAudioStore'
import { getVideoBlob } from '../hooks/useVideoStore'
import { getImageDataUrl } from '../hooks/useImageStore'
import type { ExportData } from './export'
import { FRIEND_ANSWER_ZIP_TYPE } from '../types'
import type { FriendAnswerZipPayload } from '../types'

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
  const imagePromises = imageIds.map(id => getImageDataUrl(id))
  for (let i = 0; i < imageIds.length; i++) {
    onProgress?.(
      imageIds.length === 1 ? 'Foto wird gesichert…' : `Foto ${i + 1} von ${imageIds.length} wird gesichert…`,
      10 + Math.round((i / Math.max(imageIds.length, 1)) * 30),
    )
    const dataUrl = await imagePromises[i]
    if (dataUrl) {
      const base64 = dataUrl.split(',')[1]
      photos.file(`${imageIds[i]}.jpg`, base64, { base64: true })
      photoCount++
    }
  }

  // ── Audio (40–65 %) ────────────────────────────────────
  const audioPromises = audioIds.map(id => getAudioBlob(id))
  for (let i = 0; i < audioIds.length; i++) {
    onProgress?.(
      audioIds.length === 1 ? 'Sprachaufnahme wird gesichert…' : `Sprachaufnahme ${i + 1} von ${audioIds.length} wird gesichert…`,
      40 + Math.round((i / Math.max(audioIds.length, 1)) * 25),
    )
    const blob = await audioPromises[i]
    if (blob) {
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
      audio.file(`${audioIds[i]}.${ext}`, blob)
      audioCount++
    }
  }

  // ── Videos (65–90 %) ───────────────────────────────────
  const videoPromises = videoIds.map(id => getVideoBlob(id))
  for (let i = 0; i < videoIds.length; i++) {
    onProgress?.(
      videoIds.length === 1 ? 'Video wird gesichert…' : `Video ${i + 1} von ${videoIds.length} wird gesichert…`,
      65 + Math.round((i / Math.max(videoIds.length, 1)) * 25),
    )
    const blob = await videoPromises[i]
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

export interface FriendArchiveBuildOptions {
  friendId: string
  friendName: string
  answers: Array<{
    questionId: string
    value: string
    questionText?: string
    imageIds: string[]
    audioId?: string
    videoIds: string[]
  }>
  onProgress?: (step: string, pct: number) => void
}

export async function buildFriendAnswerArchive(
  opts: FriendArchiveBuildOptions,
): Promise<{ blob: Blob; stats: ArchiveStats }> {
  const { friendId, friendName, answers, onProgress } = opts
  const zip = new JSZip()
  onProgress?.('Anhänge werden verpackt…', 5)

  const photos = zip.folder('photos')!
  const audio  = zip.folder('audio')!
  const videos = zip.folder('videos')!

  const payload: FriendAnswerZipPayload = {
    $type: FRIEND_ANSWER_ZIP_TYPE,
    version: 1,
    exportedAt: new Date().toISOString(),
    friendId,
    friendName,
    answers: [],
  }

  let photoCount = 0
  let audioCount = 0
  let videoCount = 0

  const totalMedia = answers.reduce(
    (sum, a) => sum + a.imageIds.length + (a.audioId ? 1 : 0) + a.videoIds.length,
    0,
  )
  let mediaProcessed = 0

  for (let ai = 0; ai < answers.length; ai++) {
    const a = answers[ai]
    const imageFiles: string[] = []
    let   audioFile: string | undefined
    const videoFiles: string[] = []

    for (let ii = 0; ii < a.imageIds.length; ii++) {
      const dataUrl = await getImageDataUrl(a.imageIds[ii])
      if (dataUrl) {
        const filename = `photos/photo-${ai}-${ii}.jpg`
        const base64   = dataUrl.split(',')[1]
        photos.file(`photo-${ai}-${ii}.jpg`, base64, { base64: true })
        imageFiles.push(filename)
        photoCount++
      }
      mediaProcessed++
      onProgress?.(`Foto ${photoCount} wird verpackt…`, 10 + Math.round((mediaProcessed / Math.max(totalMedia, 1)) * 80))
    }

    if (a.audioId) {
      const blob = await getAudioBlob(a.audioId)
      if (blob) {
        const ext      = blob.type.includes('mp4') ? 'mp4' : 'webm'
        const filename = `audio/audio-${ai}.${ext}`
        audio.file(`audio-${ai}.${ext}`, blob)
        audioFile = filename
        audioCount++
      }
      mediaProcessed++
      onProgress?.(`Aufnahme wird verpackt…`, 10 + Math.round((mediaProcessed / Math.max(totalMedia, 1)) * 80))
    }

    for (let vi = 0; vi < a.videoIds.length; vi++) {
      const blob = await getVideoBlob(a.videoIds[vi])
      if (blob) {
        const ext      = blob.type.includes('mp4') ? 'mp4'
                       : blob.type.includes('quicktime') ? 'mov'
                       : 'webm'
        const filename = `videos/video-${ai}-${vi}.${ext}`
        videos.file(`video-${ai}-${vi}.${ext}`, blob)
        videoFiles.push(filename)
        videoCount++
      }
      mediaProcessed++
      onProgress?.(`Video ${videoCount} wird verpackt…`, 10 + Math.round((mediaProcessed / Math.max(totalMedia, 1)) * 80))
    }

    payload.answers.push({
      questionId: a.questionId,
      value: a.value,
      questionText: a.questionText,
      imageFiles: imageFiles.length ? imageFiles : undefined,
      audioFile,
      videoFiles: videoFiles.length ? videoFiles : undefined,
    })
  }

  zip.file('friend-answers.json', JSON.stringify(payload))

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

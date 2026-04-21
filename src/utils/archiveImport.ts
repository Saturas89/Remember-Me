import JSZip from 'jszip'
import { putImageById } from '../hooks/useImageStore'
import { putAudioById } from '../hooks/useAudioStore'
import { putVideoById } from '../hooks/useVideoStore'
import { BACKUP_TYPE } from './export'
import { FRIEND_ANSWER_ZIP_TYPE } from '../types'
import type { FriendAnswerZipPayload } from '../types'

export interface ImportStats {
  photos: number
  audio:  number
  videos: number
}

export interface ImportResult {
  ok:       boolean
  error?:   string
  /** The memories.json text, ready to pass to restoreBackup(). */
  jsonText?: string
  /** Populated when the ZIP is a friend-answer ZIP (friend-answers.json present). */
  friendAnswerPayload?: FriendAnswerZipPayload
  stats?:   ImportStats
}

function isZipFile(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith('.zip') ||
    file.type === 'application/zip' ||
    file.type === 'application/x-zip-compressed' ||
    file.type === 'application/octet-stream'
  )
}

// Reject ZIP entry names that try to escape their expected prefix
// (defense-in-depth against malicious archives – JSZip does not sandbox).
function safeZipEntry(zip: JSZip, path: string, allowedPrefixes: string[]) {
  if (!path || path.includes('\0')) return null
  if (path.startsWith('/') || path.startsWith('\\')) return null
  const normalized = path.replace(/\\/g, '/')
  if (normalized.split('/').some(seg => seg === '..')) return null
  if (!allowedPrefixes.some(p => normalized.startsWith(p))) return null
  return zip.file(normalized)
}

function validateBackupText(text: string): { ok: true } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    if (parsed.$type !== BACKUP_TYPE) {
      return { ok: false, error: 'Unbekanntes Dateiformat. Bitte eine Backup-Datei von Remember Me verwenden.' }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Die Datei konnte nicht gelesen werden. Ist es eine gültige Backup-Datei?' }
  }
}

// ── JSON-only import ──────────────────────────────────────────

async function importJson(file: File): Promise<ImportResult> {
  const text = await file.text()
  const valid = validateBackupText(text)
  if (!valid.ok) return { ok: false, error: valid.error }
  return { ok: true, jsonText: text }
}

// ── ZIP archive import ────────────────────────────────────────

async function importZipFromLoaded(
  zip: JSZip,
  onProgress: (step: string, pct: number) => void,
): Promise<ImportResult> {
  try {

    // Validate memories.json
    const jsonEntry = zip.file('memories.json')
    if (!jsonEntry) {
      return {
        ok: false,
        error: 'Keine memories.json im Archiv. Ist es ein gültiges Erinnerungs-Archiv?',
      }
    }
    const jsonText = await jsonEntry.async('string')
    const valid = validateBackupText(jsonText)
    if (!valid.ok) return { ok: false, error: valid.error }

    // Derive IDs from the state inside the backup
    const parsed = JSON.parse(jsonText) as Record<string, unknown>
    const state  = (parsed.state ?? {}) as Record<string, unknown>
    type AnswerShape = { imageIds?: string[]; videoIds?: string[]; audioId?: string }
    const answers = (state.answers ?? {}) as Record<string, AnswerShape>

    const imageIds = Object.values(answers).flatMap(a => a.imageIds ?? [])
    const audioIds = Object.values(answers).map(a => a.audioId).filter(Boolean) as string[]
    const videoIds = Object.values(answers).flatMap(a => a.videoIds ?? [])

    let photos = 0
    let audio  = 0
    let videos = 0

    // ── Photos (10–40 %) ─────────────────────────────────
    for (let i = 0; i < imageIds.length; i++) {
      onProgress(
        imageIds.length === 1
          ? 'Foto wird wiederhergestellt…'
          : `Foto ${i + 1} von ${imageIds.length}…`,
        10 + Math.round((i / Math.max(imageIds.length, 1)) * 30),
      )
      const id    = imageIds[i]
      const entry = safeZipEntry(zip, `photos/${id}.jpg`, ['photos/'])
      if (entry) {
        const base64 = await entry.async('base64')
        await putImageById(id, `data:image/jpeg;base64,${base64}`)
        photos++
      }
    }

    // ── Audio (40–65 %) ──────────────────────────────────
    for (let i = 0; i < audioIds.length; i++) {
      onProgress(
        audioIds.length === 1
          ? 'Aufnahme wird wiederhergestellt…'
          : `Aufnahme ${i + 1} von ${audioIds.length}…`,
        40 + Math.round((i / Math.max(audioIds.length, 1)) * 25),
      )
      const id    = audioIds[i]
      const entry = safeZipEntry(zip, `audio/${id}.webm`, ['audio/'])
                 ?? safeZipEntry(zip, `audio/${id}.mp4`, ['audio/'])
      if (entry) {
        const ab      = await entry.async('arraybuffer')
        const mimeType = entry.name.endsWith('.mp4') ? 'audio/mp4' : 'audio/webm'
        await putAudioById(id, new Blob([ab], { type: mimeType }))
        audio++
      }
    }

    // ── Videos (65–90 %) ─────────────────────────────────
    for (let i = 0; i < videoIds.length; i++) {
      onProgress(
        videoIds.length === 1
          ? 'Video wird wiederhergestellt…'
          : `Video ${i + 1} von ${videoIds.length}…`,
        65 + Math.round((i / Math.max(videoIds.length, 1)) * 25),
      )
      const id    = videoIds[i]
      const entry =
        safeZipEntry(zip, `videos/${id}.mp4`, ['videos/']) ??
        safeZipEntry(zip, `videos/${id}.webm`, ['videos/']) ??
        safeZipEntry(zip, `videos/${id}.mov`, ['videos/'])
      if (entry) {
        const ab      = await entry.async('arraybuffer')
        const mimeType = entry.name.endsWith('.mp4')  ? 'video/mp4'
                       : entry.name.endsWith('.mov')  ? 'video/quicktime'
                       : 'video/webm'
        await putVideoById(id, new Blob([ab], { type: mimeType }))
        videos++
      }
    }

    onProgress('Erinnerungen werden wiederhergestellt…', 95)
    return { ok: true, jsonText, stats: { photos, audio, videos } }
  } catch {
    return { ok: false, error: 'Das Archiv konnte nicht gelesen werden.' }
  }
}

// ── Friend-answer ZIP import ──────────────────────────────────

async function importFriendAnswerZip(
  zip: JSZip,
  onProgress: (step: string, pct: number) => void,
): Promise<ImportResult> {
  try {
    const jsonEntry = zip.file('friend-answers.json')
    if (!jsonEntry) return { ok: false, error: 'Keine friend-answers.json im Archiv.' }

    const parsed = JSON.parse(await jsonEntry.async('string')) as Record<string, unknown>
    if (parsed.$type !== FRIEND_ANSWER_ZIP_TYPE) {
      return { ok: false, error: 'Unbekanntes Freundes-Antworten-Format.' }
    }

    const rawPayload = parsed as unknown as FriendAnswerZipPayload

    // Count total media for progress
    const totalMedia = rawPayload.answers.reduce(
      (sum, a) =>
        sum +
        (a.imageFiles?.length ?? 0) +
        (a.audioFile ? 1 : 0) +
        (a.videoFiles?.length ?? 0),
      0,
    )
    let mediaProcessed = 0
    let photos = 0
    let audio  = 0
    let videos = 0

    // Build a remapped payload with fresh device-local IDs
    const remappedAnswers: FriendAnswerZipPayload['answers'] = []

    for (const a of rawPayload.answers) {
      const imageIds: string[] = []
      let   audioId: string | undefined
      const videoIds: string[] = []

      for (const zipPath of a.imageFiles ?? []) {
        const entry = safeZipEntry(zip, zipPath, ['photos/'])
        if (entry) {
          const base64  = await entry.async('base64')
          const newId   = `img-${crypto.randomUUID()}`
          await putImageById(newId, `data:image/jpeg;base64,${base64}`)
          imageIds.push(newId)
          photos++
        }
        mediaProcessed++
        onProgress(
          `Foto ${photos} wird importiert…`,
          10 + Math.round((mediaProcessed / Math.max(totalMedia, 1)) * 80),
        )
      }

      if (a.audioFile) {
        const entry = safeZipEntry(zip, a.audioFile, ['audio/'])
        if (entry) {
          const ab       = await entry.async('arraybuffer')
          const mimeType = a.audioFile.endsWith('.mp4') ? 'audio/mp4' : 'audio/webm'
          const newId    = `aud-${crypto.randomUUID()}`
          await putAudioById(newId, new Blob([ab], { type: mimeType }))
          audioId = newId
          audio++
        }
        mediaProcessed++
        onProgress(
          'Aufnahme wird importiert…',
          10 + Math.round((mediaProcessed / Math.max(totalMedia, 1)) * 80),
        )
      }

      for (const zipPath of a.videoFiles ?? []) {
        const entry = safeZipEntry(zip, zipPath, ['videos/'])
        if (entry) {
          const ab       = await entry.async('arraybuffer')
          const mimeType = zipPath.endsWith('.mp4') ? 'video/mp4'
                         : zipPath.endsWith('.mov') ? 'video/quicktime'
                         : 'video/webm'
          const newId    = `vid-${crypto.randomUUID()}`
          await putVideoById(newId, new Blob([ab], { type: mimeType }))
          videoIds.push(newId)
          videos++
        }
        mediaProcessed++
        onProgress(
          `Video ${videos} wird importiert…`,
          10 + Math.round((mediaProcessed / Math.max(totalMedia, 1)) * 80),
        )
      }

      remappedAnswers.push({
        questionId: a.questionId,
        value: a.value,
        questionText: a.questionText,
        imageFiles: imageIds.length ? imageIds : undefined,
        audioFile: audioId,
        videoFiles: videoIds.length ? videoIds : undefined,
      })
    }

    const friendAnswerPayload: FriendAnswerZipPayload = {
      ...rawPayload,
      answers: remappedAnswers,
    }

    onProgress('Erinnerungen werden gespeichert…', 95)
    return { ok: true, friendAnswerPayload, stats: { photos, audio, videos } }
  } catch {
    return { ok: false, error: 'Das Freundes-Archiv konnte nicht gelesen werden.' }
  }
}

// ── Public entry point ────────────────────────────────────────

/**
 * Import either a JSON backup or a ZIP archive.
 * For ZIPs all media (photos, audio, videos) are restored into IndexedDB
 * before the returned jsonText is handed to restoreBackup().
 */
export async function importFile(
  file: File,
  onProgress: (step: string, pct: number) => void = () => {},
): Promise<ImportResult> {
  if (isZipFile(file)) {
    try {
      const zip = await JSZip.loadAsync(file)
      if (zip.file('friend-answers.json')) return importFriendAnswerZip(zip, onProgress)
      return importZipFromLoaded(zip, onProgress)
    } catch {
      return { ok: false, error: 'Das Archiv konnte nicht gelesen werden.' }
    }
  }
  return importJson(file)
}

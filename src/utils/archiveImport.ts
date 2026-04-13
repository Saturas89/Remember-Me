import JSZip from 'jszip'
import { putImageById } from '../hooks/useImageStore'
import { putAudioById } from '../hooks/useAudioStore'
import { putVideoById } from '../hooks/useVideoStore'
import { BACKUP_TYPE } from './export'

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

async function importZip(
  file: File,
  onProgress: (step: string, pct: number) => void,
): Promise<ImportResult> {
  try {
    onProgress('Archiv wird geöffnet…', 5)
    const zip = await JSZip.loadAsync(file)

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
      const entry = zip.file(`photos/${id}.jpg`)
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
      const entry = zip.file(`audio/${id}.webm`) ?? zip.file(`audio/${id}.mp4`)
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
        zip.file(`videos/${id}.mp4`) ??
        zip.file(`videos/${id}.webm`) ??
        zip.file(`videos/${id}.mov`)
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
  if (isZipFile(file)) return importZip(file, onProgress)
  return importJson(file)
}

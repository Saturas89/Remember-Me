import { CATEGORIES } from '../data/categories'
import { FRIEND_QUESTIONS } from '../data/friendQuestions'
import type { Answer, Friend, FriendAnswer, CustomQuestion, Profile } from '../types'

export interface ExportData {
  profile: Profile | null
  answers: Record<string, Answer>
  friends: Friend[]
  friendAnswers: FriendAnswer[]
  customQuestions: CustomQuestion[]
}

// ── Helpers ──────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

let questionDictionary: Record<string, string> | null = null

function getQuestionDictionary(): Record<string, string> {
  if (!questionDictionary) {
    questionDictionary = {}
    for (const cat of CATEGORIES) {
      for (const q of cat.questions) {
        questionDictionary[q.id] = q.text
      }
    }
    for (const q of FRIEND_QUESTIONS) {
      questionDictionary[q.id] = q.text
    }
  }
  return questionDictionary
}

function resolveQuestion(questionId: string, storedText?: string): string {
  if (storedText) return storedText
  const dict = getQuestionDictionary()
  if (dict[questionId]) return dict[questionId]
  return 'Frage nicht mehr verfügbar'
}

/** Trigger a browser file download */
export function downloadFile(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Raw backup (for restore / re-install) ─────────────────
export const BACKUP_TYPE = 'remember-me-backup'

export interface BackupPayload {
  $type: typeof BACKUP_TYPE
  version: number
  exportedAt: string
  app: string
  state: ExportData
}

/**
 * Exports a raw backup suitable for re-importing (text-only).
 * Contains all text answers, profile, friends, friendAnswers, customQuestions,
 * and audio transcripts (audioTranscript). Media files (photos, videos, audio
 * blobs) are NOT included – use the full archive ZIP export for those.
 */
export function exportAsBackup(data: ExportData): string {
  const payload: BackupPayload = {
    $type: BACKUP_TYPE,
    version: 2,
    exportedAt: new Date().toISOString(),
    app: 'Remember Me',
    state: {
      profile: data.profile,
      answers: data.answers,
      friends: data.friends,
      friendAnswers: data.friendAnswers,
      customQuestions: data.customQuestions,
    },
  }
  return JSON.stringify(payload, null, 2)
}

// ── Markdown export ───────────────────────────────────────

export function exportAsMarkdown(data: ExportData): string {
  const { profile, answers, friends, friendAnswers, customQuestions } = data
  const name = profile?.name ?? 'Unbekannt'
  const year = profile?.birthYear ? ` (geb. ${profile.birthYear})` : ''
  const today = formatDate(new Date().toISOString())

  const lines: string[] = []

  lines.push(`# Lebensgeschichte von ${name}${year}`)
  lines.push('')
  lines.push(`*Exportiert am ${today} · Remember Me*`)
  lines.push('')
  lines.push('---')

  function hasExportableContent(a: Answer | undefined): boolean {
    if (!a) return false
    return !!(a.value.trim() || a.audioId || a.audioTranscript || (a.imageIds?.length ?? 0) > 0)
  }

  function renderAnswerText(a: Answer): string {
    return a.value.trim() || a.audioTranscript || (a.audioId ? '🎙 [Nur Sprachaufnahme]' : '')
  }

  // Own answers by category
  for (const cat of CATEGORIES) {
    const catAnswers = cat.questions.filter(q => hasExportableContent(answers[q.id]))
    if (catAnswers.length === 0) continue

    lines.push('')
    lines.push(`## ${cat.emoji} ${cat.title}`)
    lines.push('')

    for (const q of catAnswers) {
      const a = answers[q.id]
      lines.push(`**${q.text}**`)
      lines.push(renderAnswerText(a))
      if (a.audioTranscript && a.audioTranscript !== a.value.trim()) {
        lines.push(`> 🎙 *Transkription:* ${a.audioTranscript}`)
      }
      const mediaTags: string[] = []
      if ((a.imageIds?.length ?? 0) > 0) mediaTags.push(`🖼 ${a.imageIds!.length} Foto${a.imageIds!.length !== 1 ? 's' : ''}`)
      if ((a.videoIds?.length ?? 0) > 0) mediaTags.push(`🎬 ${a.videoIds!.length} Video${a.videoIds!.length !== 1 ? 's' : ''}`)
      if (a.audioId) mediaTags.push('🎙 Originalton')
      if (mediaTags.length > 0) lines.push(`_${mediaTags.join(' · ')} im Archiv_`)
      lines.push('')
    }

    lines.push('---')
  }

  // Custom questions
  const customAnswered = customQuestions.filter(q => hasExportableContent(answers[q.id]))
  if (customAnswered.length > 0) {
    lines.push('')
    lines.push('## ✏️ Eigene Fragen')
    lines.push('')

    for (const q of customAnswered) {
      const a = answers[q.id]
      lines.push(`**${q.text}**`)
      lines.push(renderAnswerText(a))
      if (a.audioTranscript && a.audioTranscript !== a.value.trim()) {
        lines.push(`> 🎙 *Transkription:* ${a.audioTranscript}`)
      }
      const mediaTags2: string[] = []
      if ((a.imageIds?.length ?? 0) > 0) mediaTags2.push(`🖼 ${a.imageIds!.length} Foto${a.imageIds!.length !== 1 ? 's' : ''}`)
      if ((a.videoIds?.length ?? 0) > 0) mediaTags2.push(`🎬 ${a.videoIds!.length} Video${a.videoIds!.length !== 1 ? 's' : ''}`)
      if (a.audioId) mediaTags2.push('🎙 Originalton')
      if (mediaTags2.length > 0) lines.push(`_${mediaTags2.join(' · ')} im Archiv_`)
      lines.push('')
    }

    lines.push('---')
  }

  // Friend perspectives
  const friendsWithAnswers = friends.filter(f =>
    friendAnswers.some(a => a.friendId === f.id && a.value.trim()),
  )

  if (friendsWithAnswers.length > 0) {
    lines.push('')
    lines.push('## 👥 Was Freunde über mich sagen')

    for (const friend of friendsWithAnswers) {
      const thisAnswers = friendAnswers.filter(
        a => a.friendId === friend.id && a.value.trim(),
      )
      lines.push('')
      lines.push(`### ${friend.name}`)
      lines.push('')

      for (const a of thisAnswers) {
        const questionText = resolveQuestion(a.questionId, a.questionText)
          .replace(/\{name\}/g, name)
        lines.push(`**${questionText}**`)
        lines.push(a.value.trim())
        lines.push('')
      }
    }

    lines.push('---')
  }

  lines.push('')
  lines.push('*Erstellt mit Remember Me – Lebensgeschichten für die Nachwelt.*')

  return lines.join('\n')
}

// ── Enriched JSON export ──────────────────────────────────

export function exportAsEnrichedJSON(data: ExportData): string {
  const { profile, answers, friends, friendAnswers, customQuestions } = data
  const name = profile?.name ?? 'Unbekannt'

  const categories = CATEGORIES
    .map(cat => {
      const catAnswers = cat.questions
        .filter(q => answers[q.id]?.value.trim())
        .map(q => ({
          questionId: q.id,
          question: q.text,
          answer: answers[q.id].value.trim(),
          answeredAt: answers[q.id].updatedAt.split('T')[0],
        }))
      if (catAnswers.length === 0) return null
      return { id: cat.id, title: cat.title, emoji: cat.emoji, answers: catAnswers }
    })
    .filter(Boolean)

  const customAnswered = customQuestions
    .filter(q => answers[q.id]?.value.trim())
    .map(q => ({
      questionId: q.id,
      question: q.text,
      answer: answers[q.id].value.trim(),
      answeredAt: answers[q.id].updatedAt.split('T')[0],
    }))

  const friendPerspectives = friends
    .map(friend => {
      const thisAnswers = friendAnswers
        .filter(a => a.friendId === friend.id && a.value.trim())
        .map(a => ({
          question: resolveQuestion(a.questionId, a.questionText).replace(/\{name\}/g, name),
          answer: a.value.trim(),
          submittedAt: a.createdAt.split('T')[0],
        }))
      if (thisAnswers.length === 0) return null
      return { friendName: friend.name, answers: thisAnswers }
    })
    .filter(Boolean)

  const payload = {
    $schema: 'https://remember-me.app/schema/export/v1.json',
    exportVersion: '1',
    exportedAt: new Date().toISOString(),
    app: 'Remember Me',
    profile: {
      name: profile?.name ?? null,
      birthYear: profile?.birthYear ?? null,
      memberSince: profile?.createdAt ? profile.createdAt.split('T')[0] : null,
    },
    categories,
    customQuestions: customAnswered.length > 0 ? customAnswered : undefined,
    friendPerspectives: friendPerspectives.length > 0 ? friendPerspectives : undefined,
  }

  return JSON.stringify(payload, null, 2)
}

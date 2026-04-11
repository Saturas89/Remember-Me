import type { InviteData, AnswerExport, QuestionPack } from '../types'

export function encodeInvite(data: InviteData): string {
  return btoa(encodeURIComponent(JSON.stringify(data)))
}

export function decodeInvite(encoded: string): InviteData | null {
  try {
    return JSON.parse(decodeURIComponent(atob(encoded))) as InviteData
  } catch {
    return null
  }
}

export function encodeAnswerExport(data: AnswerExport): string {
  return btoa(encodeURIComponent(JSON.stringify(data)))
}

export function decodeAnswerExport(code: string): AnswerExport | null {
  try {
    return JSON.parse(decodeURIComponent(atob(code.trim()))) as AnswerExport
  } catch {
    return null
  }
}

export function generateInviteUrl(profileName: string, friendId: string, topicId?: string): string {
  const data: InviteData = { profileName, friendId, topicId }
  const encoded = encodeInvite(data)
  const base = window.location.origin + window.location.pathname
  return `${base}#invite/${encoded}`
}

/** Reads the current URL hash and returns parsed InviteData if present */
export function parseInviteFromHash(): InviteData | null {
  const hash = window.location.hash
  const match = hash.match(/^#invite\/(.+)$/)
  if (!match) return null
  return decodeInvite(match[1])
}

/** Encode a question pack as a shareable text code */
export function encodeQuestionPack(data: QuestionPack): string {
  return btoa(encodeURIComponent(JSON.stringify(data)))
}

/** Decode a question pack code; returns null on any error */
export function decodeQuestionPack(code: string): QuestionPack | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(atob(code.trim()))) as QuestionPack
    if (!Array.isArray(parsed.questions)) return null
    return parsed
  } catch {
    return null
  }
}

import type { AnswerExport, QuestionPack } from '../types'
import { validateAnswerExport } from './payloadGuards'

/** Encode an answer export as a Base64 text code for manual fallback sharing */
export function encodeAnswerExport(data: AnswerExport): string {
  return btoa(encodeURIComponent(JSON.stringify(data)))
}

/** Decode a Base64 answer export code; returns null on any error */
export function decodeAnswerExport(code: string): AnswerExport | null {
  try {
    return validateAnswerExport(JSON.parse(decodeURIComponent(atob(code.trim()))))
  } catch {
    return null
  }
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

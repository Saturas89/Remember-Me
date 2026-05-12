import type { AnswerExport, CustomQuestion, QuestionPack } from '../types'
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

// Per-question bounds. Anything beyond these is rejected outright – a
// decoded question that exceeds them would otherwise be persisted to
// localStorage and rendered, which is an easy DoS / state-bloat vector.
const MAX_QUESTIONS_PER_PACK = 200
const MAX_QUESTION_TEXT_LEN = 2_000
const MAX_HELP_TEXT_LEN = 2_000
const MAX_OPTION_LEN = 200
const MAX_OPTIONS_COUNT = 50
const MAX_ID_LEN = 200
const MAX_CREATED_AT_LEN = 50
const MAX_CREATED_BY_LEN = 200
const VALID_TYPES: ReadonlySet<CustomQuestion['type']> = new Set(['text', 'choice', 'scale'])

function isBoundedString(v: unknown, max: number): v is string {
  return typeof v === 'string' && v.length <= max
}

function isNonEmptyString(v: unknown, max: number): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= max
}

function validateCustomQuestion(raw: unknown): CustomQuestion | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!isNonEmptyString(r.id, MAX_ID_LEN)) return null
  if (!isNonEmptyString(r.text, MAX_QUESTION_TEXT_LEN)) return null
  if (typeof r.type !== 'string' || !VALID_TYPES.has(r.type as CustomQuestion['type'])) return null
  if (!isBoundedString(r.createdAt, MAX_CREATED_AT_LEN)) return null
  if (r.helpText !== undefined && !isBoundedString(r.helpText, MAX_HELP_TEXT_LEN)) return null
  let options: string[] | undefined
  if (r.options !== undefined) {
    if (!Array.isArray(r.options) || r.options.length > MAX_OPTIONS_COUNT) return null
    options = []
    for (const opt of r.options) {
      if (!isBoundedString(opt, MAX_OPTION_LEN)) return null
      options.push(opt)
    }
  }
  return {
    id: r.id,
    text: r.text,
    type: r.type as CustomQuestion['type'],
    createdAt: r.createdAt,
    helpText: r.helpText as string | undefined,
    options,
  }
}

const MAX_PERSONAL_META_LEN = 200

/** Decode a question pack code; returns null on any error or schema mismatch.
 *  Validates each question against bounded length + enum-type constraints so
 *  a crafted pack URL cannot stuff multi-MB strings or unknown types into
 *  localStorage. */
export function decodeQuestionPack(code: string): QuestionPack | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(atob(code.trim())))
    if (!parsed || typeof parsed !== 'object') return null
    const r = parsed as Record<string, unknown>
    if (!Array.isArray(r.questions) || r.questions.length > MAX_QUESTIONS_PER_PACK) return null
    if (r.createdBy !== undefined && !isBoundedString(r.createdBy, MAX_CREATED_BY_LEN)) return null
    const questions: CustomQuestion[] = []
    for (const q of r.questions) {
      const valid = validateCustomQuestion(q)
      if (!valid) return null
      questions.push(valid)
    }
    const out: QuestionPack & Partial<Record<'personalPack' | 'senderName' | 'recipientLabel' | 'anrede', unknown>> = {
      questions,
      createdBy: r.createdBy as string | undefined,
    }
    // REQ-020: preserve Sandra-flow personal-pack metadata across the
    // share-URL round trip, but only when every field passes the same bounded
    // validation as the rest of the pack.
    if (r.personalPack === true
      && isBoundedString(r.senderName, MAX_PERSONAL_META_LEN)
      && isBoundedString(r.recipientLabel, MAX_PERSONAL_META_LEN)
      && isBoundedString(r.anrede, MAX_PERSONAL_META_LEN)) {
      out.personalPack = true
      out.senderName = r.senderName
      out.recipientLabel = r.recipientLabel
      out.anrede = r.anrede
    }
    return out as QuestionPack
  } catch {
    return null
  }
}

// Runtime type-guards for anything that enters the app through a URL fragment.
//
// Everything here guards payloads that are fully attacker-controlled: invite
// URLs, answer-import URLs, memory-share URLs, contact handshakes. The TS
// `as T` cast in parsers doesn't verify shape – so if a crafted link contains
// `{"memories": 99999}` or `{"publicKey": { toString(){ ... } }}` the decoded
// value would leak into state and render paths as garbage. These guards
// reject everything that doesn't match the expected schema.
//
// Bounded length limits keep a malicious link from ballooning localStorage,
// the DOM, or React's reconciler.

import type {
  InviteData,
  AnswerExport,
  MemorySharePayload,
  ContactHandshake,
} from '../types'

// Upper bounds chosen so legitimate payloads always fit with room to spare
// while a crafted DoS attempt hits the guard quickly.
const MAX_NAME_LEN = 200
const MAX_QUESTION_TEXT_LEN = 2_000
const MAX_ANSWER_VALUE_LEN = 50_000
const MAX_ANSWERS = 500
const MAX_MEMORIES = 500
const MAX_MEMORY_TITLE_LEN = 500
const MAX_MEMORY_CONTENT_LEN = 50_000
const MAX_B64U_PUBLIC_KEY_LEN = 512

function isNonEmptyString(v: unknown, max: number): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= max
}

function isBoundedString(v: unknown, max: number): v is string {
  return typeof v === 'string' && v.length <= max
}

// SPKI ECDH P-256 public keys are ~91 bytes → ~122 base64url chars. We allow
// headroom for future curves but reject obviously-unbounded strings.
function isBase64UrlPublicKey(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    v.length > 0 &&
    v.length <= MAX_B64U_PUBLIC_KEY_LEN &&
    /^[A-Za-z0-9_-]+$/.test(v)
  )
}

export function validateInviteData(raw: unknown): InviteData | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!isNonEmptyString(r.profileName, MAX_NAME_LEN)) return null
  if (r.friendId !== undefined && !isBoundedString(r.friendId, MAX_NAME_LEN)) return null
  if (r.topicId !== undefined && !isBoundedString(r.topicId, MAX_NAME_LEN)) return null
  return {
    profileName: r.profileName as string,
    friendId: r.friendId as string | undefined,
    topicId: r.topicId as string | undefined,
  }
}

export function validateAnswerExport(raw: unknown): AnswerExport | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!isNonEmptyString(r.friendId, MAX_NAME_LEN)) return null
  if (!isBoundedString(r.friendName, MAX_NAME_LEN)) return null
  if (!Array.isArray(r.answers) || r.answers.length > MAX_ANSWERS) return null

  const answers: AnswerExport['answers'] = []
  for (const a of r.answers) {
    if (!a || typeof a !== 'object') return null
    const ar = a as Record<string, unknown>
    if (!isNonEmptyString(ar.questionId, MAX_NAME_LEN)) return null
    if (!isBoundedString(ar.value, MAX_ANSWER_VALUE_LEN)) return null
    if (ar.questionText !== undefined && !isBoundedString(ar.questionText, MAX_QUESTION_TEXT_LEN)) return null
    answers.push({
      questionId: ar.questionId as string,
      value: ar.value as string,
      questionText: ar.questionText as string | undefined,
    })
  }
  return {
    friendId: r.friendId as string,
    friendName: r.friendName as string,
    answers,
  }
}

export function validateMemorySharePayload(raw: unknown): MemorySharePayload | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!Array.isArray(r.memories) || r.memories.length > MAX_MEMORIES) return null
  if (r.sharedBy !== undefined && !isBoundedString(r.sharedBy, MAX_NAME_LEN)) return null

  const memories: MemorySharePayload['memories'] = []
  for (const m of r.memories) {
    if (!m || typeof m !== 'object') return null
    const mr = m as Record<string, unknown>
    if (!isBoundedString(mr.title, MAX_MEMORY_TITLE_LEN)) return null
    if (mr.content !== undefined && !isBoundedString(mr.content, MAX_MEMORY_CONTENT_LEN)) return null
    memories.push({ title: mr.title as string, content: mr.content as string | undefined })
  }
  return {
    memories,
    sharedBy: r.sharedBy as string | undefined,
  }
}

export function validateContactHandshake(raw: unknown): ContactHandshake | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.$type !== 'remember-me-contact') return null
  if (!isNonEmptyString(r.deviceId, MAX_NAME_LEN)) return null
  if (!isBase64UrlPublicKey(r.publicKey)) return null
  if (!isBoundedString(r.displayName, MAX_NAME_LEN)) return null
  const version = typeof r.version === 'number' ? r.version : 1
  return {
    $type: 'remember-me-contact',
    version: version as 1,
    deviceId: r.deviceId as string,
    publicKey: r.publicKey as string,
    displayName: r.displayName as string,
  }
}

import type { AppState } from '../types'

/**
 * On-disk / on-wire schema version of the persisted AppState.
 *
 * Stamped onto every save and onto every sync envelope. Today it is only
 * recorded (the structure has been backward-compatible so far), but having an
 * explicit version is the hook point for a real migration step the day a
 * breaking field change lands — instead of the ad-hoc, hard-coded migrations
 * currently scattered through useAnswers.
 */
export const CURRENT_APP_SCHEMA_VERSION = 1

/**
 * Defensive structural check for a deserialized AppState.
 *
 * AES-GCM already guarantees the bytes were not tampered with in transit, so
 * this is NOT a security boundary. It guards against a genuinely corrupt write
 * or a payload from a much older / future client: without it, `parsed as
 * AppState` would sail through and then crash deep inside a render (e.g.
 * `Object.values(answers)` on a non-object).
 *
 * Intentionally lenient — only `answers` is hard-required (the app cannot
 * function without its map). The list collections are validated only when
 * present so older states that predate a field still load and get normalized
 * by the loader downstream.
 */
export function isAppStateShape(x: unknown): x is AppState {
  if (!x || typeof x !== 'object') return false
  const s = x as Record<string, unknown>
  if (typeof s.answers !== 'object' || s.answers === null || Array.isArray(s.answers)) return false
  if (s.friends !== undefined && !Array.isArray(s.friends)) return false
  if (s.friendAnswers !== undefined && !Array.isArray(s.friendAnswers)) return false
  if (s.customQuestions !== undefined && !Array.isArray(s.customQuestions)) return false
  return true
}

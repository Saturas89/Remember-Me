import type { AppState } from '../types'

/**
 * On-disk / on-wire schema version of the persisted AppState.
 *
 * Stamped onto every localStorage save. On load, `loadStoredState` refuses a
 * payload whose version is greater than this constant (a future client may
 * carry field changes an older build cannot safely interpret); missing/equal/
 * older versions load normally, as the structure has been backward-compatible
 * so far. The constant is also the hook point for a real forward-migration step
 * the day a breaking field change lands — instead of the ad-hoc, hard-coded
 * migrations currently scattered through useAnswers.
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
 * Intentionally lenient: it only rejects values that would actually crash the
 * app (a non-object, or a field that exists with the wrong type). Every field
 * is optional — partial states such as `{ streak, appMode }` are valid because
 * the loader downstream normalizes missing collections to their empty defaults
 * (and several flows, e.g. notification seeds, persist exactly such partials).
 */
export function isAppStateShape(x: unknown): x is AppState {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false
  const s = x as Record<string, unknown>
  if (s.answers !== undefined && (typeof s.answers !== 'object' || s.answers === null || Array.isArray(s.answers))) return false
  if (s.friends !== undefined && !Array.isArray(s.friends)) return false
  if (s.friendAnswers !== undefined && !Array.isArray(s.friendAnswers)) return false
  if (s.customQuestions !== undefined && !Array.isArray(s.customQuestions)) return false
  return true
}

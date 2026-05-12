// Types for the Sandra-First "compose-your-own-question" flow.
//
// Sandra is the tech-savvier buyer who lands on `#/ask`, composes 2–10 personal
// questions in her own words, and sends them to a relative (Ingrid, the
// recipient) via the existing pack-code share mechanism. The resulting pack is
// the same question-pack shape used elsewhere in the app, only with a handful
// of optional metadata fields so the receiver side can detect and adapt.

import type { QuestionPack } from '../types'

export type TriggerGroup = 'biography' | 'relationship'

/**
 * A single template variant.
 *
 *  - `withSeed` may contain both `{anrede}` and `{seed}` placeholders.
 *    Used whenever the user typed a seed (3+ chars).
 *  - `withoutSeed` is used when the seed is empty. Only `{anrede}` allowed.
 *    Optional — if absent, the template only renders once a seed exists.
 */
export interface TemplateDef {
  id: string
  withSeed: string
  withoutSeed?: string
}

/**
 * One trigger = one "category" of personal questions (e.g. "Mensch, den du nie
 * kennengelernt hast"). Each trigger carries a handful of templates the user
 * can pick from in the composer step.
 */
export interface TriggerDef {
  id: string
  group: TriggerGroup
  /** Localized title (already resolved – data files are split by locale). */
  title: string
  templates: TemplateDef[]
}

/**
 * A single question Sandra has composed. Stored in the in-memory draft (and
 * mirrored to sessionStorage) until she sends the pack.
 *
 * Intentionally NO `isPrivate` flag — every composed question is meant to be
 * sent. Sandra simply doesn't add questions she wouldn't share.
 */
export interface ComposedQuestion {
  id: string
  triggerId: string
  group: TriggerGroup
  /** Final phrasing, possibly user-edited away from the template. */
  text: string
  /** What Sandra typed into the composer textarea, if anything. */
  seed?: string
  createdAt: number
}

/**
 * Anchor metadata for the recipient: who Sandra is thinking of and how she
 * addresses them. Used to substitute `{anrede}` in templates and to greet the
 * recipient on the receive side.
 */
export interface SandraAnchor {
  /** Relation key — one of the chip values or 'other' for free-text. */
  relation: string
  /** How Sandra addresses the recipient ("Mama", "Omi", "Vati", first name…). */
  anrede: string
  /** Optional birth year (1900–2020), helps tailor follow-up content. */
  birthYear?: number
}

export interface SandraDraft {
  anchor: SandraAnchor
  questions: ComposedQuestion[]
  /** Trigger currently selected in the composer (if any). */
  currentTriggerId?: string
  /** Seed text typed for the current trigger (if any). */
  currentSeed?: string
}

/**
 * Pack metadata that piggybacks on the existing AnswerExport / QuestionPack
 * shape. `personalPack === true` is the marker that flips the receiver side
 * into the softer Ingrid view.
 *
 * These fields are *additions* — older pack codes without them keep working.
 */
export interface PersonalPackMeta {
  personalPack: true
  senderName: string
  recipientLabel: string
  anrede: string
}

/**
 * REQ-020 §4: a Sandra-built pack is the regular QuestionPack shape plus the
 * personal-pack metadata. Declared here (next to PersonalPackMeta) so callers
 * have a single canonical import location.
 */
export type PersonalQuestionPack = QuestionPack & PersonalPackMeta

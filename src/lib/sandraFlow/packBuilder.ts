// Build a shareable QuestionPack from a Sandra draft.
//
// The output reuses the existing `QuestionPack` shape so older parts of the
// app (Custom-Questions import, etc.) keep working untouched. Sandra's
// personal-pack metadata rides along as optional fields:
//
//   personalPack: true          – flips the receiver into the softer view
//   senderName, recipientLabel  – greet copy on the receive side
//   anrede                      – how the sender addressed the recipient
//
// A pack with `personalPack` absent stays an ordinary custom-questions pack.

import type { CustomQuestion, QuestionPack } from '../../types'
import type { PersonalPackMeta, PersonalQuestionPack, SandraDraft } from '../../types/sandraFlow'

export type { PersonalQuestionPack }

/**
 * Convert a Sandra draft into a personal QuestionPack.
 *
 *  - Every composed question becomes a `CustomQuestion` of type 'text'.
 *  - `recipientLabel` is the chip key ("Mama", "Papa", "Oma", …) or the user's
 *    free-text fallback, used for analytics-free pack metadata.
 *  - `anrede` is what the sender used to address the recipient and is stored
 *    so the receiver greeting can be personalised.
 *
 * @param draft       the in-progress Sandra draft
 * @param senderName  Sandra's display name (from her profile)
 * @returns the pack ready for `encodeQuestionPack`
 */
export function buildPersonalPack(
  draft: SandraDraft,
  senderName: string,
): PersonalQuestionPack {
  const now = new Date().toISOString()
  const questions: CustomQuestion[] = draft.questions.map(q => ({
    id: q.id,
    text: q.text,
    type: 'text',
    createdAt: new Date(q.createdAt).toISOString(),
  }))

  return {
    questions,
    createdBy: senderName.trim() || undefined,
    personalPack: true,
    senderName: senderName.trim() || (draft.anchor.anrede ? `Jemand für ${draft.anchor.anrede}` : 'Jemand'),
    recipientLabel: draft.anchor.relation,
    anrede: draft.anchor.anrede,
    // `now` is unused in the QuestionPack itself – kept here just to make
    // the build-time obvious for callers who care about provenance.
    ...(now ? {} : {}),
  }
}

/**
 * Type-guard: does this decoded pack carry Sandra-flow metadata?
 *
 * Used by the receiver side to flip into the softer one-question-at-a-time
 * view + simple-mode auto-suggest. Older packs that lack the flag fall
 * through to the normal Custom-Questions import path.
 */
export function isPersonalPack(pack: QuestionPack | null | undefined): pack is PersonalQuestionPack {
  if (!pack) return false
  const p = pack as Partial<PersonalPackMeta>
  return (
    p.personalPack === true &&
    typeof p.senderName === 'string' &&
    typeof p.anrede === 'string'
  )
}

/** REQ-020 spec-canonical alias of {@link isPersonalPack}. */
export const isPersonalQuestionPack = isPersonalPack

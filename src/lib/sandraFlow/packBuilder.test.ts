import { describe, it, expect } from 'vitest'
import { buildPersonalPack, isPersonalPack } from './packBuilder'
import type { ComposedQuestion, SandraDraft } from '../../types/sandraFlow'
import type { QuestionPack } from '../../types'

// ─────────────────────────────────────────────────────────────────────────────
// packBuilder.buildPersonalPack – Sandra-draft → shareable QuestionPack.
//
// Implementation Agent contract (packBuilder.ts):
//   buildPersonalPack(draft: SandraDraft, senderName: string) → PersonalQuestionPack
//
//   - Every composed question becomes a CustomQuestion (type 'text')
//   - personalPack: true
//   - senderName, recipientLabel, anrede set from draft + arg
//   - QuestionPack-compatible: round-trips through encodeQuestionPack /
//     decodeQuestionPack untouched (legacy receivers still work)
//
// SPEC contract (§0 + §3):
//   - NO filtering on draft.questions (no private toggle)
//   - NO isPrivate field on any output question
// ─────────────────────────────────────────────────────────────────────────────

function makeQ(
  partial: Partial<ComposedQuestion> & Pick<ComposedQuestion, 'id' | 'text'>,
): ComposedQuestion {
  return {
    triggerId: 'trg-default',
    group: 'biography',
    createdAt: Date.now(),
    seed: undefined,
    ...partial,
  } as ComposedQuestion
}

function makeDraft(questions: ComposedQuestion[], anrede = 'Mama', relation = 'mama'): SandraDraft {
  return {
    anchor: { relation, anrede },
    questions,
  }
}

const Q_BIO = makeQ({ id: 'cq-bio-1', text: 'Wie war deine Schulzeit, Mama?', group: 'biography', triggerId: 'school' })
const Q_REL = makeQ({ id: 'cq-rel-1', text: 'Wie siehst du mich heute, Mama?', group: 'relationship', triggerId: 'how-you-see-me' })
const Q_PRIVATE_LOOKING = makeQ({
  id: 'cq-priv',
  text: 'Was hast du nie ausgesprochen?',
  group: 'relationship',
  triggerId: 'never-said',
})

describe('buildPersonalPack – question inclusion', () => {
  it('includes every question from the draft (no filtering — no private toggle)', () => {
    const draft = makeDraft([Q_BIO, Q_REL, Q_PRIVATE_LOOKING])
    const pack = buildPersonalPack(draft, 'Sandra')

    expect(pack.questions).toHaveLength(3)
    expect(pack.questions.map(q => q.text)).toEqual(
      expect.arrayContaining([Q_BIO.text, Q_REL.text, Q_PRIVATE_LOOKING.text]),
    )
  })

  it('preserves question text verbatim', () => {
    const pack = buildPersonalPack(makeDraft([Q_BIO]), 'Sandra')
    expect(pack.questions[0].text).toBe(Q_BIO.text)
  })

  it('every output question has type "text"', () => {
    const pack = buildPersonalPack(makeDraft([Q_BIO, Q_REL]), 'Sandra')
    for (const q of pack.questions) {
      expect(q.type).toBe('text')
    }
  })

  it('every output question has an ISO-format createdAt (string, not number)', () => {
    const pack = buildPersonalPack(makeDraft([Q_BIO]), 'Sandra')
    expect(typeof pack.questions[0].createdAt).toBe('string')
    // Parseable as an ISO date.
    expect(Number.isNaN(Date.parse(pack.questions[0].createdAt))).toBe(false)
  })
})


describe('buildPersonalPack – personal-pack metadata', () => {
  it('sets personalPack: true', () => {
    const pack = buildPersonalPack(makeDraft([Q_BIO]), 'Sandra')
    expect(pack.personalPack).toBe(true)
  })

  it('sets senderName from arg', () => {
    const pack = buildPersonalPack(makeDraft([Q_BIO]), 'Sandra')
    expect(pack.senderName).toBe('Sandra')
  })

  it('sets recipientLabel from draft.anchor.relation', () => {
    const pack = buildPersonalPack(makeDraft([Q_BIO], 'Omi', 'oma'), 'Sandra')
    expect(pack.recipientLabel).toBe('oma')
  })

  it('sets anrede from draft.anchor.anrede', () => {
    const pack = buildPersonalPack(makeDraft([Q_BIO], 'Omi', 'oma'), 'Sandra')
    expect(pack.anrede).toBe('Omi')
  })

  it('falls back to a default senderName when name is empty', () => {
    const pack = buildPersonalPack(makeDraft([Q_BIO], 'Mama'), '')
    // The exact fallback string is an implementation detail; the contract is
    // simply that some non-empty string lands in senderName so the receiver
    // can greet *something*.
    expect(typeof pack.senderName).toBe('string')
    expect(pack.senderName.length).toBeGreaterThan(0)
  })
})

describe('isPersonalPack – type guard', () => {
  it('returns true for a freshly built personal pack', () => {
    const pack = buildPersonalPack(makeDraft([Q_BIO]), 'Sandra')
    expect(isPersonalPack(pack)).toBe(true)
  })

  it('returns false for a plain legacy pack without personalPack flag', () => {
    const legacy: QuestionPack = {
      questions: [{ id: 'x', text: 't', type: 'text', createdAt: '2024-01-01T00:00:00.000Z' }],
    }
    expect(isPersonalPack(legacy)).toBe(false)
  })

  it('returns false for null / undefined', () => {
    expect(isPersonalPack(null)).toBe(false)
    expect(isPersonalPack(undefined)).toBe(false)
  })
})

describe('buildPersonalPack – defensive guards (no private toggle)', () => {
  it('NEVER attaches an isPrivate field to any output question', () => {
    const pack = buildPersonalPack(makeDraft([Q_BIO, Q_REL, Q_PRIVATE_LOOKING]), 'Sandra')
    for (const q of pack.questions) {
      expect((q as unknown as Record<string, unknown>).isPrivate).toBeUndefined()
    }
  })

  it('does NOT expose `isPrivate` on the top-level pack object', () => {
    const pack = buildPersonalPack(makeDraft([Q_BIO]), 'Sandra')
    expect((pack as unknown as Record<string, unknown>).isPrivate).toBeUndefined()
  })
})

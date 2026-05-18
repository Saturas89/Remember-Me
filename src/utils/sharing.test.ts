import { describe, it, expect } from 'vitest'
import {
  encodeAnswerExport,
  decodeAnswerExport,
  encodeQuestionPack,
  decodeQuestionPack,
} from './sharing'
import type { AnswerExport, QuestionPack } from '../types'
import type { PersonalQuestionPack } from '../types/sandraFlow'

// ── encodeAnswerExport / decodeAnswerExport ───────────────────────────────────

describe('encodeAnswerExport / decodeAnswerExport', () => {
  const data: AnswerExport = {
    friendId: 'f-001',
    friendName: 'Klaus',
    answers: [
      { questionId: 'q1', value: 'Antwort 1', questionText: 'Frage 1' },
      { questionId: 'q2', value: 'Antwort 2' },
    ],
  }

  it('round-trips a complete AnswerExport', () => {
    expect(decodeAnswerExport(encodeAnswerExport(data))).toEqual(data)
  })

  it('preserves optional questionText on answers', () => {
    const result = decodeAnswerExport(encodeAnswerExport(data))
    expect(result?.answers[0].questionText).toBe('Frage 1')
    expect(result?.answers[1].questionText).toBeUndefined()
  })

  it('trims leading and trailing whitespace before decoding', () => {
    const code = encodeAnswerExport(data)
    expect(decodeAnswerExport(`  ${code}  `)).toEqual(data)
  })

  it('returns null for invalid code', () => {
    expect(decodeAnswerExport('garbage-code')).toBeNull()
  })

  it('round-trips an empty answers list', () => {
    const empty: AnswerExport = { friendId: 'f-1', friendName: 'Test', answers: [] }
    expect(decodeAnswerExport(encodeAnswerExport(empty))).toEqual(empty)
  })

  it('handles umlauts in friendName', () => {
    const umlaut: AnswerExport = { friendId: 'f-2', friendName: 'Ünä-Müller', answers: [] }
    expect(decodeAnswerExport(encodeAnswerExport(umlaut))).toEqual(umlaut)
  })
})

// ── encodeQuestionPack / decodeQuestionPack ───────────────────────────────────

describe('encodeQuestionPack / decodeQuestionPack', () => {
  const pack: QuestionPack = {
    createdBy: 'Anna',
    questions: [
      {
        id: 'cq-1',
        text: 'Lieblingsgericht?',
        type: 'text',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  }

  it('round-trips a QuestionPack with questions', () => {
    expect(decodeQuestionPack(encodeQuestionPack(pack))).toEqual(pack)
  })

  it('accepts empty questions array', () => {
    const empty: QuestionPack = { questions: [] }
    expect(decodeQuestionPack(encodeQuestionPack(empty))).toEqual(empty)
  })

  it('returns null when questions field is absent', () => {
    const bad = btoa(encodeURIComponent(JSON.stringify({ createdBy: 'x' })))
    expect(decodeQuestionPack(bad)).toBeNull()
  })

  it('returns null when questions is not an array', () => {
    const bad = btoa(encodeURIComponent(JSON.stringify({ questions: 'not-an-array' })))
    expect(decodeQuestionPack(bad)).toBeNull()
  })

  it('returns null for completely invalid code', () => {
    expect(decodeQuestionPack('!!!notvalid')).toBeNull()
  })

  it('trims whitespace before decoding', () => {
    const code = encodeQuestionPack(pack)
    expect(decodeQuestionPack(`\n${code}\n`)).toEqual(pack)
  })

  it('rejects question with unknown type', () => {
    const bad = btoa(encodeURIComponent(JSON.stringify({
      questions: [{ id: 'a', text: 't', type: 'malicious', createdAt: 'x' }],
    })))
    expect(decodeQuestionPack(bad)).toBeNull()
  })

  it('rejects question text exceeding 2000 chars', () => {
    const bad = btoa(encodeURIComponent(JSON.stringify({
      questions: [{ id: 'a', text: 'x'.repeat(2_001), type: 'text', createdAt: 'x' }],
    })))
    expect(decodeQuestionPack(bad)).toBeNull()
  })

  it('rejects pack with more than 200 questions', () => {
    const tooMany = Array.from({ length: 201 }, (_, i) => ({
      id: `q-${i}`, text: 't', type: 'text' as const, createdAt: 'x',
    }))
    const bad = btoa(encodeURIComponent(JSON.stringify({ questions: tooMany })))
    expect(decodeQuestionPack(bad)).toBeNull()
  })

  it('rejects question with missing required field', () => {
    const bad = btoa(encodeURIComponent(JSON.stringify({
      questions: [{ id: 'a', text: 't', type: 'text' }], // no createdAt
    })))
    expect(decodeQuestionPack(bad)).toBeNull()
  })

  it('rejects options array with overly long entries', () => {
    const bad = btoa(encodeURIComponent(JSON.stringify({
      questions: [{
        id: 'a', text: 't', type: 'choice', createdAt: 'x',
        options: ['x'.repeat(201)],
      }],
    })))
    expect(decodeQuestionPack(bad)).toBeNull()
  })

  it('round-trips a choice question with options', () => {
    const choicePack: QuestionPack = {
      questions: [{
        id: 'cq-2', text: 'Lieblingsfarbe?', type: 'choice', createdAt: '2026-01-02T00:00:00.000Z',
        options: ['Rot', 'Blau', 'Grün'],
      }],
    }
    expect(decodeQuestionPack(encodeQuestionPack(choicePack))).toEqual(choicePack)
  })

  it('round-trips a personal pack with preferSimpleMode: true', () => {
    const personalPack: PersonalQuestionPack = {
      questions: [{ id: 'q1', text: 'Was?', type: 'text', createdAt: '2026-01-01T00:00:00.000Z' }],
      personalPack: true,
      senderName: 'Sandra',
      recipientLabel: 'mama',
      anrede: 'Mama',
      preferSimpleMode: true,
    }
    expect(decodeQuestionPack(encodeQuestionPack(personalPack))).toEqual(personalPack)
  })

  it('round-trips a personal pack with preferSimpleMode: false', () => {
    const personalPack: PersonalQuestionPack = {
      questions: [{ id: 'q1', text: 'Was?', type: 'text', createdAt: '2026-01-01T00:00:00.000Z' }],
      personalPack: true,
      senderName: 'Sandra',
      recipientLabel: 'mama',
      anrede: 'Mama',
      preferSimpleMode: false,
    }
    expect(decodeQuestionPack(encodeQuestionPack(personalPack))).toEqual(personalPack)
  })

  it('drops preferSimpleMode when pack is not a personal pack', () => {
    const plain = btoa(encodeURIComponent(JSON.stringify({
      questions: [{ id: 'q1', text: 'Was?', type: 'text', createdAt: 'x' }],
      preferSimpleMode: true,
    })))
    const decoded = decodeQuestionPack(plain)
    expect(decoded).not.toBeNull()
    expect((decoded as unknown as Record<string, unknown>).preferSimpleMode).toBeUndefined()
  })
})

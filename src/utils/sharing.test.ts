import { describe, it, expect } from 'vitest'
import {
  encodeAnswerExport,
  decodeAnswerExport,
  encodeQuestionPack,
  decodeQuestionPack,
} from './sharing'
import type { AnswerExport, QuestionPack } from '../types'

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
})

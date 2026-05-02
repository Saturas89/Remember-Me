// @vitest-environment node
//
// Unit tests for REQ-017 Private Sync LWW merge.
// Test IDs M-01 .. M-10 from Master-Spec §12.1.

import { describe, it, expect } from 'vitest'
import { mergeStates } from './privateSyncMerge'
import type { AppState, Answer, Profile } from '../types'

function makeAnswer(id: string, value: string, updatedAt: string): Answer {
  return {
    id,
    questionId: id,
    categoryId: 'cat-1',
    value,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt,
  }
}

function makeState(overrides: Partial<AppState> = {}): AppState {
  return {
    profile: null,
    answers: {},
    friends: [],
    friendAnswers: [],
    customQuestions: [],
    ...overrides,
  }
}

describe('mergeStates – LWW per answer', () => {
  it('M-01: Remote neuer → merged hat Remote-Wert', () => {
    const local = makeState({
      answers: { A: makeAnswer('A', 'local', '2024-01-01T00:00:00.100Z') },
    })
    const remote = makeState({
      answers: { A: makeAnswer('A', 'remote', '2024-01-01T00:00:00.200Z') },
    })
    const merged = mergeStates(local, remote)
    expect(merged.answers.A.value).toBe('remote')
  })

  it('M-02: Local neuer → merged hat Local-Wert', () => {
    const local = makeState({
      answers: { A: makeAnswer('A', 'local', '2024-01-01T00:00:00.200Z') },
    })
    const remote = makeState({
      answers: { A: makeAnswer('A', 'remote', '2024-01-01T00:00:00.100Z') },
    })
    const merged = mergeStates(local, remote)
    expect(merged.answers.A.value).toBe('local')
  })

  it('M-03: Gleicher Timestamp → tie geht an Remote', () => {
    const ts = '2024-01-01T00:00:00.100Z'
    const local = makeState({ answers: { A: makeAnswer('A', 'local', ts) } })
    const remote = makeState({ answers: { A: makeAnswer('A', 'remote', ts) } })
    const merged = mergeStates(local, remote)
    expect(merged.answers.A.value).toBe('remote')
  })

  it('M-04: Remote hat zusätzliche Antwort → merged enthält A+B', () => {
    const local = makeState({
      answers: { A: makeAnswer('A', 'a', '2024-01-01T00:00:00.000Z') },
    })
    const remote = makeState({
      answers: {
        A: makeAnswer('A', 'a', '2024-01-01T00:00:00.000Z'),
        B: makeAnswer('B', 'b', '2024-01-02T00:00:00.000Z'),
      },
    })
    const merged = mergeStates(local, remote)
    expect(Object.keys(merged.answers).sort()).toEqual(['A', 'B'])
    expect(merged.answers.B.value).toBe('b')
  })

  it('M-05: Local hat zusätzliche Antwort → merged enthält A+B', () => {
    const local = makeState({
      answers: {
        A: makeAnswer('A', 'a', '2024-01-01T00:00:00.000Z'),
        B: makeAnswer('B', 'b', '2024-01-02T00:00:00.000Z'),
      },
    })
    const remote = makeState({
      answers: { A: makeAnswer('A', 'a', '2024-01-01T00:00:00.000Z') },
    })
    const merged = mergeStates(local, remote)
    expect(Object.keys(merged.answers).sort()).toEqual(['A', 'B'])
    expect(merged.answers.B.value).toBe('b')
  })

  it('M-06: Profile remote neuer (createdAt) → merged nutzt Remote-Profile', () => {
    const localProfile: Profile = { name: 'Old', createdAt: '2024-01-01T00:00:00.000Z' }
    const remoteProfile: Profile = { name: 'New', createdAt: '2024-06-01T00:00:00.000Z' }
    const merged = mergeStates(
      makeState({ profile: localProfile }),
      makeState({ profile: remoteProfile }),
    )
    expect(merged.profile?.name).toBe('New')
  })

  it('M-07: Profile local neuer → merged behält Local-Profile', () => {
    const localProfile: Profile = { name: 'New', createdAt: '2024-06-01T00:00:00.000Z' }
    const remoteProfile: Profile = { name: 'Old', createdAt: '2024-01-01T00:00:00.000Z' }
    const merged = mergeStates(
      makeState({ profile: localProfile }),
      makeState({ profile: remoteProfile }),
    )
    expect(merged.profile?.name).toBe('New')
  })

  it('M-08: Keine Mutation der Inputs', () => {
    const localAnswer = makeAnswer('A', 'local', '2024-01-01T00:00:00.100Z')
    const remoteAnswer = makeAnswer('A', 'remote', '2024-01-01T00:00:00.200Z')
    const local = makeState({ answers: { A: localAnswer } })
    const remote = makeState({ answers: { A: remoteAnswer } })

    const localSnapshot = JSON.parse(JSON.stringify(local))
    const remoteSnapshot = JSON.parse(JSON.stringify(remote))

    const merged = mergeStates(local, remote)

    expect(local).toEqual(localSnapshot)
    expect(remote).toEqual(remoteSnapshot)
    expect(local.answers.A).toBe(localAnswer)
    expect(remote.answers.A).toBe(remoteAnswer)
    // Result is a fresh object (not the input)
    expect(merged).not.toBe(local)
    expect(merged).not.toBe(remote)
  })

  it('M-09: Leerer Remote State → merged = local answers', () => {
    const local = makeState({
      answers: {
        A: makeAnswer('A', 'a', '2024-01-01T00:00:00.000Z'),
        B: makeAnswer('B', 'b', '2024-01-02T00:00:00.000Z'),
      },
    })
    const remote = makeState({ answers: {} })
    const merged = mergeStates(local, remote)
    expect(Object.keys(merged.answers).sort()).toEqual(['A', 'B'])
    expect(merged.answers.A.value).toBe('a')
    expect(merged.answers.B.value).toBe('b')
  })

  it('M-10: Leerer Local State → merged = remote answers', () => {
    const local = makeState({ answers: {} })
    const remote = makeState({
      answers: {
        A: makeAnswer('A', 'a', '2024-01-01T00:00:00.000Z'),
        B: makeAnswer('B', 'b', '2024-01-02T00:00:00.000Z'),
      },
    })
    const merged = mergeStates(local, remote)
    expect(Object.keys(merged.answers).sort()).toEqual(['A', 'B'])
    expect(merged.answers.A.value).toBe('a')
    expect(merged.answers.B.value).toBe('b')
  })
})

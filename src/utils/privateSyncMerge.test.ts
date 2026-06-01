// @vitest-environment node
//
// Unit tests for REQ-017 Private Sync LWW merge.
// Test IDs M-01 .. M-11 from Master-Spec §12.1; M-12 .. M-14 cover the
// union-merge of content collections (friends / customQuestions / friendAnswers).

import { describe, it, expect } from 'vitest'
import { mergeStates } from './privateSyncMerge'
import type { AppState, Answer, Profile, Friend, CustomQuestion, FriendAnswer } from '../types'

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

  it('M-06: Profile remote neuer (updatedAt) → merged nutzt Remote-Profile', () => {
    // Beide Geräte teilen denselben createdAt (klassisches Sync-Setup);
    // remote wurde nach lokal aktualisiert → updatedAt entscheidet.
    const localProfile: Profile = {
      name: 'Old',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    }
    const remoteProfile: Profile = {
      name: 'New',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-06-01T00:00:00.000Z',
    }
    const merged = mergeStates(
      makeState({ profile: localProfile }),
      makeState({ profile: remoteProfile }),
    )
    expect(merged.profile?.name).toBe('New')
  })

  it('M-07: Profile local neuer → merged behält Local-Profile', () => {
    const localProfile: Profile = {
      name: 'New',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-06-01T00:00:00.000Z',
    }
    const remoteProfile: Profile = {
      name: 'Old',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    }
    const merged = mergeStates(
      makeState({ profile: localProfile }),
      makeState({ profile: remoteProfile }),
    )
    expect(merged.profile?.name).toBe('New')
  })

  it('M-11: Profile-Fallback ohne updatedAt → createdAt entscheidet', () => {
    // Backward-Kompatibilität: bestehende User vor 2.0.x haben kein updatedAt.
    const localProfile: Profile = { name: 'Old', createdAt: '2024-01-01T00:00:00.000Z' }
    const remoteProfile: Profile = { name: 'New', createdAt: '2024-06-01T00:00:00.000Z' }
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

describe('mergeStates – Union-Merge der Content-Collections', () => {
  const friend = (id: string, name: string): Friend => ({
    id, name, addedAt: '2024-01-01T00:00:00.000Z',
  })
  const customQuestion = (id: string, text: string): CustomQuestion => ({
    id, text, type: 'text', createdAt: '2024-01-01T00:00:00.000Z',
  })
  const friendAnswer = (id: string, value: string): FriendAnswer => ({
    id, friendId: 'f1', friendName: 'F', questionId: 'q1', value,
    createdAt: '2024-01-01T00:00:00.000Z',
  })

  it('M-12: Neues Gerät (leer lokal) erhält Remote friends/customQuestions/friendAnswers', () => {
    const local = makeState()
    const remote = makeState({
      friends: [friend('f1', 'Anna')],
      customQuestions: [customQuestion('c1', 'Lieblingsort?')],
      friendAnswers: [friendAnswer('fa1', 'hallo')],
    })
    const merged = mergeStates(local, remote)
    expect(merged.friends.map(f => f.id)).toEqual(['f1'])
    expect(merged.customQuestions.map(q => q.id)).toEqual(['c1'])
    expect(merged.friendAnswers.map(a => a.id)).toEqual(['fa1'])
  })

  it('M-13: Disjunkte IDs → Union (lokal zuerst, dann remote-only)', () => {
    const local = makeState({
      friends: [friend('f1', 'Anna')],
      customQuestions: [customQuestion('c1', 'A?')],
    })
    const remote = makeState({
      friends: [friend('f2', 'Ben')],
      customQuestions: [customQuestion('c2', 'B?')],
    })
    const merged = mergeStates(local, remote)
    expect(merged.friends.map(f => f.id)).toEqual(['f1', 'f2'])
    expect(merged.customQuestions.map(q => q.id)).toEqual(['c1', 'c2'])
  })

  it('M-14: ID-Konflikt → lokaler Eintrag gewinnt', () => {
    const local = makeState({ friends: [friend('f1', 'Anna-lokal')] })
    const remote = makeState({ friends: [friend('f1', 'Anna-remote')] })
    const merged = mergeStates(local, remote)
    expect(merged.friends).toHaveLength(1)
    expect(merged.friends[0].name).toBe('Anna-lokal')
  })
})

describe('mergeStates – Tombstones (Löschungen propagieren)', () => {
  const friend = (id: string, name: string, addedAt = '2024-01-01T00:00:00.000Z'): Friend => ({
    id, name, addedAt,
  })
  const customQuestion = (id: string, text: string): CustomQuestion => ({
    id, text, type: 'text', createdAt: '2024-01-01T00:00:00.000Z',
  })

  it('M-15: lokale Löschung verdrängt die Remote-Antwort statt sie wiederzubeleben', () => {
    const local = makeState({
      answers: {},
      deletions: { answers: { A: '2024-02-01T00:00:00.000Z' } },
    })
    const remote = makeState({
      answers: { A: makeAnswer('A', 'remote', '2024-01-15T00:00:00.000Z') },
    })
    const merged = mergeStates(local, remote)
    expect(merged.answers.A).toBeUndefined()
    // Tombstone bleibt erhalten, damit auch ein drittes Gerät die Löschung sieht.
    expect(merged.deletions?.answers?.A).toBe('2024-02-01T00:00:00.000Z')
  })

  it('M-16: Antwort, die nach der Löschung neu beantwortet wurde, überlebt', () => {
    const local = makeState({
      answers: { A: makeAnswer('A', 'neu', '2024-03-01T00:00:00.000Z') },
      deletions: { answers: { A: '2024-02-01T00:00:00.000Z' } },
    })
    const remote = makeState({ answers: {} })
    const merged = mergeStates(local, remote)
    expect(merged.answers.A?.value).toBe('neu')
  })

  it('M-17: Tombstone für einen Freund entfernt ihn aus dem Union-Merge', () => {
    const local = makeState({
      friends: [],
      deletions: { friends: { f1: '2024-02-01T00:00:00.000Z' } },
    })
    const remote = makeState({ friends: [friend('f1', 'Anna')] })
    const merged = mergeStates(local, remote)
    expect(merged.friends).toHaveLength(0)
  })

  it('M-18: nach der Löschung neu hinzugefügter Freund (neuerer addedAt) bleibt', () => {
    const local = makeState({
      friends: [friend('f1', 'Anna-neu', '2024-03-01T00:00:00.000Z')],
      deletions: { friends: { f1: '2024-02-01T00:00:00.000Z' } },
    })
    const remote = makeState({ friends: [] })
    const merged = mergeStates(local, remote)
    expect(merged.friends.map(f => f.id)).toEqual(['f1'])
  })

  it('M-19: Tombstones beider Seiten werden vereinigt (jüngster Zeitstempel gewinnt)', () => {
    const local = makeState({
      deletions: { customQuestions: { c1: '2024-02-01T00:00:00.000Z' } },
    })
    const remote = makeState({
      customQuestions: [customQuestion('c1', 'A?')],
      deletions: { customQuestions: { c2: '2024-03-01T00:00:00.000Z' } },
    })
    const merged = mergeStates(local, remote)
    expect(merged.customQuestions).toHaveLength(0)
    expect(merged.deletions?.customQuestions).toEqual({
      c1: '2024-02-01T00:00:00.000Z',
      c2: '2024-03-01T00:00:00.000Z',
    })
  })
})

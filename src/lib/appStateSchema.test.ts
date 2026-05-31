import { describe, it, expect } from 'vitest'
import { isAppStateShape, CURRENT_APP_SCHEMA_VERSION } from './appStateSchema'

const valid = {
  profile: null,
  answers: {},
  friends: [],
  friendAnswers: [],
  customQuestions: [],
}

describe('isAppStateShape', () => {
  it('accepts a well-formed state', () => {
    expect(isAppStateShape(valid)).toBe(true)
  })

  it('accepts a state missing the optional list collections', () => {
    expect(isAppStateShape({ profile: null, answers: {} })).toBe(true)
  })

  it('rejects non-objects', () => {
    expect(isAppStateShape(null)).toBe(false)
    expect(isAppStateShape(undefined)).toBe(false)
    expect(isAppStateShape('x')).toBe(false)
    expect(isAppStateShape(42)).toBe(false)
  })

  it('rejects a missing or non-object answers map', () => {
    expect(isAppStateShape({ profile: null })).toBe(false)
    expect(isAppStateShape({ answers: [] })).toBe(false)
    expect(isAppStateShape({ answers: null })).toBe(false)
  })

  it('rejects list collections that are not arrays', () => {
    expect(isAppStateShape({ answers: {}, friends: {} })).toBe(false)
    expect(isAppStateShape({ answers: {}, friendAnswers: 'no' })).toBe(false)
    expect(isAppStateShape({ answers: {}, customQuestions: 1 })).toBe(false)
  })

  it('exposes a numeric current version', () => {
    expect(typeof CURRENT_APP_SCHEMA_VERSION).toBe('number')
  })
})

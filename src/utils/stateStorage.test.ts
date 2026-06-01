import { describe, it, expect, beforeEach } from 'vitest'
import { loadStoredState, _resetForTests } from './stateStorage'
import { CURRENT_APP_SCHEMA_VERSION } from '../lib/appStateSchema'

const STORAGE_KEY = 'remember-me-state'

// Plaintext (no "enc1:" prefix) is read back without needing the CryptoKey,
// so these tests exercise the load guards without crypto/IDB.
function seedPlaintext(obj: unknown): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
}

describe('loadStoredState – schema version guard', () => {
  beforeEach(() => {
    localStorage.clear()
    _resetForTests()
  })

  it('refuses a payload from a future client version', async () => {
    seedPlaintext({
      schemaVersion: CURRENT_APP_SCHEMA_VERSION + 1,
      profile: null,
      answers: { A: { value: 'x' } },
    })
    expect(await loadStoredState()).toBeNull()
  })

  it('loads a payload stamped with the current version', async () => {
    seedPlaintext({
      schemaVersion: CURRENT_APP_SCHEMA_VERSION,
      profile: null,
      answers: {},
      friends: [],
    })
    const loaded = await loadStoredState()
    expect(loaded).not.toBeNull()
    expect(loaded?.friends).toEqual([])
  })

  it('loads a legacy payload without a version stamp', async () => {
    seedPlaintext({ profile: null, answers: {} })
    expect(await loadStoredState()).not.toBeNull()
  })

  it('returns null for a structurally broken payload', async () => {
    seedPlaintext({ answers: 'not-an-object' })
    expect(await loadStoredState()).toBeNull()
  })
})

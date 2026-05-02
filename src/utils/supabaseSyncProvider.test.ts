// @vitest-environment node
//
// Unit tests for REQ-017 SupabaseSyncProvider.
// Test IDs SP-01 .. SP-05 from Master-Spec §12.3.
//
// Runs in Node so crypto.subtle is the real implementation; uses
// fake-indexeddb to back the vault-key cache layer.

import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── In-memory Supabase mock ────────────────────────────────────────────────

interface UpsertCapture { table: string; payload: Record<string, unknown> }
interface SelectScript {
  data: { state_ct: string; state_iv: string } | null
  error: { code?: string; message: string } | null
}

const recorder = {
  upserts: [] as UpsertCapture[],
  upsertResult: { error: null as { code?: string; message: string } | null },
  selectScript: { data: null, error: null } as SelectScript,
  authUser: { id: 'user-test' } as { id: string } | null,
}

class QB {
  constructor(public table: string) {}
  upsert(payload: Record<string, unknown>) {
    recorder.upserts.push({ table: this.table, payload })
    return Promise.resolve({ error: recorder.upsertResult.error })
  }
  select(_cols: string) {
    return {
      eq: (_col: string, _val: unknown) => ({
        single: () => Promise.resolve(recorder.selectScript),
      }),
    }
  }
  delete() {
    return { eq: (_col: string, _val: unknown) => Promise.resolve({ error: null }) }
  }
}

const mockSupabase = {
  from: (table: string) => new QB(table),
  auth: {
    getUser: () =>
      Promise.resolve({ data: { user: recorder.authUser }, error: null }),
    signOut: () => Promise.resolve({ error: null }),
  },
}

vi.mock('./privateSyncClient', () => ({
  getSyncSupabaseClient: () => mockSupabase,
  resetSyncSupabaseClient: vi.fn(),
}))

// Imports go below the vi.mock() so the provider picks up the fake client.
import { SupabaseSyncProvider } from './supabaseSyncProvider'
import { SyncError } from './privateSyncProvider'
import {
  deriveVaultKey,
  encryptText,
  cacheVaultKey,
  clearCachedVaultKey,
} from './recoveryCode'
import type { AppState } from '../types'

const USER_ID = 'user-test'
const RECOVERY_CODE = 'ABCDEFGHIJKLMNOPQRSTUVWX'

function makeAppState(): AppState {
  return {
    profile: { name: 'Anna', createdAt: '2024-01-01T00:00:00.000Z' },
    answers: {
      A: {
        id: 'A',
        questionId: 'Q1',
        categoryId: 'cat',
        value: 'lieblingstier',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    },
    friends: [],
    friendAnswers: [],
    customQuestions: [],
  }
}

const noopMedia = {
  getImageBlob: async () => null,
  getAudioBlob: async () => null,
  getVideoBlob: async () => null,
  putImage: async () => {},
  putAudio: async () => {},
  putVideo: async () => {},
  listLocalMediaIds: async () => ({ images: [], audio: [], videos: [] }),
}

describe('SupabaseSyncProvider', () => {
  beforeEach(async () => {
    recorder.upserts.length = 0
    recorder.upsertResult.error = null
    recorder.selectScript = { data: null, error: null }
    recorder.authUser = { id: USER_ID }
    await clearCachedVaultKey(USER_ID)
  })

  it('SP-01: push → Upsert ist verschlüsselt + recovery-code-Encryption-Tag', async () => {
    const key = await deriveVaultKey(RECOVERY_CODE, USER_ID)
    await cacheVaultKey(USER_ID, key)

    const provider = new SupabaseSyncProvider(USER_ID)
    const state = makeAppState()
    await provider.push(state, noopMedia)

    expect(recorder.upserts).toHaveLength(1)
    const payload = recorder.upserts[0].payload
    expect(recorder.upserts[0].table).toBe('private_sync_state')
    expect(payload.user_id).toBe(USER_ID)
    expect(payload.encryption).toBe('recovery-code')
    expect(typeof payload.state_ct).toBe('string')
    expect(typeof payload.state_iv).toBe('string')
    expect(payload.state_ct as string).not.toContain('lieblingstier')
    expect(payload.state_ct as string).not.toContain('Anna')
  })

  it('SP-02: pull → entschlüsselt Remote-State und liefert merged AppState', async () => {
    const key = await deriveVaultKey(RECOVERY_CODE, USER_ID)
    await cacheVaultKey(USER_ID, key)

    const remoteState = makeAppState()
    remoteState.answers.A.value = 'remote-value'
    remoteState.answers.A.updatedAt = '2025-12-31T00:00:00.000Z'
    const { ct, iv } = await encryptText(JSON.stringify(remoteState), key)
    recorder.selectScript = { data: { state_ct: ct, state_iv: iv }, error: null }

    const provider = new SupabaseSyncProvider(USER_ID)
    const local = makeAppState()
    const result = await provider.pull(local, noopMedia)

    expect(result).not.toBeNull()
    expect(result!.merged.answers.A.value).toBe('remote-value')
    expect(result!.downloadedMediaIds).toEqual([])
  })

  it('SP-03: pull → leere Tabelle (PGRST116) → null', async () => {
    const key = await deriveVaultKey(RECOVERY_CODE, USER_ID)
    await cacheVaultKey(USER_ID, key)

    recorder.selectScript = {
      data: null,
      error: { code: 'PGRST116', message: 'No rows found' },
    }
    const provider = new SupabaseSyncProvider(USER_ID)
    const result = await provider.pull(makeAppState(), noopMedia)
    expect(result).toBeNull()
  })

  it('SP-04: pull → falscher Vault-Key → SyncError("decrypt")', async () => {
    // Encrypt with the *correct* key, then cache a different one.
    const correct = await deriveVaultKey(RECOVERY_CODE, USER_ID)
    const wrong = await deriveVaultKey('YZABCDEFGHIJKLMNOPQRSTUV', USER_ID)
    const { ct, iv } = await encryptText(JSON.stringify(makeAppState()), correct)
    recorder.selectScript = { data: { state_ct: ct, state_iv: iv }, error: null }
    await cacheVaultKey(USER_ID, wrong)

    const provider = new SupabaseSyncProvider(USER_ID)
    let captured: unknown
    try {
      await provider.pull(makeAppState(), noopMedia)
    } catch (err) {
      captured = err
    }
    expect(captured).toBeInstanceOf(SyncError)
    expect((captured as SyncError).code).toBe('decrypt')
  })

  it('SP-05: push → Auth-Fehler (401) → SyncError("auth")', async () => {
    const key = await deriveVaultKey(RECOVERY_CODE, USER_ID)
    await cacheVaultKey(USER_ID, key)
    recorder.upsertResult.error = { message: 'JWT expired (401)' }

    const provider = new SupabaseSyncProvider(USER_ID)
    let captured: unknown
    try {
      await provider.push(makeAppState(), noopMedia)
    } catch (err) {
      captured = err
    }
    expect(captured).toBeInstanceOf(SyncError)
    expect((captured as SyncError).code).toBe('auth')
  })
})

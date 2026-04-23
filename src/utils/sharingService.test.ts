// @vitest-environment node
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Supabase mock ─────────────────────────────────────────────────────────
// Tiny query builder that records writes and yields scripted reads.

interface Response<T = unknown> { data: T | null; error: Error | null }

class QueryBuilder {
  private _action: 'select' | 'insert' | 'upsert' | 'delete' | null = null
  private _select: string | null = null
  private _single = false
  constructor(public table: string, public recorder: ServiceRecorder) {}
  select(cols: string) { this._select = cols; this._action ??= 'select'; return this }
  insert(payload: unknown) { this._action = 'insert'; this.recorder.inserts.push({ table: this.table, payload }); return this }
  upsert(payload: unknown) { this._action = 'upsert'; this.recorder.upserts.push({ table: this.table, payload }); return this }
  delete() { this._action = 'delete'; this.recorder.deletes.push({ table: this.table }); return this }
  eq(_col: string, _val: unknown) { return this }
  in(_col: string, _vals: unknown[]) { return this }
  maybeSingle() { this._single = true; return this.runRead() }
  single() { this._single = true; return this.runRead() }
  then<R>(onFulfilled: (r: Response) => R) { return this.runRead().then(onFulfilled) }
  private runRead(): Promise<Response> {
    if (this._action === 'insert' || this._action === 'upsert') {
      // Insert with .select('id').single() → return scripted insertedId
      const row = this.recorder.nextInsertedId?.(this.table) ?? { id: `gen-${Math.random().toString(36).slice(2, 8)}` }
      return Promise.resolve({ data: this._select ? row : null, error: null })
    }
    if (this._action === 'delete') return Promise.resolve({ data: null, error: null })
    const rows = this.recorder.selectRows?.(this.table) ?? []
    if (this._single) return Promise.resolve({ data: rows[0] ?? null, error: null })
    return Promise.resolve({ data: rows, error: null })
  }
}

interface ServiceRecorder {
  inserts: Array<{ table: string; payload: unknown }>
  upserts: Array<{ table: string; payload: unknown }>
  deletes: Array<{ table: string }>
  storageUploads: Array<{ bucket: string; path: string; bytes: Uint8Array }>
  nextInsertedId?: (table: string) => { id: string }
  selectRows?: (table: string) => unknown[]
}

function makeSupabase(recorder: ServiceRecorder) {
  return {
    from: (table: string) => new QueryBuilder(table, recorder),
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, bytes: Uint8Array) => {
          recorder.storageUploads.push({ bucket, path, bytes })
          return { error: null }
        },
      }),
    },
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'device-self' } } } }),
      signOut: async () => ({ error: null }),
    },
  }
}

const recorder: ServiceRecorder = {
  inserts: [], upserts: [], deletes: [], storageUploads: [],
}

vi.mock('./supabaseClient', () => ({
  getSupabaseClient: () => makeSupabase(recorder),
  ensureAnonymousSession: vi.fn(async () => 'device-self'),
  resetSupabaseClient: vi.fn(),
}))

vi.mock('./deviceKeyStore', () => ({
  loadOrCreateDeviceKey: vi.fn(async () => ({
    keyPair: { publicKey: {}, privateKey: {} } as { publicKey: object; privateKey: object },
    publicKeyB64: 'AAAA',
  })),
  clearDeviceKey: vi.fn(async () => {}),
}))

vi.mock('./shareEncryption', () => ({
  encryptShare: vi.fn(async () => ({
    ciphertext: 'CT',
    iv: 'IV',
    encryptedKeys: [{ recipientDeviceId: 'r1', wrappedKey: 'WK', ephemeralPublicKey: 'EPK' }],
  })),
  decryptShare: vi.fn(async () => ({
    body: {
      $type: 'remember-me-share' as const,
      version: 1 as const,
      ownerName: 'Anna',
      questionId: 'q1',
      questionText: 'Q?',
      value: 'v',
      imageCount: 0,
      createdAt: '2024-01-01T00:00:00.000Z',
    },
    contentKey: new Uint8Array(32),
  })),
  encryptAnnotation: vi.fn(async () => ({
    ciphertext: 'CT-A', iv: 'IV-A', encryptedKeys: [],
  })),
  decryptAnnotation: vi.fn(async () => ({
    $type: 'remember-me-annotation' as const,
    version: 1 as const,
    authorName: 'Ben', text: 'cool', imageCount: 0, createdAt: '2024-01-01T00:00:00.000Z',
  })),
  encryptImage: vi.fn(async () => ({
    ciphertext: new Uint8Array([1, 2, 3]), iv: 'IV-I',
  })),
}))

// ── Reset module state between tests ─────────────────────────────────────

async function loadService() {
  vi.resetModules()
  recorder.inserts = []
  recorder.upserts = []
  recorder.deletes = []
  recorder.storageUploads = []
  recorder.nextInsertedId = undefined
  recorder.selectRows = undefined
  return await import('./sharingService')
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('sharingService', () => {
  let svc: Awaited<ReturnType<typeof loadService>>
  beforeEach(async () => { svc = await loadService() })

  it('bootstrapSession upserts the device row and memoizes the result', async () => {
    const first = await svc.bootstrapSession()
    expect(first.deviceId).toBe('device-self')
    expect(first.publicKeyB64).toBe('AAAA')
    expect(recorder.upserts).toHaveLength(1)
    expect(recorder.upserts[0].table).toBe('devices')

    // Idempotent: second call does not upsert again
    const second = await svc.bootstrapSession()
    expect(second).toBe(first)
    expect(recorder.upserts).toHaveLength(1)
  })

  it('currentSession returns null before bootstrap and the session afterwards', async () => {
    expect(svc.currentSession()).toBeNull()
    await svc.bootstrapSession()
    expect(svc.currentSession()?.deviceId).toBe('device-self')
  })

  it('shareMemory without images inserts a share row and an ACL row for the owner', async () => {
    await svc.bootstrapSession()
    recorder.nextInsertedId = t => t === 'shares' ? { id: 'share-123' } : { id: 'x' }

    await svc.shareMemory({
      body: {
        $type: 'remember-me-share', version: 1,
        ownerName: 'Anna',
        questionId: 'q1',
        questionText: 'Q?',
        value: 'v',
        imageCount: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      recipients: [],
      images: [],
    })

    const shareInsert = recorder.inserts.find(i => i.table === 'shares')
    expect(shareInsert).toBeDefined()
    const aclInsert = recorder.inserts.find(i => i.table === 'share_recipients')
    expect(aclInsert).toBeDefined()
    expect(Array.isArray(aclInsert!.payload)).toBe(true)
    expect((aclInsert!.payload as Array<{ recipient_id: string }>)[0].recipient_id).toBe('device-self')
  })

  it('shareMemory uploads one encrypted blob per image and inserts a share_media row', async () => {
    await svc.bootstrapSession()
    recorder.nextInsertedId = t => t === 'shares' ? { id: 'share-xyz' } : { id: 'x' }

    await svc.shareMemory({
      body: {
        $type: 'remember-me-share', version: 1,
        ownerName: 'Anna', questionId: 'q1', questionText: 'Q?', value: 'v',
        imageCount: 1, createdAt: '2024-01-01T00:00:00.000Z',
      },
      recipients: [],
      images: [new Uint8Array([9, 9, 9])],
    })

    expect(recorder.storageUploads).toHaveLength(1)
    expect(recorder.storageUploads[0].bucket).toBe('share-media')
    expect(recorder.storageUploads[0].path).toMatch(/^share-xyz\/.+\.bin$/)
    expect(recorder.inserts.filter(i => i.table === 'share_media')).toHaveLength(1)
  })

  it('addAnnotation requires an active session', async () => {
    await expect(
      svc.addAnnotation({
        shareId: 's1',
        body: { $type: 'remember-me-annotation', version: 1, authorName: 'Ben', text: 'hi', imageCount: 0, createdAt: '2024-01-01T00:00:00.000Z' },
        audience: [],
      }),
    ).rejects.toThrow(/not bootstrapped/)
  })

  it('addAnnotation inserts an encrypted row after bootstrap', async () => {
    await svc.bootstrapSession()
    recorder.nextInsertedId = () => ({ id: 'anno-1' })
    const res = await svc.addAnnotation({
      shareId: 's1',
      body: { $type: 'remember-me-annotation', version: 1, authorName: 'Ben', text: 'hi', imageCount: 0, createdAt: '2024-01-01T00:00:00.000Z' },
      audience: [],
    })
    expect(res.annotationId).toBe('anno-1')
    expect(recorder.inserts.find(i => i.table === 'annotations')).toBeDefined()
  })

  it('deactivateOnlineSharing deletes the device row, clears local keys and nulls the session', async () => {
    await svc.bootstrapSession()
    expect(svc.currentSession()).not.toBeNull()

    await svc.deactivateOnlineSharing()
    expect(recorder.deletes.find(d => d.table === 'devices')).toBeDefined()
    expect(svc.currentSession()).toBeNull()
  })

  it('lookupRecipientPublicKey converts postgres bytea \\x<hex> into base64url', async () => {
    recorder.selectRows = t => t === 'devices' ? [{ public_key: '\\x616263' }] : [] // 'abc'
    const pub = await svc.lookupRecipientPublicKey('some-id')
    expect(pub).toBe('YWJj') // base64url of 'abc'
  })

  it('lookupRecipientPublicKey returns already-base64url strings untouched', async () => {
    recorder.selectRows = () => [{ public_key: 'preEncoded' }]
    const pub = await svc.lookupRecipientPublicKey('some-id')
    expect(pub).toBe('preEncoded')
  })

  it('lookupRecipientPublicKey returns null when the device row is missing', async () => {
    recorder.selectRows = () => []
    expect(await svc.lookupRecipientPublicKey('missing')).toBeNull()
  })

  it('fetchIncomingShares returns [] when there are no shares addressed to the device', async () => {
    await svc.bootstrapSession()
    recorder.selectRows = () => []
    const { memories, annotations } = await svc.fetchIncomingShares()
    expect(memories).toEqual([])
    expect(annotations).toEqual([])
  })

  it('fetchIncomingShares decrypts shares and decorates them with owner info', async () => {
    await svc.bootstrapSession()
    recorder.selectRows = table => {
      if (table === 'shares') {
        return [{
          id: 'share-1',
          owner_id: 'owner-a',
          ciphertext: '\\x00',
          iv: '\\x00',
          encrypted_keys: [],
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-02T00:00:00.000Z',
        }]
      }
      if (table === 'devices') return [{ id: 'owner-a', public_key: 'ownerPub' }]
      if (table === 'annotations') return []
      return []
    }
    const { memories, annotations } = await svc.fetchIncomingShares()
    expect(memories).toHaveLength(1)
    expect(memories[0].shareId).toBe('share-1')
    expect(memories[0].ownerDeviceId).toBe('owner-a')
    expect(memories[0].ownerName).toBe('Anna')
    expect(memories[0].updatedAt).toBe('2024-01-02T00:00:00.000Z')
    expect(annotations).toEqual([])
  })
})

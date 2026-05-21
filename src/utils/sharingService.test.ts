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
  not(_col: string, _op: string, _val: unknown) { return this }
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

    await svc.shareMemory({
      body: {
        $type: 'remember-me-share', version: 1,
        ownerName: 'Anna', questionId: 'q1', questionText: 'Q?', value: 'v',
        imageCount: 1, createdAt: '2024-01-01T00:00:00.000Z',
      },
      recipients: [],
      images: [new Uint8Array([9, 9, 9])],
    })

    // H2: shareMemory now generates the row id client-side and embeds it in
    // the insert payload (so AES-GCM's AAD can bind to it). The storage
    // path uses that same client-generated id, not a server return value.
    const shareInsert = recorder.inserts.find(i => i.table === 'shares')
    const shareId = (shareInsert!.payload as { id: string }).id
    expect(shareId).toMatch(/^[0-9a-f-]{36}$/i)
    expect(recorder.storageUploads).toHaveLength(1)
    expect(recorder.storageUploads[0].bucket).toBe('share-media')
    expect(recorder.storageUploads[0].path).toMatch(new RegExp(`^${shareId}/.+\\.bin$`))
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
    const res = await svc.addAnnotation({
      shareId: 's1',
      body: { $type: 'remember-me-annotation', version: 1, authorName: 'Ben', text: 'hi', imageCount: 0, createdAt: '2024-01-01T00:00:00.000Z' },
      audience: [],
    })
    // H2: annotation id is generated client-side and embedded in the insert
    // payload so AES-GCM's AAD binds the ciphertext to it.
    expect(res.annotationId).toMatch(/^[0-9a-f-]{36}$/i)
    const annoInsert = recorder.inserts.find(i => i.table === 'annotations')
    expect(annoInsert).toBeDefined()
    expect((annoInsert!.payload as { id: string }).id).toBe(res.annotationId)
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

  // ── REQ-022: auto-share entry point ────────────────────────────────────

  it('shareMemoryToAllFriends builds a ShareBody and delegates to shareMemory', async () => {
    await svc.bootstrapSession()
    recorder.nextInsertedId = t => t === 'shares' ? { id: 'share-multicast' } : { id: 'x' }

    await svc.shareMemoryToAllFriends(
      {
        id: 'answer-1',
        questionId: 'q-text-1',
        categoryId: 'childhood',
        value: 'Sommer am See',
        createdAt: '2026-05-20T10:00:00.000Z',
        updatedAt: '2026-05-20T10:00:00.000Z',
      },
      'Was war ein schöner Sommer?',
      [{ deviceId: 'friend-1', publicKey: 'PK1' }],
      'Alice',
    )

    const shareInsert = recorder.inserts.find(i => i.table === 'shares')
    expect(shareInsert, 'shareMemoryToAllFriends should insert a share row').toBeDefined()
    const aclInsert = recorder.inserts.find(i => i.table === 'share_recipients')
    expect(aclInsert).toBeDefined()
    const recipients = (aclInsert!.payload as Array<{ recipient_id: string }>).map(r => r.recipient_id)
    expect(recipients).toContain('device-self')
    expect(recipients).toContain('friend-1')
  })

  it('shareMemoryToAllFriends forces imageCount to 0 (text-only auto-share)', async () => {
    await svc.bootstrapSession()
    const { encryptShare } = await import('./shareEncryption')

    await svc.shareMemoryToAllFriends(
      {
        id: 'a',
        questionId: 'q1',
        categoryId: 'c',
        value: 'v',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      'Q?',
      [{ deviceId: 'r', publicKey: 'PK' }],
      'Anna',
    )

    expect(encryptShare).toHaveBeenCalled()
    const firstCall = (encryptShare as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(firstCall[0].imageCount).toBe(0)
  })

  // ── REQ-022: answer_id on auto-shares ─────────────────────────────────────

  it('shareMemoryToAllFriends stores answer_id on the share row', async () => {
    await svc.bootstrapSession()
    await svc.shareMemoryToAllFriends(
      { id: 'answer-42', questionId: 'q1', categoryId: 'c', value: 'v', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
      'Q?',
      [{ deviceId: 'friend-1', publicKey: 'PK' }],
      'Anna',
    )
    const shareInsert = recorder.inserts.find(i => i.table === 'shares')
    expect((shareInsert!.payload as Record<string, unknown>).answer_id).toBe('answer-42')
  })

  it('shareMemory without answerId does not include answer_id in the row', async () => {
    await svc.bootstrapSession()
    await svc.shareMemory({
      body: { $type: 'remember-me-share', version: 1, questionId: 'q1', questionText: 'Q?', value: 'v', imageCount: 0, createdAt: '2026-01-01T00:00:00.000Z', ownerName: 'Anna' },
      recipients: [{ deviceId: 'r', publicKey: 'PK' }],
      images: [],
    })
    const shareInsert = recorder.inserts.find(i => i.table === 'shares')
    expect((shareInsert!.payload as Record<string, unknown>).answer_id).toBeUndefined()
  })

  // ── hydrateShareLog ────────────────────────────────────────────────────────

  it('hydrateShareLog populates IndexedDB from server shares', async () => {
    await svc.bootstrapSession()
    recorder.selectRows = table => {
      if (table === 'shares') return [
        { answer_id: 'a1', created_at: '2026-01-10T00:00:00.000Z', share_recipients: [{ recipient_id: 'friend-1' }, { recipient_id: 'device-self' }] },
        { answer_id: 'a2', created_at: '2026-01-11T00:00:00.000Z', share_recipients: [{ recipient_id: 'friend-2' }] },
        { answer_id: null, created_at: '2026-01-01T00:00:00.000Z', share_recipients: [{ recipient_id: 'friend-1' }] },
      ]
      return []
    }
    await svc.hydrateShareLog()

    const { getShareLogEntry } = await import('./shareLogStore')
    // a1 → friend-1 should be set; self-ACL skipped
    expect(await getShareLogEntry('a1', 'friend-1')).toBe('2026-01-10T00:00:00.000Z')
    // a2 → friend-2 set
    expect(await getShareLogEntry('a2', 'friend-2')).toBe('2026-01-11T00:00:00.000Z')
    // null answer_id row should be ignored
    expect(await getShareLogEntry('', 'friend-1')).toBeNull()
    // self-ACL skipped
    expect(await getShareLogEntry('a1', 'device-self')).toBeNull()
  })

  it('hydrateShareLog takes the latest createdAt per (answer, recipient) pair', async () => {
    await svc.bootstrapSession()
    recorder.selectRows = table => {
      if (table === 'shares') return [
        { answer_id: 'a1', created_at: '2026-01-05T00:00:00.000Z', share_recipients: [{ recipient_id: 'friend-1' }] },
        { answer_id: 'a1', created_at: '2026-01-15T00:00:00.000Z', share_recipients: [{ recipient_id: 'friend-1' }] },
      ]
      return []
    }
    await svc.hydrateShareLog()

    const { getShareLogEntry } = await import('./shareLogStore')
    expect(await getShareLogEntry('a1', 'friend-1')).toBe('2026-01-15T00:00:00.000Z')
  })

  it('unshareAllWithFriend deletes share_recipients rows for shares we own', async () => {
    await svc.bootstrapSession()
    recorder.selectRows = table => {
      if (table === 'shares') return [{ id: 's-1' }, { id: 's-2' }]
      return []
    }
    await svc.unshareAllWithFriend('friend-x')

    const recipDelete = recorder.deletes.find(d => d.table === 'share_recipients')
    expect(recipDelete, 'should issue a DELETE on share_recipients').toBeDefined()
  })

  it('unshareAllWithFriend skips the delete when the user owns no shares', async () => {
    await svc.bootstrapSession()
    recorder.selectRows = () => []
    await svc.unshareAllWithFriend('friend-x')
    expect(recorder.deletes.find(d => d.table === 'share_recipients')).toBeUndefined()
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

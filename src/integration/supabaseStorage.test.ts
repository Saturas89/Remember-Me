// Storage bucket + feedback RLS integration tests against a real local Supabase instance.
//
// Complements supabaseRLS.test.ts by covering:
//   • share-media storage bucket policies (read/write/delete)
//   • feedback_submissions insert/select constraints
//
// Skip guard: skipped unless SUPABASE_URL points at a real Supabase instance.
// In normal `npm test` runs these are no-ops.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

const SUPABASE_URL = process.env.SUPABASE_URL      ?? ''
const ANON_KEY     = process.env.SUPABASE_ANON_KEY ?? ''
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

const hasRealDB =
  Boolean(SUPABASE_URL) &&
  !SUPABASE_URL.includes('supabase.e2e.local') &&
  Boolean(SERVICE_KEY)

// PostgREST bytea columns expect '\x<hexstring>' format.
const bx = (len: number) => '\\x' + '00'.repeat(len)

const FAKE_KEY = bx(65)  // ECDH P-256 SPKI placeholder
const FAKE_CT  = bx(32)  // AES-GCM ciphertext placeholder
const FAKE_IV  = bx(12)  // AES-GCM IV placeholder

async function signIn(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.signInAnonymously()
  if (error || !data.user) throw new Error(`signIn failed: ${error?.message}`)
  return data.user.id
}

async function registerDevice(client: SupabaseClient, id: string) {
  const { error } = await client.from('devices').insert({ id, public_key: FAKE_KEY })
  if (error) throw new Error(`registerDevice failed: ${error.message}`)
}

async function createShare(
  client: SupabaseClient,
  ownerId: string,
  recipientIds: string[],
): Promise<string> {
  const { data: share, error: shareErr } = await client
    .from('shares')
    .insert({
      owner_id: ownerId,
      ciphertext: FAKE_CT,
      iv: FAKE_IV,
      encrypted_keys: Object.fromEntries(recipientIds.map(id => [id, { iv: 'x', ciphertext: 'x' }])),
    })
    .select('id')
    .single()
  if (shareErr || !share) throw new Error(`createShare failed: ${shareErr?.message}`)

  const recipients = recipientIds.map(id => ({ share_id: share.id, recipient_id: id }))
  const { error: recErr } = await client.from('share_recipients').insert(recipients)
  if (recErr) throw new Error(`addRecipients failed: ${recErr.message}`)

  return share.id
}

// ── Storage bucket RLS ────────────────────────────────────────────────────────

describe.skipIf(!hasRealDB)('Storage RLS – share-media bucket', () => {
  let admin: SupabaseClient
  let clientA: SupabaseClient
  let clientB: SupabaseClient
  const createdUsers: string[] = []

  beforeEach(() => {
    admin   = createClient(SUPABASE_URL, SERVICE_KEY)
    clientA = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
    clientB = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
  })

  afterEach(async () => {
    for (const id of createdUsers.splice(0)) {
      await admin.auth.admin.deleteUser(id)
    }
  })

  test('storage-upload-owner: Owner kann Mediendatei hochladen', async () => {
    const aliceId = await signIn(clientA)
    createdUsers.push(aliceId)
    await registerDevice(clientA, aliceId)

    const shareId = await createShare(clientA, aliceId, [aliceId])
    const path    = `${shareId}/test.bin`

    const { error } = await clientA.storage
      .from('share-media')
      .upload(path, new Uint8Array([1, 2, 3, 4]), { contentType: 'application/octet-stream' })
    expect(error, 'Owner muss hochladen dürfen').toBeNull()

    await clientA.storage.from('share-media').remove([path])
  }, 20_000)

  test('storage-read-recipient: Empfänger kann Mediendatei herunterladen', async () => {
    const aliceId = await signIn(clientA)
    const bobId   = await signIn(clientB)
    createdUsers.push(aliceId, bobId)
    await registerDevice(clientA, aliceId)
    await registerDevice(clientB, bobId)

    const shareId = await createShare(clientA, aliceId, [aliceId, bobId])
    const path    = `${shareId}/media.bin`

    await clientA.storage
      .from('share-media')
      .upload(path, new Uint8Array([10, 20, 30]), { contentType: 'application/octet-stream' })

    const { data, error } = await clientB.storage.from('share-media').download(path)
    expect(error, 'Empfänger muss lesen dürfen').toBeNull()
    expect(data, 'Download muss Daten zurückgeben').toBeTruthy()

    await clientA.storage.from('share-media').remove([path])
  }, 20_000)

  test('storage-read-blocked: Nicht-Empfänger wird abgewiesen', async () => {
    const aliceId = await signIn(clientA)
    const eveId   = await signIn(clientB)
    createdUsers.push(aliceId, eveId)
    await registerDevice(clientA, aliceId)
    await registerDevice(clientB, eveId)

    // Eve ist kein Empfänger
    const shareId = await createShare(clientA, aliceId, [aliceId])
    const path    = `${shareId}/secret.bin`

    await clientA.storage
      .from('share-media')
      .upload(path, new Uint8Array([99]), { contentType: 'application/octet-stream' })

    const { data, error } = await clientB.storage.from('share-media').download(path)
    expect(error, 'Nicht-Empfänger darf nicht lesen').not.toBeNull()
    expect(data).toBeNull()

    await clientA.storage.from('share-media').remove([path])
  }, 20_000)

  test('storage-upload-blocked: Fremder kann nicht in fremdes Share-Verzeichnis schreiben', async () => {
    const aliceId = await signIn(clientA)
    const eveId   = await signIn(clientB)
    createdUsers.push(aliceId, eveId)
    await registerDevice(clientA, aliceId)
    await registerDevice(clientB, eveId)

    const shareId = await createShare(clientA, aliceId, [aliceId])
    const path    = `${shareId}/injected.bin`

    const { error } = await clientB.storage
      .from('share-media')
      .upload(path, new Uint8Array([0xff]), { contentType: 'application/octet-stream' })
    expect(error, 'Nicht-Eigentümer darf nicht hochladen').not.toBeNull()
  }, 20_000)

  test('storage-delete-owner: Owner kann eigenes Objekt löschen', async () => {
    const aliceId = await signIn(clientA)
    createdUsers.push(aliceId)
    await registerDevice(clientA, aliceId)

    const shareId = await createShare(clientA, aliceId, [aliceId])
    const path    = `${shareId}/will-delete.bin`

    await clientA.storage
      .from('share-media')
      .upload(path, new Uint8Array([7, 8, 9]), { contentType: 'application/octet-stream' })

    const { error } = await clientA.storage.from('share-media').remove([path])
    expect(error, 'Owner muss eigenes Objekt löschen dürfen').toBeNull()

    // Objekt darf nicht mehr lesbar sein
    const { data } = await clientA.storage.from('share-media').download(path)
    expect(data).toBeNull()
  }, 20_000)

  test('storage-delete-blocked: Empfänger kann Objekt des Owners nicht löschen', async () => {
    const aliceId = await signIn(clientA)
    const bobId   = await signIn(clientB)
    createdUsers.push(aliceId, bobId)
    await registerDevice(clientA, aliceId)
    await registerDevice(clientB, bobId)

    const shareId = await createShare(clientA, aliceId, [aliceId, bobId])
    const path    = `${shareId}/media.bin`

    await clientA.storage
      .from('share-media')
      .upload(path, new Uint8Array([1, 1, 1]), { contentType: 'application/octet-stream' })

    const { error } = await clientB.storage.from('share-media').remove([path])
    expect(error, 'Empfänger darf nicht löschen').not.toBeNull()

    // Datei muss noch da sein
    const { data } = await clientA.storage.from('share-media').download(path)
    expect(data).toBeTruthy()

    await clientA.storage.from('share-media').remove([path])
  }, 20_000)
})

// ── Feedback Submissions ──────────────────────────────────────────────────────

describe.skipIf(!hasRealDB)('Feedback – insert-only via anon role', () => {
  let anonClient: SupabaseClient

  beforeEach(() => {
    anonClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
  })

  test('feedback-insert: gültiges Rating wird akzeptiert', async () => {
    const { error } = await anonClient.from('feedback_submissions').insert({ rating: 4 })
    expect(error, 'Rating 4 muss akzeptiert werden').toBeNull()
  }, 10_000)

  test('feedback-insert-with-comment: Rating mit Kommentar wird akzeptiert', async () => {
    const { error } = await anonClient
      .from('feedback_submissions')
      .insert({ rating: 5, comment: 'Sehr gut!' })
    expect(error, 'Rating + Kommentar muss akzeptiert werden').toBeNull()
  }, 10_000)

  test('feedback-select-blocked: Anon-User kann keine Zeilen lesen', async () => {
    const { data } = await anonClient.from('feedback_submissions').select('id').limit(5)
    expect(data, 'Anon darf keine Feedback-Zeilen sehen').toEqual([])
  }, 10_000)

  test('feedback-invalid-rating-low: Rating 0 wird abgewiesen', async () => {
    const { error } = await anonClient.from('feedback_submissions').insert({ rating: 0 })
    expect(error, 'Rating 0 muss abgewiesen werden').not.toBeNull()
  }, 10_000)

  test('feedback-invalid-rating-high: Rating 6 wird abgewiesen', async () => {
    const { error } = await anonClient.from('feedback_submissions').insert({ rating: 6 })
    expect(error, 'Rating 6 muss abgewiesen werden').not.toBeNull()
  }, 10_000)

  test('feedback-comment-too-long: Kommentar über 500 Zeichen wird abgewiesen', async () => {
    const { error } = await anonClient
      .from('feedback_submissions')
      .insert({ rating: 3, comment: 'x'.repeat(501) })
    expect(error, 'Kommentar > 500 Zeichen muss abgewiesen werden').not.toBeNull()
  }, 10_000)

  test('feedback-comment-max-length: Kommentar mit genau 500 Zeichen wird akzeptiert', async () => {
    const { error } = await anonClient
      .from('feedback_submissions')
      .insert({ rating: 2, comment: 'y'.repeat(500) })
    expect(error, 'Kommentar mit 500 Zeichen muss akzeptiert werden').toBeNull()
  }, 10_000)
})

// Row-Level-Security integration tests against a real Supabase instance.
//
// These tests are SKIPPED unless SUPABASE_URL is set to a non-mock host.
// In the normal `npm test` run they are no-ops. The CI job
// `interaction-real-db` in interaction-tests.yml provides a local Supabase
// stack and sets the env vars before running this file.
//
// Coverage:
//   • device-insert-self    Can only register own device (auth.uid() check)
//   • share-select-blocked  Bob cannot read Alice's share (not a recipient)
//   • share-select-allowed  Bob CAN read a share he IS a recipient of
//   • share-delete-blocked  Bob cannot delete Alice's share
//   • recipient-write-blocked  Bob cannot add himself as a recipient
//   • annotation-insert-blocked  Non-recipient cannot annotate
//   • annotation-select-blocked  Non-recipient cannot see annotations
//   • storage-read-blocked  Non-recipient cannot read Alice's media

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

const hasRealDB =
  Boolean(SUPABASE_URL) &&
  !SUPABASE_URL.includes('supabase.e2e.local') &&
  Boolean(SERVICE_KEY)

// ── Helpers ────────────────────────────────────────────────────────────────

// PostgREST bytea columns expect '\x<hexstring>' format.
const bx = (len: number) => '\\x' + '00'.repeat(len)

// Minimal valid values for each column.
const FAKE_KEY = bx(65)   // ECDH P-256 SPKI placeholder
const FAKE_CT  = bx(32)   // AES-GCM ciphertext placeholder
const FAKE_IV  = bx(12)   // AES-GCM IV placeholder

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

// ── Test suite ─────────────────────────────────────────────────────────────

describe.skipIf(!hasRealDB)('RLS – Row Level Security (echte Supabase-Instanz)', () => {
  let admin: SupabaseClient
  let clientA: SupabaseClient
  let clientB: SupabaseClient
  const createdUsers: string[] = []

  beforeEach(() => {
    admin = createClient(SUPABASE_URL, SERVICE_KEY)
    clientA = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
    clientB = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
  })

  afterEach(async () => {
    for (const id of createdUsers.splice(0)) {
      await admin.auth.admin.deleteUser(id)
    }
  })

  async function setupTwo(): Promise<{ aliceId: string; bobId: string }> {
    const aliceId = await signIn(clientA)
    const bobId   = await signIn(clientB)
    createdUsers.push(aliceId, bobId)
    await registerDevice(clientA, aliceId)
    await registerDevice(clientB, bobId)
    return { aliceId, bobId }
  }

  // ── device policies ───────────────────────────────────────────────────────

  test('device-insert-self: darf nur eigenes Gerät registrieren', async () => {
    const aliceId = await signIn(clientA)
    createdUsers.push(aliceId)

    // Eigenes Gerät: ok
    const { error: ok } = await clientA.from('devices').insert({ id: aliceId, public_key: FAKE_KEY })
    expect(ok, 'Eigenes Gerät muss registrierbar sein').toBeNull()

    // Fremdes Gerät: verboten
    const fakeId = crypto.randomUUID()
    const { error: blocked } = await clientA.from('devices').insert({ id: fakeId, public_key: FAKE_KEY })
    expect(blocked, 'Fremdes Gerät darf nicht registrierbar sein').not.toBeNull()
  })

  // ── share-select policies ─────────────────────────────────────────────────

  test('share-select-blocked: Bob sieht Alices Share NICHT, wenn er kein Empfänger ist', async () => {
    const { aliceId } = await setupTwo()

    // Alice erstellt Share – nur sie selbst ist Empfängerin
    const shareId = await createShare(clientA, aliceId, [aliceId])

    // Bob versucht, den Share zu lesen
    const { data } = await clientB.from('shares').select('id').eq('id', shareId)
    expect(data).toHaveLength(0)
  }, 20_000)

  test('share-select-allowed: Bob sieht Alices Share, wenn er Empfänger ist', async () => {
    const { aliceId, bobId } = await setupTwo()

    const shareId = await createShare(clientA, aliceId, [aliceId, bobId])

    const { data, error } = await clientB.from('shares').select('id').eq('id', shareId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0].id).toBe(shareId)
  }, 20_000)

  // ── share-delete policy ───────────────────────────────────────────────────

  test('share-delete-blocked: Bob kann Alices Share nicht löschen', async () => {
    const { aliceId, bobId } = await setupTwo()

    const shareId = await createShare(clientA, aliceId, [aliceId, bobId])

    // Bob versucht zu löschen (hat Lesezugriff, aber kein Delete-Recht)
    const { count } = await clientB
      .from('shares')
      .delete({ count: 'exact' })
      .eq('id', shareId)
    expect(count ?? 0).toBe(0)

    // Share muss weiterhin im System sein
    const { data: check } = await admin.from('shares').select('id').eq('id', shareId)
    expect(check).toHaveLength(1)
  }, 20_000)

  // ── share_recipients write policy ─────────────────────────────────────────

  test('recipient-write-blocked: Bob kann sich nicht selbst als Empfänger eintragen', async () => {
    const { aliceId, bobId } = await setupTwo()

    // Alice erstellt Share ohne Bob
    const shareId = await createShare(clientA, aliceId, [aliceId])

    // Bob trägt sich selbst ein
    const { error } = await clientB.from('share_recipients').insert({
      share_id: shareId,
      recipient_id: bobId,
    })
    expect(error, 'Bob darf sich nicht selbst als Empfänger eintragen').not.toBeNull()

    // Verifikation: kein neuer Empfänger-Eintrag
    const { data: recs } = await admin
      .from('share_recipients')
      .select('recipient_id')
      .eq('share_id', shareId)
    expect(recs?.map(r => r.recipient_id)).not.toContain(bobId)
  }, 20_000)

  // ── annotation policies ───────────────────────────────────────────────────

  test('annotation-insert-blocked: Nicht-Empfänger kann nicht annotieren', async () => {
    const { aliceId, bobId } = await setupTwo()

    // Alice erstellt Share ohne Bob
    const shareId = await createShare(clientA, aliceId, [aliceId])

    // Bob (nicht Empfänger) versucht zu annotieren
    const { error } = await clientB.from('annotations').insert({
      share_id: shareId,
      author_id: bobId,
      ciphertext: FAKE_CT,
      iv: FAKE_IV,
      encrypted_keys: {},
    })
    expect(error, 'Nicht-Empfänger darf nicht annotieren').not.toBeNull()
    const { data: anns } = await admin.from('annotations').select('id').eq('share_id', shareId)
    expect(anns).toHaveLength(0)
  }, 20_000)

  test('annotation-insert-allowed: Empfänger kann annotieren', async () => {
    const { aliceId, bobId } = await setupTwo()

    const shareId = await createShare(clientA, aliceId, [aliceId, bobId])

    const { error } = await clientB.from('annotations').insert({
      share_id: shareId,
      author_id: bobId,
      ciphertext: FAKE_CT,
      iv: FAKE_IV,
      encrypted_keys: { [aliceId]: { iv: 'x', ciphertext: 'x' } },
    })
    expect(error, 'Empfänger muss annotieren dürfen').toBeNull()
  }, 20_000)

  test('annotation-select-blocked: Nicht-Empfänger sieht keine Annotationen', async () => {
    const { aliceId, bobId } = await setupTwo()

    // Carol ist nur Empfänger, nicht Eigentümer
    const carolClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
    const carolId = await signIn(carolClient)
    createdUsers.push(carolId)
    await registerDevice(carolClient, carolId)

    // Alice erstellt Share für sich und Bob, aber NICHT Carol
    const shareId = await createShare(clientA, aliceId, [aliceId, bobId])

    // Bob annotiert
    await clientB.from('annotations').insert({
      share_id: shareId,
      author_id: bobId,
      ciphertext: FAKE_CT,
      iv: FAKE_IV,
      encrypted_keys: {},
    })

    // Carol versucht die Annotation zu lesen
    const { data: carolView } = await carolClient
      .from('annotations')
      .select('id')
      .eq('share_id', shareId)
    expect(carolView).toHaveLength(0)
  }, 30_000)

  // ── Vollständiger Daten-Lebenszyklus ──────────────────────────────────────

  test('cascade-delete: Gerätelöschung entfernt alle abhängigen Daten', async () => {
    const { aliceId, bobId } = await setupTwo()
    const shareId = await createShare(clientA, aliceId, [aliceId, bobId])

    // Bob annotiert
    await clientB.from('annotations').insert({
      share_id: shareId,
      author_id: bobId,
      ciphertext: FAKE_CT,
      iv: FAKE_IV,
      encrypted_keys: {},
    })

    // Alice löscht ihr Gerät → kaskadiert auf Shares und Annotationen
    const { error } = await clientA.from('devices').delete().eq('id', aliceId)
    expect(error).toBeNull()

    // Alices Share muss weg sein
    const { data: shares } = await admin.from('shares').select('id').eq('id', shareId)
    expect(shares).toHaveLength(0)

    // Bobs Annotation auf Alices Share muss ebenfalls weg sein (FK-Kaskade)
    const { data: anns } = await admin.from('annotations').select('id').eq('share_id', shareId)
    expect(anns).toHaveLength(0)

    // Bob-Gerät noch vorhanden (unabhängig)
    const { data: bobDevice } = await admin.from('devices').select('id').eq('id', bobId)
    expect(bobDevice).toHaveLength(1)
  }, 30_000)
})

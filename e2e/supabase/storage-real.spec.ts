// Playwright end-to-end tests for the share-media Supabase Storage bucket.
//
// Complements src/integration/supabaseStorage.test.ts (Vitest) by running the
// same upload/download/delete/RLS scenarios from a real browser context.
// This catches CORS misconfigurations, CSP violations, and browser security
// model issues that Vitest (Node.js) cannot detect.
//
// Runs via playwright.supabase.config.ts against a local Supabase instance.
// Requires:
//   SUPABASE_URL              – http://127.0.0.1:54321
//   SUPABASE_ANON_KEY         – anon JWT from `supabase status`
//   SUPABASE_SERVICE_ROLE_KEY – service-role JWT for cleanup

import { test, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cleanupUsers, spawnRealDevice, supabaseAdmin } from './helpers'

const SUPABASE_URL      = process.env.SUPABASE_URL      ?? 'http://127.0.0.1:54321'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? ''

const FAKE_KEY = '\\x' + '00'.repeat(65)  // ECDH P-256 SPKI placeholder
const FAKE_CT  = '\\x' + '00'.repeat(32)  // AES-GCM ciphertext placeholder
const FAKE_IV  = '\\x' + '00'.repeat(12)  // AES-GCM IV placeholder

async function signInAnon(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.signInAnonymously()
  if (error || !data.user) throw new Error(`signInAnon failed: ${error?.message}`)
  return data.user.id
}

async function registerDevice(client: SupabaseClient, id: string): Promise<void> {
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

  const { error: recErr } = await client
    .from('share_recipients')
    .insert(recipientIds.map(id => ({ share_id: share.id, recipient_id: id })))
  if (recErr) throw new Error(`addRecipients failed: ${recErr.message}`)

  return share.id
}

// ── Storage browser-context tests ─────────────────────────────────────────────

test.describe('Storage: share-media bucket (browser context)', () => {
  const createdUsers: string[] = []
  const admin = supabaseAdmin()

  test.afterEach(async () => {
    await cleanupUsers(admin, createdUsers.splice(0))
  })

  test('upload: Owner kann Datei aus Browser-Kontext hochladen', async ({ browser }) => {
    test.setTimeout(45_000)

    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } })
    const ownerId = await signInAnon(client)
    createdUsers.push(ownerId)
    await registerDevice(client, ownerId)

    const shareId = await createShare(client, ownerId, [ownerId])
    const path    = `${shareId}/upload-test.bin`

    const { data: session } = await client.auth.getSession()
    const token = session?.session?.access_token ?? ''

    const { ctx, page } = await spawnRealDevice(browser)
    await page.goto('/')

    const result = await page.evaluate(
      async ({ storageUrl, anonKey, accessToken, bucket, filePath }) => {
        const res = await fetch(
          `${storageUrl}/storage/v1/object/${bucket}/${filePath}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'apikey': anonKey,
              'Content-Type': 'application/octet-stream',
              'x-upsert': 'false',
            },
            body: new Uint8Array([1, 2, 3, 4]),
          },
        )
        return { status: res.status, ok: res.ok }
      },
      { storageUrl: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, accessToken: token, bucket: 'share-media', filePath: path },
    )

    expect(result.ok, `Upload-Status ${result.status}: CORS oder Policy blockiert`).toBe(true)

    // Cleanup storage object
    await client.storage.from('share-media').remove([path])
    await ctx.close()
  })

  test('download: Empfänger kann Datei aus Browser-Kontext herunterladen', async ({ browser }) => {
    test.setTimeout(60_000)

    const clientA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } })
    const clientB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } })

    const aliceId = await signInAnon(clientA)
    const bobId   = await signInAnon(clientB)
    createdUsers.push(aliceId, bobId)
    await registerDevice(clientA, aliceId)
    await registerDevice(clientB, bobId)

    const shareId = await createShare(clientA, aliceId, [aliceId, bobId])
    const path    = `${shareId}/download-test.bin`

    await clientA.storage
      .from('share-media')
      .upload(path, new Uint8Array([10, 20, 30, 40]), { contentType: 'application/octet-stream' })

    const { data: bobSession } = await clientB.auth.getSession()
    const bobToken = bobSession?.session?.access_token ?? ''

    const { ctx, page } = await spawnRealDevice(browser)
    await page.goto('/')

    const result = await page.evaluate(
      async ({ storageUrl, anonKey, accessToken, bucket, filePath }) => {
        const res = await fetch(
          `${storageUrl}/storage/v1/object/${bucket}/${filePath}`,
          { headers: { 'Authorization': `Bearer ${accessToken}`, 'apikey': anonKey } },
        )
        const bytes = res.ok ? (await res.arrayBuffer()).byteLength : 0
        return { status: res.status, ok: res.ok, bytes }
      },
      { storageUrl: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, accessToken: bobToken, bucket: 'share-media', filePath: path },
    )

    expect(result.ok, `Download-Status ${result.status}`).toBe(true)
    expect(result.bytes).toBeGreaterThan(0)

    await clientA.storage.from('share-media').remove([path])
    await ctx.close()
  })

  test('rls-isolation: Nicht-Empfänger wird vom Browser aus abgewiesen', async ({ browser }) => {
    test.setTimeout(60_000)

    const clientA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } })
    const clientB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } })

    const aliceId = await signInAnon(clientA)
    const eveId   = await signInAnon(clientB)
    createdUsers.push(aliceId, eveId)
    await registerDevice(clientA, aliceId)
    await registerDevice(clientB, eveId)

    // Eve ist kein Empfänger
    const shareId = await createShare(clientA, aliceId, [aliceId])
    const path    = `${shareId}/rls-test.bin`

    await clientA.storage
      .from('share-media')
      .upload(path, new Uint8Array([99, 98, 97]), { contentType: 'application/octet-stream' })

    const { data: eveSession } = await clientB.auth.getSession()
    const eveToken = eveSession?.session?.access_token ?? ''

    const { ctx, page } = await spawnRealDevice(browser)
    await page.goto('/')

    const result = await page.evaluate(
      async ({ storageUrl, anonKey, accessToken, bucket, filePath }) => {
        const res = await fetch(
          `${storageUrl}/storage/v1/object/${bucket}/${filePath}`,
          { headers: { 'Authorization': `Bearer ${accessToken}`, 'apikey': anonKey } },
        )
        return { status: res.status, ok: res.ok }
      },
      { storageUrl: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, accessToken: eveToken, bucket: 'share-media', filePath: path },
    )

    expect(result.ok, `Nicht-Empfänger darf nicht lesen (Status ${result.status})`).toBe(false)
    expect(result.status).not.toBe(200)

    await clientA.storage.from('share-media').remove([path])
    await ctx.close()
  })

  test('delete: Owner kann eigene Datei aus Browser-Kontext löschen', async ({ browser }) => {
    test.setTimeout(45_000)

    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } })
    const ownerId = await signInAnon(client)
    createdUsers.push(ownerId)
    await registerDevice(client, ownerId)

    const shareId = await createShare(client, ownerId, [ownerId])
    const path    = `${shareId}/delete-test.bin`

    await client.storage
      .from('share-media')
      .upload(path, new Uint8Array([7, 8, 9]), { contentType: 'application/octet-stream' })

    const { data: session } = await client.auth.getSession()
    const token = session?.session?.access_token ?? ''

    const { ctx, page } = await spawnRealDevice(browser)
    await page.goto('/')

    const result = await page.evaluate(
      async ({ storageUrl, anonKey, accessToken, bucket, filePath }) => {
        const res = await fetch(
          `${storageUrl}/storage/v1/object/${bucket}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'apikey': anonKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prefixes: [filePath] }),
          },
        )
        return { status: res.status, ok: res.ok }
      },
      { storageUrl: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, accessToken: token, bucket: 'share-media', filePath: path },
    )

    expect(result.ok, `Delete-Status ${result.status}`).toBe(true)
    await ctx.close()
  })

})

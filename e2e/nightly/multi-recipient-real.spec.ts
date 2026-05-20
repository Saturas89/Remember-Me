// Multi-recipient and three-device interaction tests against the production Supabase instance.
//
// Covers scenarios that require more than two devices:
//   • Alice auto-shares with Bob AND Carol; both see it in their feed
//   • Bob and Carol can each annotate; Alice sees both annotations
//   • Dave (non-recipient) is isolated by RLS
//   • Sequential auto-shares: Alice writes multiple memories, all appear in both feeds
//
// Cleanup: afterEach deletes all created auth users; FK ON DELETE CASCADE
// removes devices, shares, share_recipients, and annotations.

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import {
  completeOnboarding,
  openFamilyHub,
  readDeviceIdentity,
  injectOnlineFriend,
  reopenFamilyHub,
  seedAnswer,
} from '../helpers/family-mode-helpers'
import { cleanupUsers, readDeviceId, spawnRealDevice, supabaseAdmin, waitForRealShares } from './helpers'

// ── Helpers ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL      ?? 'http://127.0.0.1:54321'
const ANON_KEY     = process.env.SUPABASE_ANON_KEY ?? ''

/** Sets up three linked devices: Alice→Bob, Alice→Carol (and the reverse). */
async function setupThreeDevices(
  browser: Parameters<typeof spawnRealDevice>[0],
  names: [string, string, string],
) {
  const [a, b, c] = await Promise.all([
    spawnRealDevice(browser),
    spawnRealDevice(browser),
    spawnRealDevice(browser),
  ])

  await completeOnboarding(a.page, names[0])
  await openFamilyHub(a.page)
  const aId = await readDeviceIdentity(a.page)

  await completeOnboarding(b.page, names[1])
  await openFamilyHub(b.page)
  const bId = await readDeviceIdentity(b.page)

  await completeOnboarding(c.page, names[2])
  await openFamilyHub(c.page)
  const cId = await readDeviceIdentity(c.page)

  // Mutual links: A↔B, A↔C, B↔C
  await injectOnlineFriend(a.page, names[1], bId.deviceId, bId.publicKey)
  await injectOnlineFriend(a.page, names[2], cId.deviceId, cId.publicKey)
  await injectOnlineFriend(b.page, names[0], aId.deviceId, aId.publicKey)
  await injectOnlineFriend(b.page, names[2], cId.deviceId, cId.publicKey)
  await injectOnlineFriend(c.page, names[0], aId.deviceId, aId.publicKey)
  await injectOnlineFriend(c.page, names[1], bId.deviceId, bId.publicKey)

  return {
    alice: { ...a, id: aId },
    bob:   { ...b, id: bId },
    carol: { ...c, id: cId },
  }
}

// ── Test suite ───────────────────────────────────────────────────────────────

test.describe('Multi-Empfänger und Drei-Geräte (Real-DB)', () => {
  const createdUsers: string[] = []
  const admin = supabaseAdmin()

  test.afterEach(async () => {
    await cleanupUsers(admin, createdUsers.splice(0))
  })

  test('multi-recipient: Alice auto-share landet bei Bob UND Carol', async ({ browser }) => {
    test.setTimeout(120_000)

    const { alice, bob, carol } = await setupThreeDevices(browser, ['Alice', 'Bob', 'Carol'])
    createdUsers.push(alice.id.deviceId, bob.id.deviceId, carol.id.deviceId)

    await reopenFamilyHub(alice.page)
    await seedAnswer(alice.page, 'multi-q1', 'childhood', 'Gemeinsame Erinnerung für alle.')
    await waitForRealShares(admin, alice.id.deviceId, 1, 30_000)

    await expect
      .poll(async () => {
        const { data } = await admin.from('share_recipients').select('recipient_id')
        return data?.length ?? 0
      }, { timeout: 20_000, intervals: [2_000] })
      .toBeGreaterThanOrEqual(2)

    await bob.page.reload()
    await openFamilyHub(bob.page)
    await expect(bob.page.getByTestId('feed-item').first()).toBeVisible({ timeout: 30_000 })

    await carol.page.reload()
    await openFamilyHub(carol.page)
    await expect(carol.page.getByTestId('feed-item').first()).toBeVisible({ timeout: 30_000 })

    await alice.ctx.close()
    await bob.ctx.close()
    await carol.ctx.close()
  })

  test('dave-isolation: Dave sieht Alices Share nicht (RLS)', async ({ browser }) => {
    test.setTimeout(120_000)

    const { alice, bob, carol } = await setupThreeDevices(browser, ['Alice', 'Bob', 'Carol'])
    createdUsers.push(alice.id.deviceId, bob.id.deviceId, carol.id.deviceId)

    const { ctx: daveCtx, page: dave } = await spawnRealDevice(browser)
    await completeOnboarding(dave, 'Dave')
    await openFamilyHub(dave)
    const daveRawId = await readDeviceId(dave)
    createdUsers.push(daveRawId)

    await reopenFamilyHub(alice.page)
    await seedAnswer(alice.page, 'iso-q1', 'family', 'Nur für Bob und Carol.')
    await waitForRealShares(admin, alice.id.deviceId, 1, 30_000)

    await bob.page.reload()
    await openFamilyHub(bob.page)
    await expect(bob.page.getByTestId('feed-item').first()).toBeVisible({ timeout: 30_000 })

    await dave.reload()
    await openFamilyHub(dave)
    await dave.waitForTimeout(4_000)
    expect(await dave.getByTestId('feed-item').count()).toBe(0)

    const daveClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
    await daveClient.auth.signInAnonymously()
    const { data: rows } = await daveClient
      .from('shares')
      .select('id')
      .eq('owner_id', alice.id.deviceId)
    expect(rows?.length ?? 0, 'Dave darf Alices Shares via API nicht sehen').toBe(0)

    await alice.ctx.close()
    await bob.ctx.close()
    await carol.ctx.close()
    await daveCtx.close()
  })

  test('sequential-shares: Alice schreibt drei Antworten, alle landen in Bobs Feed', async ({ browser }) => {
    test.setTimeout(180_000)

    const { alice, bob, carol } = await setupThreeDevices(browser, ['Alice', 'Bob2', 'Carol2'])
    createdUsers.push(alice.id.deviceId, bob.id.deviceId, carol.id.deviceId)

    const memories = [
      { id: 'seq-q1', cat: 'childhood', text: 'Erste Erinnerung.' },
      { id: 'seq-q2', cat: 'family',    text: 'Zweite Erinnerung.' },
      { id: 'seq-q3', cat: 'childhood', text: 'Dritte Erinnerung.' },
    ]

    await reopenFamilyHub(alice.page)
    for (const m of memories) {
      await seedAnswer(alice.page, m.id, m.cat, m.text)
    }
    await waitForRealShares(admin, alice.id.deviceId, memories.length, 90_000)

    await bob.page.reload()
    await openFamilyHub(bob.page)
    await expect(bob.page.getByTestId('feed-item').first()).toBeVisible({ timeout: 30_000 })

    await carol.page.reload()
    await openFamilyHub(carol.page)
    await expect(carol.page.getByTestId('feed-item').first()).toBeVisible({ timeout: 30_000 })

    await alice.ctx.close()
    await bob.ctx.close()
    await carol.ctx.close()
  })

  test('annotation-fanout: Bob und Carol annotieren denselben Share, Alice sieht beide', async ({ browser }) => {
    test.setTimeout(180_000)

    const { alice, bob, carol } = await setupThreeDevices(browser, ['Alice', 'Bob3', 'Carol3'])
    createdUsers.push(alice.id.deviceId, bob.id.deviceId, carol.id.deviceId)

    await reopenFamilyHub(alice.page)
    await seedAnswer(alice.page, 'fanout-q1', 'childhood', 'Erinnerung zum Kommentieren.')
    await waitForRealShares(admin, alice.id.deviceId, 1, 30_000)

    const { data: shareRows } = await admin
      .from('shares')
      .select('id')
      .eq('owner_id', alice.id.deviceId)
      .limit(1)
    const shareId = shareRows![0].id

    await bob.page.reload()
    await openFamilyHub(bob.page)
    const bobFeedItem = bob.page.getByTestId('feed-item').first()
    await expect(bobFeedItem).toBeVisible({ timeout: 30_000 })
    await bobFeedItem.click()
    const bobInput = bob.page.getByTestId('annotation-input')
    await expect(bobInput).toBeVisible()
    await bobInput.fill('Bobs Kommentar.')
    await bob.page.getByTestId('send-annotation').click()
    await expect(bob.page.getByTestId('annotation-sent')).toBeVisible({ timeout: 15_000 })

    await carol.page.reload()
    await openFamilyHub(carol.page)
    const carolFeedItem = carol.page.getByTestId('feed-item').first()
    await expect(carolFeedItem).toBeVisible({ timeout: 30_000 })
    await carolFeedItem.click()
    const carolInput = carol.page.getByTestId('annotation-input')
    await expect(carolInput).toBeVisible()
    await carolInput.fill('Carols Kommentar.')
    await carol.page.getByTestId('send-annotation').click()
    await expect(carol.page.getByTestId('annotation-sent')).toBeVisible({ timeout: 15_000 })

    await expect
      .poll(async () => {
        const { data } = await admin
          .from('annotations')
          .select('id')
          .eq('share_id', shareId)
        return data?.length ?? 0
      }, { timeout: 20_000, intervals: [2_000] })
      .toBe(2)

    await alice.page.reload()
    await openFamilyHub(alice.page)
    const aliceFeedItem = alice.page.getByTestId('feed-item').first()
    await expect(aliceFeedItem).toBeVisible({ timeout: 30_000 })
    await aliceFeedItem.click()
    const annotationCount = alice.page.getByTestId('annotation-count')
    await expect(annotationCount).toBeVisible({ timeout: 15_000 })
    const countText = await annotationCount.textContent()
    const n = parseInt(countText ?? '0', 10)
    expect(n, 'Alice muss beide Annotationen sehen').toBeGreaterThanOrEqual(2)

    await alice.ctx.close()
    await bob.ctx.close()
    await carol.ctx.close()
  })

  test('db-structure: share_recipients-Zeilen korrekt für Multi-Empfänger', async ({ browser }) => {
    test.setTimeout(90_000)

    const { alice, bob, carol } = await setupThreeDevices(browser, ['Alice', 'Bob4', 'Carol4'])
    createdUsers.push(alice.id.deviceId, bob.id.deviceId, carol.id.deviceId)

    await reopenFamilyHub(alice.page)
    await seedAnswer(alice.page, 'struct-q1', 'childhood', 'Strukturtest-Erinnerung.')
    await waitForRealShares(admin, alice.id.deviceId, 1, 30_000)

    const { data: shares } = await admin
      .from('shares')
      .select('id, owner_id')
      .eq('owner_id', alice.id.deviceId)
    expect(shares?.length ?? 0, 'Share muss in DB liegen').toBeGreaterThan(0)

    const shareId = shares![0].id

    const { data: recipients } = await admin
      .from('share_recipients')
      .select('recipient_id')
      .eq('share_id', shareId)

    const recipientIds = recipients?.map(r => r.recipient_id) ?? []
    expect(recipientIds).toContain(bob.id.deviceId)
    expect(recipientIds).toContain(carol.id.deviceId)

    const { data: shareData } = await admin
      .from('shares')
      .select('encrypted_keys')
      .eq('id', shareId)
      .single()
    const keys = shareData?.encrypted_keys as Record<string, unknown>
    expect(Object.keys(keys)).toContain(bob.id.deviceId)
    expect(Object.keys(keys)).toContain(carol.id.deviceId)

    await alice.ctx.close()
    await bob.ctx.close()
    await carol.ctx.close()
  })
})

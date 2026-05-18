// Mobile UX tests against the production Supabase instance.
//
// Covers the same ground as e2e/interaction/android-ux.spec.ts but uses
// spawnRealDevice() (no in-memory mock) so every Supabase call — auth,
// device registration, share insert, annotation insert — goes to the real
// PostgREST/GoTrue stack.
//
// Mobile-only assertions are guarded with test.skip(!isMobile) so desktop
// projects (chromium, firefox) only run the project-agnostic checks.
//
// Cleanup: afterEach deletes all created auth users; FK ON DELETE CASCADE
// removes devices, shares, share_recipients, and annotations.

import { test, expect } from '@playwright/test'
import {
  completeOnboarding,
  injectOnlineFriend,
  openFamilyHub,
  readDeviceIdentity,
  reopenFamilyHub,
  seedAnswer,
} from '../helpers/family-mode-helpers'
import { assertTapTarget } from '../interaction/helpers'
import { cleanupUsers, spawnRealDevice, supabaseAdmin } from './helpers'

test.describe('Mobile-UX (Real-DB) – Touch, Viewport, Tap-Targets', () => {
  const createdUsers: string[] = []
  const admin = supabaseAdmin()

  test.afterEach(async () => {
    await cleanupUsers(admin, createdUsers.splice(0))
  })

  test('Hub-Tabs liegen vollständig im Viewport (kein horizontales Überlaufen)', async ({
    browser,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Nur auf mobilen Viewports sinnvoll')
    test.setTimeout(90_000)

    const { ctx: aliceCtx, page: alice } = await spawnRealDevice(browser)
    const { ctx: bobCtx,   page: bob   } = await spawnRealDevice(browser)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)
    createdUsers.push(aliceId.deviceId)

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)
    createdUsers.push(bobId.deviceId)

    await injectOnlineFriend(alice, 'Bob',   bobId.deviceId,   bobId.publicKey)
    await injectOnlineFriend(bob,   'Alice', aliceId.deviceId, aliceId.publicKey)

    await reopenFamilyHub(alice)

    const tablist = alice.getByRole('tablist')
    await expect(tablist).toBeVisible()

    const viewport = alice.viewportSize()!
    const tabs = tablist.getByRole('tab')
    const count = await tabs.count()
    expect(count, 'Hub sollte vier Tabs haben').toBe(4)

    for (let i = 0; i < count; i++) {
      const box = await tabs.nth(i).boundingBox()
      expect(box, `Tab ${i} hat keine Bounding-Box`).not.toBeNull()
      expect(box!.x, `Tab ${i} liegt links außerhalb`).toBeGreaterThanOrEqual(0)
      expect(
        box!.x + box!.width,
        `Tab ${i} ragt rechts aus dem Viewport`,
      ).toBeLessThanOrEqual(viewport.width + 2)
    }

    await aliceCtx.close()
    await bobCtx.close()
  })

  test('Primäre Aktionsbuttons erfüllen 44-px-Mindestgröße', async ({ browser, isMobile }) => {
    test.skip(!isMobile, 'Tap-Target-Check ist nur auf Touch-Geräten relevant')
    test.setTimeout(90_000)

    const { ctx: aliceCtx, page: alice } = await spawnRealDevice(browser)
    const { ctx: bobCtx,   page: bob   } = await spawnRealDevice(browser)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)
    createdUsers.push(aliceId.deviceId)

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)
    createdUsers.push(bobId.deviceId)

    await injectOnlineFriend(alice, 'Bob',   bobId.deviceId,   bobId.publicKey)
    await injectOnlineFriend(bob,   'Alice', aliceId.deviceId, aliceId.publicKey)

    await reopenFamilyHub(alice)

    const tablist = alice.getByRole('tablist')
    const tabCount = await tablist.getByRole('tab').count()
    for (let i = 0; i < tabCount; i++) {
      await assertTapTarget(tablist.getByRole('tab').nth(i))
    }

    await alice.getByRole('tab', { name: 'Teilen', exact: true }).click()
    await seedAnswer(alice, 'tap-q-real', 'childhood', 'Tap-Target-Erinnerung.')
    await alice.goto('/friends')
    await reopenFamilyHub(alice)
    await alice.getByRole('tab', { name: 'Teilen', exact: true }).click()
    await alice.getByText('Tap-Target-Erinnerung.').click()
    await alice.locator('.share-recipient-chip', { hasText: 'Bob' }).click()

    await assertTapTarget(alice.getByRole('button', { name: /Verschlüssele & sende/ }))

    await aliceCtx.close()
    await bobCtx.close()
  })

  test('Annotation-Eingabe ist auf mobilem Viewport absendbar und landet in DB', async ({
    browser,
    isMobile,
  }) => {
    test.skip(!isMobile, 'tap()-Simulation nur auf Touch-Geräten valide')
    test.setTimeout(120_000)

    const { ctx: aliceCtx, page: alice } = await spawnRealDevice(browser)
    const { ctx: bobCtx,   page: bob   } = await spawnRealDevice(browser)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)
    createdUsers.push(aliceId.deviceId)
    await seedAnswer(alice, 'mobile-ann-q-real', 'childhood', 'Erinnerung für mobiles Annotieren.')

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)
    createdUsers.push(bobId.deviceId)

    await injectOnlineFriend(alice, 'Bob',   bobId.deviceId,   bobId.publicKey)
    await injectOnlineFriend(bob,   'Alice', aliceId.deviceId, aliceId.publicKey)

    await reopenFamilyHub(alice)
    await alice.getByRole('tab', { name: 'Teilen', exact: true }).click()
    await alice.getByText('Erinnerung für mobiles Annotieren.').click()
    await alice.locator('.share-recipient-chip', { hasText: 'Bob' }).click()
    await alice.getByRole('button', { name: /Verschlüssele & sende/ }).click()
    await expect(alice.getByRole('button', { name: /Gesendet/ })).toBeVisible({ timeout: 20_000 })

    await reopenFamilyHub(bob)
    await bob.getByRole('tab', { name: /^Feed\b/ }).click()
    await expect(
      bob.getByText('Erinnerung für mobiles Annotieren.'),
    ).toBeVisible({ timeout: 25_000 })

    const input = bob.getByLabel('Ergänzung hinzufügen')
    await expect(input).toBeVisible()
    // tap() statt click() für Touch-Simulation
    await input.tap()
    await input.fill('Mobile Ergänzung von Bob.')
    await bob.getByRole('button', { name: 'Ergänzung senden' }).tap()
    await expect(bob.getByRole('button', { name: /Gesendet/ })).toBeVisible({ timeout: 20_000 })

    // Verifikation via Admin-API: Annotation ist wirklich in der DB
    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from('annotations')
            .select('id, author_id')
            .eq('author_id', bobId.deviceId)
          return data?.length ?? 0
        },
        { timeout: 10_000 },
      )
      .toBe(1)

    await aliceCtx.close()
    await bobCtx.close()
  })

  test('Feed mit mehreren Einträgen ist auf kleinem Viewport scrollbar', async ({
    browser,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Scroll-Test ist nur auf mobilen Viewports sinnvoll')
    test.setTimeout(150_000)

    const { ctx: aliceCtx, page: alice } = await spawnRealDevice(browser)
    const { ctx: bobCtx,   page: bob   } = await spawnRealDevice(browser)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)
    createdUsers.push(aliceId.deviceId)

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)
    createdUsers.push(bobId.deviceId)

    await injectOnlineFriend(alice, 'Bob',   bobId.deviceId,   bobId.publicKey)
    await injectOnlineFriend(bob,   'Alice', aliceId.deviceId, aliceId.publicKey)

    const memories = Array.from({ length: 4 }, (_, i) => ({
      id: `scroll-real-q${i}`,
      cat: 'childhood',
      text: `Scroll-Erinnerung Nummer ${i + 1} mit genug Text, damit die Karte Höhe bekommt.`,
    }))
    for (const m of memories) {
      await seedAnswer(alice, m.id, m.cat, m.text)
    }

    for (const m of memories) {
      await reopenFamilyHub(alice)
      await alice.getByRole('tab', { name: 'Teilen', exact: true }).click()
      await alice.getByText(m.text).click()
      await alice.locator('.share-recipient-chip', { hasText: 'Bob' }).click()
      await alice.getByRole('button', { name: /Verschlüssele & sende/ }).click()
      await expect(alice.getByRole('button', { name: /Gesendet/ })).toBeVisible({ timeout: 20_000 })
    }

    await reopenFamilyHub(bob)
    await bob.getByRole('tab', { name: /^Feed\b/ }).click()

    await expect(bob.getByText(memories[0].text)).toBeVisible({ timeout: 30_000 })
    await bob.getByText(memories[3].text).scrollIntoViewIfNeeded()
    await expect(bob.getByText(memories[3].text)).toBeVisible({ timeout: 10_000 })

    await aliceCtx.close()
    await bobCtx.close()
  })

  test('Onboarding und Hub-Einstieg funktionieren auf Samsung-Galaxy-Viewport', async ({
    browser,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Samsung-Viewport-Check nur auf Touch-Geräten sinnvoll')
    test.setTimeout(90_000)

    const { ctx: aliceCtx, page: alice } = await spawnRealDevice(browser)
    createdUsers.push('') // Platzhalter; wir lesen die ID nach openFamilyHub

    await alice.goto('/')
    const nameInput = alice.getByLabel('Wie heißt du?')
    await expect(nameInput).toBeVisible()

    const viewport = alice.viewportSize()!
    const box = await nameInput.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 2)

    await nameInput.fill('Sandra')
    await alice.getByRole('button', { name: /Loslegen/ }).click()
    await expect(alice.getByText(/Hallo,\s*Sandra/)).toBeVisible()

    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)
    // Ersetze den Platzhalter durch die echte ID
    createdUsers[createdUsers.length - 1] = aliceId.deviceId

    await expect(alice.getByRole('heading', { name: 'Online teilen', exact: true })).toBeVisible()

    await aliceCtx.close()
  })
})

import { test, expect } from '@playwright/test'
import {
  completeOnboarding,
  createMockState,
  injectOnlineFriend,
  openFamilyHub,
  readDeviceIdentity,
  reopenFamilyHub,
  seedAnswer,
  spawnDevice,
  waitForShares,
} from '../helpers/family-mode-helpers'
import { assertTapTarget } from './helpers'

// Mobile-specific interaction and layout tests. All tests run across every
// project in playwright.interaction.config.ts; mobile-only assertions use
// test.skip(!isMobile) so they do not fail on desktop projects.

test.describe('Mobile-UX – Touch, Viewport, Tap-Targets', () => {
  test('Hub-Tabs liegen vollständig im Viewport (kein horizontales Überlaufen)', async ({
    browser,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Nur auf mobilen Viewports sinnvoll')
    test.setTimeout(90_000)

    const state = createMockState()
    const { ctx: aliceCtx, page: alice } = await spawnDevice(browser, state)
    const { ctx: bobCtx, page: bob } = await spawnDevice(browser, state)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)

    await injectOnlineFriend(alice, 'Bob', bobId.deviceId, bobId.publicKey)
    await injectOnlineFriend(bob, 'Alice', aliceId.deviceId, aliceId.publicKey)

    await reopenFamilyHub(alice)

    const tablist = alice.getByRole('tablist')
    await expect(tablist).toBeVisible()

    const viewport = alice.viewportSize()!
    const tabs = tablist.getByRole('tab')
    const count = await tabs.count()
    expect(count, 'Hub sollte drei Tabs haben (Feed / Kontakte / Einstellungen)').toBe(3)

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

    const state = createMockState()
    const { ctx: aliceCtx, page: alice } = await spawnDevice(browser, state)
    const { ctx: bobCtx, page: bob } = await spawnDevice(browser, state)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)

    await injectOnlineFriend(alice, 'Bob', bobId.deviceId, bobId.publicKey)
    await injectOnlineFriend(bob, 'Alice', aliceId.deviceId, aliceId.publicKey)

    await reopenFamilyHub(alice)

    // Hub-Tabs
    const tablist = alice.getByRole('tablist')
    const count = await tablist.getByRole('tab').count()
    for (let i = 0; i < count; i++) {
      await assertTapTarget(tablist.getByRole('tab').nth(i))
    }

    // Sandra-Flow-CTA (FR-22.17) und Auto-Share-Toggle (FR-22.12) — die
    // beiden zentralen Interaktionen im Kontakte-Tab müssen ≥ 44 px haben.
    await alice.getByRole('tab', { name: /Kontakte/ }).click()
    await assertTapTarget(alice.getByTestId('contacts-new-connection'))
    const toggleLabel = alice.locator('[data-testid^="shareall-toggle-"]').first()
    await assertTapTarget(toggleLabel)

    await aliceCtx.close()
    await bobCtx.close()
  })

  test('Annotation-Eingabe ist auf mobilem Viewport scrollbar und absendbar', async ({ browser }) => {
    test.setTimeout(120_000)
    const state = createMockState()
    const { ctx: aliceCtx, page: alice } = await spawnDevice(browser, state)
    const { ctx: bobCtx, page: bob } = await spawnDevice(browser, state)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)

    await injectOnlineFriend(alice, 'Bob', bobId.deviceId, bobId.publicKey)
    await injectOnlineFriend(bob, 'Alice', aliceId.deviceId, aliceId.publicKey)

    await reopenFamilyHub(alice)
    await seedAnswer(alice, 'mobile-ann-q', 'childhood', 'Erinnerung für mobiles Annotieren.')
    await waitForShares(state, 1, 20_000)

    await reopenFamilyHub(bob)
    await bob.getByRole('tab', { name: /^Feed\b/ }).click()
    await expect(bob.getByText('Erinnerung für mobiles Annotieren.')).toBeVisible({ timeout: 15_000 })

    // Annotation auf mobilem Viewport eingeben und absenden
    const input = bob.getByLabel('Ergänzung hinzufügen')
    await expect(input).toBeVisible()
    await input.click()
    await input.fill('Mobile Ergänzung von Bob.')
    await bob.getByRole('button', { name: 'Ergänzung senden' }).click()
    await expect(bob.getByRole('button', { name: /Gesendet/ })).toBeVisible({ timeout: 10_000 })

    expect(state.annotations).toHaveLength(1)
    expect(state.annotations[0].author_id).toBe(bobId.deviceId)

    await aliceCtx.close()
    await bobCtx.close()
  })

  test('Feed mit mehreren Einträgen ist auf kleinem Viewport scrollbar', async ({ browser, isMobile }) => {
    test.skip(!isMobile, 'Scroll-Test ist nur auf mobilen Viewports sinnvoll')
    test.setTimeout(120_000)

    const state = createMockState()
    const { ctx: aliceCtx, page: alice } = await spawnDevice(browser, state)
    const { ctx: bobCtx, page: bob } = await spawnDevice(browser, state)

    await completeOnboarding(alice, 'Alice')
    await openFamilyHub(alice)
    const aliceId = await readDeviceIdentity(alice)

    await completeOnboarding(bob, 'Bob')
    await openFamilyHub(bob)
    const bobId = await readDeviceIdentity(bob)

    await injectOnlineFriend(alice, 'Bob', bobId.deviceId, bobId.publicKey)
    await injectOnlineFriend(bob, 'Alice', aliceId.deviceId, aliceId.publicKey)

    const memories = Array.from({ length: 4 }, (_, i) => ({
      id: `scroll-q${i}`,
      cat: 'childhood',
      text: `Scroll-Erinnerung Nummer ${i + 1} mit genug Text, damit die Karte Höhe bekommt.`,
    }))

    await reopenFamilyHub(alice)
    for (const m of memories) {
      await seedAnswer(alice, m.id, m.cat, m.text)
    }
    await waitForShares(state, memories.length, 30_000)

    await reopenFamilyHub(bob)
    await bob.getByRole('tab', { name: /^Feed\b/ }).click()

    // Erster Eintrag direkt sichtbar
    await expect(bob.getByText(memories[0].text)).toBeVisible({ timeout: 20_000 })

    // Letzter Eintrag durch Scrollen erreichbar
    await bob.getByText(memories[3].text).scrollIntoViewIfNeeded()
    await expect(bob.getByText(memories[3].text)).toBeVisible({ timeout: 5_000 })

    await aliceCtx.close()
    await bobCtx.close()
  })

  test('Onboarding und Hub-Einstieg funktionieren auf Samsung-Galaxy-Viewport', async ({
    browser,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Samsung-Viewport-Check nur auf Touch-Geräten sinnvoll')
    test.setTimeout(90_000)

    const state = createMockState()
    const { ctx: aliceCtx, page: alice } = await spawnDevice(browser, state)

    // Vollständiges Onboarding auf mobilem Viewport
    await alice.goto('/')
    const nameInput = alice.getByLabel('Wie heißt du?')
    await expect(nameInput).toBeVisible()

    // Sicherstellen, dass das Input-Feld im sichtbaren Bereich liegt
    const viewport = alice.viewportSize()!
    const box = await nameInput.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 2)

    await nameInput.fill('Sandra')
    await alice.getByRole('button', { name: /Loslegen/ }).click()
    await expect(alice.getByText(/Hallo,\s*Sandra/)).toBeVisible()

    // Familienmodus-Einstieg auf mobilem Viewport
    await openFamilyHub(alice)
    await expect(alice.getByRole('heading', { name: 'Online teilen', exact: true })).toBeVisible()

    await aliceCtx.close()
  })
})

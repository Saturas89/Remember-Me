// E2E nightly tests for the two SEO landing pages.
//
// Covers:
//   • Page load and all major section headings visible
//   • FAQ accordion opens and closes
//   • Primary CTA sets rm-landing-seen and navigates to app root
//   • Nav CTA button stays within viewport bounds on mobile
//   • hreflang links present and correct in <head>
//
// No Supabase needed — LP pages are standalone React entry points.
// spawnRealDevice() provides consistent context setup and traffic tagging.

import { test, expect } from '@playwright/test'
import { spawnRealDevice } from './helpers'

const LP = {
  en: {
    path:            '/en/record-your-parents-stories',
    h1:              "Record your parents' stories before they are lost.",
    eyebrow:         "Before it's too late",
    problemH2:       'Every family has stories they wish they had captured earlier.',
    howH2:           'How Storyhold works',
    benefitsH2:      'Why families use Storyhold',
    proofH2:         'This is more than a memory project.',
    faqH2:           'Frequently asked questions',
    firstFaqQ:       "Why should I record my parents' stories now?",
    firstFaqA:       'Because the right time often feels like later — until later becomes too late.',
    finalH2:         'Preserve the stories of the people you love most.',
    ctaText:         'Invite your mom and begin',
    hreflangSelf:    'en',
    hreflangOther:   'de',
    hreflangOtherHref: 'https://storyhold.app/de/lebensgeschichten-der-eltern-bewahren',
    xDefaultHref:    'https://storyhold.app/en/record-your-parents-stories',
  },
  de: {
    path:            '/de/lebensgeschichten-der-eltern-bewahren',
    h1:              'Bewahre die Lebensgeschichten deiner Eltern, bevor sie verloren gehen.',
    eyebrow:         'Bevor es zu spät ist',
    problemH2:       'In jeder Familie gibt es Geschichten, die man viel früher hätte festhalten wollen.',
    howH2:           'So funktioniert Storyhold',
    benefitsH2:      'Warum Familien Storyhold nutzen',
    proofH2:         'Das ist mehr als nur ein Erinnerungsprojekt.',
    faqH2:           'Häufige Fragen',
    firstFaqQ:       'Warum sollte ich die Geschichten meiner Eltern jetzt festhalten?',
    firstFaqA:       'Weil sich der richtige Zeitpunkt oft nach später anfühlt — bis später irgendwann zu spät ist.',
    finalH2:         'Bewahre die Geschichten der Menschen, die du am meisten liebst.',
    ctaText:         'Jetzt Erinnerungen bewahren',
    hreflangSelf:    'de',
    hreflangOther:   'en',
    hreflangOtherHref: 'https://storyhold.app/en/record-your-parents-stories',
    xDefaultHref:    'https://storyhold.app/en/record-your-parents-stories',
  },
} as const

for (const [lang, lp] of Object.entries(LP) as [string, typeof LP.en][]) {
  test.describe(`LP ${lang.toUpperCase()} – ${lp.path}`, () => {

    test('alle Hauptsektionen laden und Texte stimmen', async ({ browser }) => {
      const { ctx, page } = await spawnRealDevice(browser)

      await page.goto(lp.path)

      // Hero
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(lp.h1)
      await expect(page.getByText(lp.eyebrow)).toBeVisible()

      // Problem section
      await expect(page.getByRole('heading', { name: lp.problemH2 })).toBeVisible()

      // How it works
      await expect(page.getByRole('heading', { name: lp.howH2 })).toBeVisible()

      // Benefits / Why
      await expect(page.getByRole('heading', { name: lp.benefitsH2 })).toBeVisible()

      // Proof / quote
      await expect(page.getByText(lp.proofH2)).toBeVisible()

      // FAQ
      await expect(page.getByRole('heading', { name: lp.faqH2 })).toBeVisible()

      // Final CTA
      await expect(page.getByRole('heading', { name: lp.finalH2 })).toBeVisible()

      await ctx.close()
    })

    test('FAQ accordion öffnet und schließt', async ({ browser }) => {
      const { ctx, page } = await spawnRealDevice(browser)

      await page.goto(lp.path)

      const firstItem = page.locator('details.lp-faq__item').first()
      const summary   = firstItem.locator('summary.lp-faq__q')
      const answer    = firstItem.locator('.lp-faq__a')

      // Closed by default — answer not visible
      await expect(firstItem).not.toHaveAttribute('open')

      // Click to open
      await summary.click()
      await expect(firstItem).toHaveAttribute('open', '')
      await expect(answer).toBeVisible()
      await expect(answer).toContainText(lp.firstFaqA.slice(0, 20))

      // Click to close
      await summary.click()
      await expect(firstItem).not.toHaveAttribute('open')

      await ctx.close()
    })

    test('Haupt-CTA setzt rm-landing-seen und navigiert zur App', async ({ browser }) => {
      const { ctx, page } = await spawnRealDevice(browser)

      await page.goto(lp.path)

      // Hero primary CTA
      const heroCta = page.locator('.landing-cta-btn').first()
      await expect(heroCta).toBeVisible()
      await expect(heroCta).toHaveText(lp.ctaText)

      await heroCta.click()

      // Should navigate away from the LP path
      await page.waitForURL(url => !url.pathname.includes('/en/') && !url.pathname.includes('/de/'))

      // rm-landing-seen must be set before the redirect
      const flag = await page.evaluate(() => localStorage.getItem('rm-landing-seen'))
      expect(flag).toBe('1')

      await ctx.close()
    })

    test('Nav-CTA navigiert ebenfalls zur App', async ({ browser }) => {
      const { ctx, page } = await spawnRealDevice(browser)

      await page.goto(lp.path)

      const navCta = page.locator('.landing-nav__cta')
      await expect(navCta).toBeVisible()

      await navCta.click()

      await page.waitForURL(url => !url.pathname.includes('/en/') && !url.pathname.includes('/de/'))

      await ctx.close()
    })

    test('Nav-Button bleibt bei mobilem Viewport innerhalb des Viewports', async ({ browser, isMobile }) => {
      test.skip(!isMobile, 'Nav-Overflow-Check nur auf Touch-Geräten relevant')

      const { ctx, page } = await spawnRealDevice(browser)

      await page.goto(lp.path)

      const navCta = page.locator('.landing-nav__cta')
      await expect(navCta).toBeVisible()

      const viewport = page.viewportSize()!
      const box = await navCta.boundingBox()
      expect(box, 'Nav-CTA hat keine Bounding-Box').not.toBeNull()

      // Allow 2 px tolerance for sub-pixel rendering
      expect(box!.x, 'Nav-CTA liegt links außerhalb').toBeGreaterThanOrEqual(0)
      expect(
        box!.x + box!.width,
        'Nav-CTA ragt rechts aus dem Viewport',
      ).toBeLessThanOrEqual(viewport.width + 2)

      await ctx.close()
    })

    test('hreflang-Links sind vollständig und korrekt', async ({ browser }) => {
      const { ctx, page } = await spawnRealDevice(browser)

      await page.goto(lp.path)

      // Self-referencing hreflang
      const selfLink = page.locator(`link[rel="alternate"][hreflang="${lp.hreflangSelf}"]`)
      await expect(selfLink).toHaveCount(1)
      const selfHref = await selfLink.getAttribute('href')
      expect(selfHref).toContain(lp.path)

      // Cross-language hreflang
      const otherLink = page.locator(`link[rel="alternate"][hreflang="${lp.hreflangOther}"]`)
      await expect(otherLink).toHaveCount(1)
      const otherHref = await otherLink.getAttribute('href')
      expect(otherHref).toBe(lp.hreflangOtherHref)

      // x-default must point to EN page
      const xDefaultLink = page.locator('link[rel="alternate"][hreflang="x-default"]')
      await expect(xDefaultLink).toHaveCount(1)
      const xDefaultHref = await xDefaultLink.getAttribute('href')
      expect(xDefaultHref).toBe(lp.xDefaultHref)

      await ctx.close()
    })

  })
}

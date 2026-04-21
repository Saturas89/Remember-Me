import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { detectLocale, STORAGE_KEY } from './detectLocale'

// ── helpers ──────────────────────────────────────────────────────────────────

function setLanguages(langs: readonly string[]) {
  Object.defineProperty(navigator, 'languages', {
    get: () => langs,
    configurable: true,
  })
  Object.defineProperty(navigator, 'language', {
    get: () => langs[0] ?? '',
    configurable: true,
  })
}

function setTimezone(tz: string) {
  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
    () => ({ resolvedOptions: () => ({ timeZone: tz }) }) as unknown as Intl.DateTimeFormat,
  )
}

// ── setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear()
  setLanguages([])           // no browser language signal by default
  setTimezone('America/New_York') // neutral non-German timezone
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── tests ─────────────────────────────────────────────────────────────────────

describe('detectLocale', () => {
  // ── 1. localStorage ────────────────────────────────────────────────────────
  describe('1 · stored preference', () => {
    it('returns "de" when "de" is stored', () => {
      localStorage.setItem(STORAGE_KEY, 'de')
      expect(detectLocale()).toBe('de')
    })

    it('returns "en" when "en" is stored', () => {
      localStorage.setItem(STORAGE_KEY, 'en')
      expect(detectLocale()).toBe('en')
    })

    it('ignores an unknown stored value and falls through', () => {
      localStorage.setItem(STORAGE_KEY, 'fr')
      expect(detectLocale()).toBe('en') // reaches fallback
    })

    it('stored "en" beats a German timezone', () => {
      localStorage.setItem(STORAGE_KEY, 'en')
      setTimezone('Europe/Berlin')
      expect(detectLocale()).toBe('en')
    })

    it('stored "de" beats an English browser language', () => {
      localStorage.setItem(STORAGE_KEY, 'de')
      setLanguages(['en-US'])
      expect(detectLocale()).toBe('de')
    })
  })

  // ── 2. navigator.languages ─────────────────────────────────────────────────
  describe('2 · navigator.languages', () => {
    it('returns "de" for ["de-DE"]', () => {
      setLanguages(['de-DE'])
      expect(detectLocale()).toBe('de')
    })

    it('returns "de" for plain "de"', () => {
      setLanguages(['de'])
      expect(detectLocale()).toBe('de')
    })

    it('returns "de" for ["de-AT"] (Austrian German)', () => {
      setLanguages(['de-AT'])
      expect(detectLocale()).toBe('de')
    })

    it('returns "de" for ["de-CH"] (Swiss German)', () => {
      setLanguages(['de-CH'])
      expect(detectLocale()).toBe('de')
    })

    it('returns "en" for ["en-US"]', () => {
      setLanguages(['en-US'])
      expect(detectLocale()).toBe('en')
    })

    it('returns "en" for ["en-GB"]', () => {
      setLanguages(['en-GB'])
      expect(detectLocale()).toBe('en')
    })

    it('picks the first de/en match: ["fr-FR", "de-DE", "en-US"] → "de"', () => {
      setLanguages(['fr-FR', 'de-DE', 'en-US'])
      expect(detectLocale()).toBe('de')
    })

    it('picks the first de/en match: ["fr-FR", "en-US", "de-DE"] → "en"', () => {
      setLanguages(['fr-FR', 'en-US', 'de-DE'])
      expect(detectLocale()).toBe('en')
    })

    it('falls through to timezone when no de/en language is found', () => {
      setLanguages(['fr-FR', 'es-ES'])
      setTimezone('Europe/Vienna')
      expect(detectLocale()).toBe('de')
    })
  })

  // ── 3. timezone ────────────────────────────────────────────────────────────
  describe('3 · timezone detection (non-de/en browser)', () => {
    beforeEach(() => setLanguages(['fr-FR'])) // skip language step

    it.each([
      'Europe/Berlin',
      'Europe/Busingen',
      'Europe/Vienna',
      'Europe/Zurich',
      'Europe/Vaduz',
    ])('returns "de" for %s', (tz) => {
      setTimezone(tz)
      expect(detectLocale()).toBe('de')
    })

    it.each([
      'Europe/London',
      'Europe/Paris',
      'Europe/Rome',
      'America/New_York',
      'America/Chicago',
      'Asia/Tokyo',
    ])('does NOT return "de" for %s → falls back to "en"', (tz) => {
      setTimezone(tz)
      expect(detectLocale()).toBe('en')
    })
  })

  // ── 4. fallback ────────────────────────────────────────────────────────────
  describe('4 · fallback', () => {
    it('returns "en" when no signal matches', () => {
      setLanguages(['fr-FR'])
      setTimezone('America/New_York')
      expect(detectLocale()).toBe('en')
    })

    it('returns "en" for an empty languages array', () => {
      setLanguages([])
      setTimezone('America/New_York')
      expect(detectLocale()).toBe('en')
    })
  })
})

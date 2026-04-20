import { createContext, useContext, useState, useEffect, createElement, type ReactNode } from 'react'
import type { Locale, Translations } from './types'
import { de } from './de'
import { en } from './en'

const LOCALES: Record<Locale, Translations> = { de, en }
const STORAGE_KEY = 'rm-lang'

// Timezones of German-speaking countries (DE / AT / CH / LI)
const GERMAN_TIMEZONES = new Set([
  'Europe/Berlin', 'Europe/Busingen',   // Germany
  'Europe/Vienna',                       // Austria
  'Europe/Zurich',                       // Switzerland
  'Europe/Vaduz',                        // Liechtenstein
])

function detectLocale(): Locale {
  // 1. Explicit user choice stored in localStorage
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null
    if (stored && stored in LOCALES) return stored
  } catch { /* noop */ }

  // 2. Browser language preferences (ordered list)
  const langs = (navigator.languages?.length ? navigator.languages : [navigator.language]) ?? []
  for (const lang of langs) {
    const code = lang.split('-')[0].toLowerCase()
    if (code === 'de') return 'de'
    if (code === 'en') return 'en'
  }

  // 3. Timezone → German-speaking country even with a non-de/en browser
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (GERMAN_TIMEZONES.has(tz)) return 'de'
  } catch { /* noop */ }

  return 'de'
}

interface I18nContextValue {
  t: Translations
  locale: Locale
  setLocale: (l: Locale) => void
}

const I18nContext = createContext<I18nContextValue>({
  t: de,
  locale: 'de',
  setLocale: () => {},
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, locale) } catch { /* noop */ }
    document.documentElement.setAttribute('lang', locale)
  }, [locale])

  function setLocale(l: Locale) {
    setLocaleState(l)
  }

  return createElement(
    I18nContext.Provider,
    { value: { t: LOCALES[locale], locale, setLocale } },
    children,
  )
}

export function useTranslation() {
  return useContext(I18nContext)
}

export type { Locale, Translations }

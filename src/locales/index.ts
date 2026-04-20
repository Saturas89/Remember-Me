import { createContext, useContext, useState, useEffect, createElement, type ReactNode } from 'react'
import type { Locale, Translations } from './types'
import { de } from './de'
import { en } from './en'

const LOCALES: Record<Locale, Translations> = { de, en }
const STORAGE_KEY = 'rm-lang'

function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null
    if (stored && stored in LOCALES) return stored
  } catch { /* noop */ }
  const browser = navigator.language?.split('-')[0]
  if (browser === 'en') return 'en'
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

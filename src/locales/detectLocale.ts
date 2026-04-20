import type { Locale } from './types'

export const STORAGE_KEY = 'rm-lang'

export const GERMAN_TIMEZONES = new Set([
  'Europe/Berlin', 'Europe/Busingen',   // Germany
  'Europe/Vienna',                       // Austria
  'Europe/Zurich',                       // Switzerland
  'Europe/Vaduz',                        // Liechtenstein
])

/**
 * Determines the initial locale without any user interaction.
 *
 * Priority:
 *  1. Explicit user choice stored in localStorage
 *  2. navigator.languages – first entry whose language code is 'de' or 'en'
 *  3. System timezone – German-speaking countries → 'de'
 *  4. Fallback → 'en'
 */
export function detectLocale(): Locale {
  // 1. Stored preference
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'de' || stored === 'en') return stored
  } catch { /* noop */ }

  // 2. Browser language list
  const langs = navigator.languages?.length
    ? navigator.languages
    : [navigator.language ?? '']
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

  return 'en'
}

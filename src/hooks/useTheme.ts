import { useState, useEffect } from 'react'

export type ThemeId = 'nacht' | 'hell' | 'sepia' | 'ozean'

export const THEMES: { id: ThemeId; label: string; emoji: string }[] = [
  { id: 'nacht', label: 'Nacht',  emoji: '🌙' },
  { id: 'hell',  label: 'Hell',   emoji: '☀️' },
  { id: 'sepia', label: 'Sepia',  emoji: '📜' },
  { id: 'ozean', label: 'Ozean',  emoji: '🌊' },
]

const STORAGE_KEY = 'rm-theme'
const DEFAULT: ThemeId = 'nacht'

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY) as ThemeId) ?? DEFAULT
    } catch {
      return DEFAULT
    }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem(STORAGE_KEY, theme) } catch { /* noop */ }
  }, [theme])

  return { theme, setTheme: setThemeState }
}

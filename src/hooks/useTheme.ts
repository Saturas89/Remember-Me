import { useState, useEffect } from 'react'

export type ThemeId = 'nacht' | 'hell' | 'sepia' | 'ozean'

export const THEMES: { id: ThemeId; label: string; emoji: string; color: string }[] = [
  { id: 'nacht', label: 'Nacht',  emoji: '🌙', color: '#e94560' },
  { id: 'hell',  label: 'Hell',   emoji: '☀️', color: '#c0392b' },
  { id: 'sepia', label: 'Sepia',  emoji: '📜', color: '#7b3f00' },
  { id: 'ozean', label: 'Ozean',  emoji: '🌊', color: '#00bcd4' },
]

const STORAGE_KEY = 'rm-theme'
const DEFAULT: ThemeId = 'sepia'

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

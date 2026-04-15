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

const THEME_BG: Record<ThemeId, string> = {
  nacht: '#1a1a2e',
  hell:  '#f5f5f0',
  sepia: '#f2ebe0',
  ozean: '#0a1628',
}

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
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (meta) meta.content = THEME_BG[theme]
    try { localStorage.setItem(STORAGE_KEY, theme) } catch { /* noop */ }
  }, [theme])

  return { theme, setTheme: setThemeState }
}

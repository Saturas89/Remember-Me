import { THEMES } from '../hooks/useTheme'
import type { ThemeId } from '../hooks/useTheme'

interface Props {
  current: ThemeId
  onChange: (id: ThemeId) => void
}

export function ThemeSwitcher({ current, onChange }: Props) {
  return (
    <div className="theme-switcher" role="group" aria-label="Theme wählen">
      {THEMES.map(t => (
        <button
          key={t.id}
          className={`theme-btn ${current === t.id ? 'theme-btn--active' : ''}`}
          onClick={() => onChange(t.id)}
          title={t.label}
          aria-pressed={current === t.id}
        >
          {t.emoji}
        </button>
      ))}
    </div>
  )
}

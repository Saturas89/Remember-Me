import { THEMES } from '../hooks/useTheme'
import type { ThemeId } from '../hooks/useTheme'
import { useTranslation } from '../locales'

interface Props {
  current: ThemeId
  onChange: (id: ThemeId) => void
}

export function ThemeSwitcher({ current, onChange }: Props) {
  const { t } = useTranslation()
  return (
    <div className="theme-switcher" role="group" aria-label={t.themes.chooseAriaLabel}>
      {THEMES.map(theme => (
        <button
          key={theme.id}
          className={`theme-btn ${current === theme.id ? 'theme-btn--active' : ''}`}
          onClick={() => onChange(theme.id)}
          title={theme.label}
          aria-pressed={current === theme.id}
        >
          {theme.emoji}
        </button>
      ))}
    </div>
  )
}

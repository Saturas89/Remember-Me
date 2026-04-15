type MainTab = 'home' | 'friends' | 'archive' | 'feature' | 'profile'

interface Props {
  current: string
  onNavigate: (tab: MainTab) => void
  friendsBadge?: number
}

const TABS: { id: MainTab; label: string; emoji: string }[] = [
  { id: 'home',    label: 'Lebensweg',   emoji: '🛤️' },
  { id: 'friends', label: 'Freunde',     emoji: '👥' },
  { id: 'archive', label: 'Vermächtnis', emoji: '📖' },
  { id: 'feature', label: 'Features',    emoji: '✨' },
  { id: 'profile', label: 'Profil',      emoji: '👤' },
]

export function BottomNav({ current, onNavigate, friendsBadge = 0 }: Props) {
  return (
    <nav className="bottom-nav" aria-label="Hauptnavigation">
      {TABS.map(tab => {
        const active = current === tab.id
        const badge = tab.id === 'friends' ? friendsBadge : 0
        return (
          <button
            key={tab.id}
            type="button"
            className={`bottom-nav__tab${active ? ' bottom-nav__tab--active' : ''}`}
            onClick={() => onNavigate(tab.id)}
            aria-current={active ? 'page' : undefined}
          >
            <span className="bottom-nav__icon" aria-hidden="true">{tab.emoji}</span>
            <span className="bottom-nav__label">{tab.label}</span>
            {badge > 0 && (
              <span className="bottom-nav__badge" aria-hidden="true">
                {badge > 9 ? '9+' : badge}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}

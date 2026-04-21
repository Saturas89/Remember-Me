import { useTranslation } from '../locales'

type MainTab = 'home' | 'friends' | 'archive' | 'feature' | 'profile'

interface Props {
  current: string
  onNavigate: (tab: MainTab) => void
  friendsBadge?: number
}

export function BottomNav({ current, onNavigate, friendsBadge = 0 }: Props) {
  const { t } = useTranslation()

  const TABS: { id: MainTab; label: string; icon: string }[] = [
    { id: 'home',    label: t.nav.home,     icon: '/menu-icons/lebensweg.jpeg' },
    { id: 'friends', label: t.nav.friends,  icon: '/menu-icons/freunde.jpeg' },
    { id: 'archive', label: t.nav.archive,  icon: '/menu-icons/vermaechtnis.jpeg' },
    { id: 'feature', label: t.nav.features, icon: '/menu-icons/features.jpeg' },
    { id: 'profile', label: t.nav.profile,  icon: '/menu-icons/profil.jpeg' },
  ]

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
            <span className="bottom-nav__icon" aria-hidden="true">
              <img src={tab.icon} alt="" className="bottom-nav__icon-img" draggable={false} />
            </span>
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

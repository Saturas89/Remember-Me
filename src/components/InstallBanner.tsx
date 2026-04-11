import type { InstallState } from '../hooks/useInstallPrompt'

interface Props {
  state: InstallState
  onInstall: () => void
  onDismiss: () => void
}

export function InstallBanner({ state, onInstall, onDismiss }: Props) {
  if (state.type === 'android') {
    return (
      <div className="install-banner">
        <div className="install-banner__icon">📱</div>
        <div className="install-banner__body">
          <p className="install-banner__title">App installieren</p>
          <p className="install-banner__sub">Füge Remember Me zum Startbildschirm hinzu</p>
        </div>
        <button className="btn btn--primary btn--sm" onClick={onInstall}>
          Installieren
        </button>
        <button className="install-banner__close" onClick={onDismiss} aria-label="Schließen">
          ✕
        </button>
      </div>
    )
  }

  if (state.type === 'ios') {
    return (
      <div className="install-banner install-banner--ios">
        <div className="install-banner__icon">📱</div>
        <div className="install-banner__body">
          <p className="install-banner__title">Zum Startbildschirm hinzufügen</p>
          <p className="install-banner__sub">
            Tippe auf{' '}
            <span className="install-banner__share-icon">
              {/* Safari share icon */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginBottom: '1px' }}>
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                <polyline points="16 6 12 2 8 6"/>
                <line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
            </span>
            {' '}und dann <strong>„Zum Home-Bildschirm"</strong>
          </p>
        </div>
        <button className="install-banner__close" onClick={onDismiss} aria-label="Schließen">
          ✕
        </button>
      </div>
    )
  }

  return null
}

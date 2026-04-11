import type { InstallState } from '../hooks/useInstallPrompt'

interface Props {
  state: InstallState
  onInstall: () => void
  onDismiss: () => void
}

const HeartIcon = () => (
  <svg viewBox="-6 -6 60 56" fill="none" aria-hidden="true" className="install-modal__heart">
    <path
      d="M24 41C24 41 2 27 2 13.5A11.5 11.5 0 0 1 24 6.1 11.5 11.5 0 0 1 46 13.5C46 27 24 41 24 41Z"
      fill="var(--accent)"
    />
    <path
      d="M13 10c-3 0-5.5 2.5-5.5 5.5"
      stroke="rgba(255,255,255,0.35)"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
)

const ShareIcon = () => (
  <svg
    width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
    style={{ display: 'inline', verticalAlign: 'middle' }}
  >
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
    <polyline points="16 6 12 2 8 6"/>
    <line x1="12" y1="2" x2="12" y2="15"/>
  </svg>
)

export function InstallBanner({ state, onInstall, onDismiss }: Props) {
  if (state.type !== 'android' && state.type !== 'ios') return null

  return (
    <>
      {/* Backdrop */}
      <div className="install-overlay" onClick={onDismiss} aria-hidden="true" />

      {/* Modal */}
      <div className="install-modal" role="dialog" aria-modal="true" aria-label="App installieren">
        <button className="install-modal__close" onClick={onDismiss} aria-label="Schließen">
          ✕
        </button>

        {/* Branding */}
        <div className="install-modal__brand">
          <HeartIcon />
          <span className="install-modal__app-name">Remember Me</span>
        </div>

        {state.type === 'android' && (
          <>
            <h2 className="install-modal__title">Zum Startbildschirm hinzufügen</h2>
            <p className="install-modal__desc">
              Installiere Remember Me als App – immer griffbereit, auch ohne Internetverbindung.
            </p>
            <div className="install-modal__actions">
              <button className="btn btn--primary" onClick={onInstall}>
                Jetzt installieren
              </button>
              <button className="btn btn--ghost" onClick={onDismiss}>
                Nicht jetzt
              </button>
            </div>
          </>
        )}

        {state.type === 'ios' && (
          <>
            <h2 className="install-modal__title">Zum Startbildschirm hinzufügen</h2>
            <p className="install-modal__desc">
              Öffne Remember Me als App direkt vom Homescreen – auch offline verfügbar.
            </p>

            {/* Step-by-step iOS instructions */}
            <ol className="install-modal__steps">
              <li>
                Tippe auf das Teilen-Symbol{' '}
                <span className="install-modal__share-badge">
                  <ShareIcon />
                </span>{' '}
                in der Menüleiste
              </li>
              <li>
                Wähle <strong>„Zum Home-Bildschirm"</strong>
              </li>
              <li>
                Tippe auf <strong>„Hinzufügen"</strong>
              </li>
            </ol>

            {/* Arrow pointing down to iOS toolbar */}
            <div className="install-modal__arrow-hint" aria-hidden="true">
              <span>↓</span>
              <span className="install-modal__arrow-label">Menüleiste</span>
            </div>

            <button className="btn btn--ghost" onClick={onDismiss} style={{ marginTop: '0.5rem' }}>
              Verstanden
            </button>
          </>
        )}
      </div>
    </>
  )
}

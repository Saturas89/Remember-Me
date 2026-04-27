import './Logo.css'
import { useTranslation } from '../locales'
import type { InstallState } from '../hooks/useInstallPrompt'

interface Props {
  state: InstallState
  onInstall: () => void
  onDismiss: () => void
}

const HeartIcon = () => (
  <div className="install-modal__heart app-logo-wrap" aria-hidden="true">
    <img src="/logo.jpeg" className="app-logo-img" alt="" />
  </div>
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
  const { t } = useTranslation()
  if (state.type !== 'android' && state.type !== 'ios') return null

  return (
    <>
      <div className="install-overlay" onClick={onDismiss} aria-hidden="true" />
      <div className="install-modal" role="dialog" aria-modal="true" aria-label={t.install.ariaLabel}>
        <button className="install-modal__close" onClick={onDismiss} aria-label={t.install.ariaClose}>
          ✕
        </button>
        <div className="install-modal__brand">
          <HeartIcon />
          <span className="install-modal__app-name">Remember Me</span>
        </div>

        {state.type === 'android' && (
          <>
            <h2 className="install-modal__title">{t.install.androidTitle}</h2>
            <p className="install-modal__desc">{t.install.androidDesc}</p>
            <div className="install-modal__actions">
              <button className="btn btn--primary" onClick={onInstall}>
                {t.install.installNow}
              </button>
              <button className="btn btn--ghost" onClick={onDismiss}>
                {t.install.notNow}
              </button>
            </div>
          </>
        )}

        {state.type === 'ios' && (
          <>
            <h2 className="install-modal__title">{t.install.iosTitle}</h2>
            <p className="install-modal__desc">{t.install.iosDesc}</p>
            <ol className="install-modal__steps">
              <li>
                {t.install.iosStep1TapShareIcon}{' '}
                <span className="install-modal__share-badge"><ShareIcon /></span>{' '}
                {t.install.step1}
              </li>
              <li>
                {t.install.iosStep2SelectVerb} <strong>{t.install.step2}</strong>
              </li>
              <li>
                {t.install.iosStep3TapVerb} <strong>{t.install.step3}</strong>
              </li>
            </ol>
            <div className="install-modal__arrow-hint" aria-hidden="true">
              <span>↓</span>
              <span className="install-modal__arrow-label">{t.install.menuHint}</span>
            </div>
            <button className="btn btn--ghost" onClick={onDismiss} style={{ marginTop: '0.5rem' }}>
              {t.install.understand}
            </button>
          </>
        )}
      </div>
    </>
  )
}

import { useTranslation } from '../locales'

export interface WelcomeBackBannerProps {
  visible: boolean
  daysAway: number               // ≥3
  onContinue: () => void         // Klick auf "Weitermachen"
  onDismiss: () => void          // Klick auf ✕
}

export function WelcomeBackBanner(props: WelcomeBackBannerProps): JSX.Element | null {
  const { visible, daysAway, onContinue, onDismiss } = props
  const { t } = useTranslation()

  if (!visible) {
    return null
  }

  return (
    <div 
      className="update-banner welcome-back-banner" 
      data-testid="welcome-back-banner"
      role="alert"
      aria-live="polite"
    >
      <div className="welcome-back-content">
        <div className="welcome-back-text">
          <h3 className="welcome-back-title">
            {t.reminder.welcomeBack.title} 👋
          </h3>
          <p className="welcome-back-message">
            {t.reminder.welcomeBack.bodyDays.replace('{days}', String(daysAway))}
          </p>
        </div>
        <div className="welcome-back-actions">
          <button 
            className="welcome-back-continue"
            data-testid="welcome-back-continue"
            onClick={onContinue}
          >
            {t.reminder.welcomeBack.continueCta} →
          </button>
          <button 
            className="welcome-back-dismiss"
            onClick={onDismiss}
            aria-label={t.reminder.welcomeBack.dismiss}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
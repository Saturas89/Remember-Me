import type { JSX } from 'react'
import { useTranslation } from '../locales'

export interface WelcomeBackBannerProps {
  visible: boolean
  daysAway: number
  onContinue: () => void
  onDismiss: () => void
}

export function WelcomeBackBanner(props: WelcomeBackBannerProps): JSX.Element | null {
  const { visible, daysAway, onContinue, onDismiss } = props
  const { t } = useTranslation()

  if (!visible) return null

  return (
    <div 
      className="update-banner welcome-back-banner" 
      data-testid="welcome-back-banner"
      role="alert"
      aria-live="polite"
    >
      <div className="update-banner-content">
        <div className="update-banner-info">
          <h3 className="update-banner-title" data-testid="welcome-back-title">
            {t.reminder.welcomeBack.title}
          </h3>
          <p className="update-banner-subtitle" data-testid="welcome-back-body">
            {t.reminder.welcomeBack.bodyDays.replace('{days}', String(daysAway))}
          </p>
        </div>
        <div className="update-banner-actions">
          <button 
            type="button"
            className="btn btn-primary"
            onClick={onContinue}
            data-testid="welcome-back-continue"
          >
            {t.reminder.welcomeBack.continueCta}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
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
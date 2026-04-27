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
      <div className="update-banner__content">
        <h2 className="update-banner__title">
          {t.reminder.welcomeBack.title}
        </h2>
        <p className="update-banner__subtitle">
          {t.reminder.welcomeBack.bodyDays.replace('{days}', String(daysAway))}
        </p>
      </div>
      <div className="update-banner__actions">
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={onContinue}
          data-testid="welcome-back-continue"
        >
          {t.reminder.welcomeBack.continueCta}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm update-banner__dismiss"
          onClick={onDismiss}
          aria-label={t.reminder.welcomeBack.dismiss}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
import type { JSX } from 'react'
import { useTranslation } from '../locales'

export interface WelcomeBackBannerProps {
  visible: boolean
  memoriesCount: number
  onContinue: () => void
  onDismiss: () => void
}

export function WelcomeBackBanner(props: WelcomeBackBannerProps): JSX.Element | null {
  const { visible, memoriesCount, onContinue, onDismiss } = props
  const { t } = useTranslation()

  if (!visible) return null

  const body = memoriesCount === 0
    ? t.reminder.welcomeBack.bodyNoMemories
    : memoriesCount === 1
      ? t.reminder.welcomeBack.bodyMemoriesOne
      : t.reminder.welcomeBack.bodyMemoriesMany.replace('{count}', String(memoriesCount))

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
            {body}
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
            className="btn btn-secondary welcome-back-banner__dismiss"
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

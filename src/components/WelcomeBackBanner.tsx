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
      <span className="update-banner__icon" aria-hidden="true">📖</span>
      <div className="update-banner__text">
        <strong data-testid="welcome-back-title">{t.reminder.welcomeBack.title}</strong>
        <span data-testid="welcome-back-body">{body}</span>
      </div>
      <div className="update-banner__actions">
        <button
          type="button"
          className="btn btn--primary btn--sm update-banner__btn"
          onClick={onContinue}
          data-testid="welcome-back-continue"
        >
          {t.reminder.welcomeBack.continueCta}
        </button>
      </div>
      <button
        type="button"
        className="update-banner__close"
        onClick={onDismiss}
        aria-label={t.reminder.welcomeBack.dismiss}
      >
        ✕
      </button>
    </div>
  )
}

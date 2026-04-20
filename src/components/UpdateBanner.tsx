import { useTranslation } from '../locales'

interface Props {
  onUpdate: () => void
  onDismiss: () => void
  onViewNotes?: () => void
}

export function UpdateBanner({ onUpdate, onDismiss, onViewNotes }: Props) {
  const { t } = useTranslation()
  return (
    <div className="update-banner" role="alert" aria-live="polite">
      <span className="update-banner__icon" aria-hidden="true">✨</span>
      <div className="update-banner__text">
        <strong>{t.update.title}</strong>
        <span>{t.update.subtitle}</span>
      </div>
      <div className="update-banner__actions">
        {onViewNotes && (
          <button className="update-banner__notes-btn" onClick={onViewNotes}>
            {t.releaseNotes.viewNotes}
          </button>
        )}
        <button className="btn btn--primary btn--sm update-banner__btn" onClick={onUpdate}>
          {t.update.reload}
        </button>
      </div>
      <button
        className="update-banner__close"
        onClick={onDismiss}
        aria-label={t.update.dismiss}
      >
        ✕
      </button>
    </div>
  )
}

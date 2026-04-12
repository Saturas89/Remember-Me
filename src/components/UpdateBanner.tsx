interface Props {
  onUpdate: () => void
  onDismiss: () => void
}

export function UpdateBanner({ onUpdate, onDismiss }: Props) {
  return (
    <div className="update-banner" role="alert" aria-live="polite">
      <span className="update-banner__icon" aria-hidden="true">✨</span>
      <div className="update-banner__text">
        <strong>Update verfügbar</strong>
        <span>Neue Version bereit zum Laden</span>
      </div>
      <button className="btn btn--primary btn--sm update-banner__btn" onClick={onUpdate}>
        Neu laden
      </button>
      <button
        className="update-banner__close"
        onClick={onDismiss}
        aria-label="Benachrichtigung schließen"
      >
        ✕
      </button>
    </div>
  )
}

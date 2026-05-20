// One-time banner shown after upgrading to v2.13.0 / REQ-022 (FR-22.21).
// Tells users that their existing contacts now auto-receive new memories
// and offers a one-tap shortcut into the Contacts tab to review.

import { useTranslation } from '../locales'

interface Props {
  onOpenContacts: () => void
  onDismiss: () => void
}

export function ShareMigrationBanner({ onOpenContacts, onDismiss }: Props) {
  const { t } = useTranslation()
  const m = t.shareMigration
  return (
    <div className="update-banner" role="alert" aria-live="polite" data-testid="share-migration-banner">
      <span className="update-banner__icon" aria-hidden="true">✨</span>
      <div className="update-banner__text">
        <strong>{m.title}</strong>
        <span>{m.body}</span>
      </div>
      <div className="update-banner__actions">
        <button
          className="btn btn--primary btn--sm update-banner__btn"
          onClick={onOpenContacts}
          data-testid="share-migration-open-contacts"
        >
          {m.openContacts}
        </button>
      </div>
      <button
        className="update-banner__close"
        onClick={onDismiss}
        aria-label={m.dismiss}
        data-testid="share-migration-dismiss"
      >
        ✕
      </button>
    </div>
  )
}

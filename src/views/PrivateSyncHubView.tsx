import { useState } from 'react'
import { useTranslation } from '../locales'
import { SyncStatusBadge } from '../components/SyncStatusBadge'
import type { PrivateSyncState } from '../types'
import type { UsePrivateSyncReturn } from '../hooks/usePrivateSync'

interface Props {
  syncState: PrivateSyncState
  sync: UsePrivateSyncReturn
}

function formatDateTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale === 'de' ? 'de-DE' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function PrivateSyncHubView({ syncState, sync }: Props) {
  const { t, locale } = useTranslation()
  const s = t.privateSync

  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false)

  const providerLabel = {
    'google-drive': s.storedAtGoogle,
    onedrive: s.storedAtOneDrive,
    supabase: s.storedAtSupabase,
  }[syncState.providerType]

  const storedWhat =
    syncState.providerType === 'supabase' ? s.storedWhatTextOnly : s.storedWhatFull

  const lastSyncText = syncState.lastSyncAt
    ? formatDateTime(syncState.lastSyncAt, locale)
    : s.lastSyncNever

  return (
    <div className="private-sync-view">
      <div className="private-sync-view__content">
        <h1 className="private-sync-view__title">{s.hubTitle}</h1>

        <div className="private-sync-hub__status-row">
          <SyncStatusBadge status={sync.status} />
        </div>

        {sync.errorMessage && (
          <p className="private-sync-view__error">{sync.errorMessage}</p>
        )}

        <div className="private-sync-hub__info">
          <div className="private-sync-hub__info-row">
            <span className="private-sync-hub__info-label">{s.storedAt}</span>
            <span className="private-sync-hub__info-value">{providerLabel}</span>
          </div>
          <div className="private-sync-hub__info-row">
            <span className="private-sync-hub__info-label">{s.storedWhat}</span>
            <span className="private-sync-hub__info-value">{storedWhat}</span>
          </div>
          <div className="private-sync-hub__info-row">
            <span className="private-sync-hub__info-label">{s.lastSync}</span>
            <span className="private-sync-hub__info-value">{lastSyncText}</span>
          </div>
        </div>

        <button
          className="btn btn--primary btn--full"
          onClick={() => sync.syncNow()}
          disabled={sync.status === 'syncing'}
          type="button"
        >
          {sync.status === 'syncing' ? s.syncing : s.syncNowButton}
        </button>

        <hr className="private-sync-hub__divider" />

        <button
          className="btn btn--ghost btn--full private-sync-hub__deactivate-btn"
          onClick={() => setShowDeactivateDialog(true)}
          type="button"
        >
          {s.deactivateButton}
        </button>
      </div>

      {showDeactivateDialog && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-box">
            <h3 className="modal-box__title">{s.deactivateTitle}</h3>
            <p className="modal-box__body">{s.deactivateQuestion}</p>
            <div className="modal-box__actions">
              <button
                className="btn btn--danger btn--full"
                onClick={() => { sync.deactivate(true); setShowDeactivateDialog(false) }}
                type="button"
              >
                {s.deactivateDeleteRemote}
              </button>
              <button
                className="btn btn--secondary btn--full"
                onClick={() => { sync.deactivate(false); setShowDeactivateDialog(false) }}
                type="button"
              >
                {s.deactivateKeepRemote}
              </button>
              <button
                className="btn btn--ghost btn--full"
                onClick={() => setShowDeactivateDialog(false)}
                type="button"
              >
                {s.deactivateCancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

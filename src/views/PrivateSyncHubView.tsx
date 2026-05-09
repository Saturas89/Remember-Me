import { useState } from 'react'
import { useTranslation } from '../locales'
import { SyncStatusBadge } from '../components/SyncStatusBadge'
import type { PrivateSyncState } from '../types'
import type { UsePrivateSyncReturn } from '../hooks/usePrivateSync'

interface Props {
  syncState: PrivateSyncState
  sync: UsePrivateSyncReturn
  onDeactivated: () => void
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

export function PrivateSyncHubView({ syncState, sync, onDeactivated }: Props) {
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

  const lastSyncText = sync.lastSyncAt
    ? formatDateTime(sync.lastSyncAt, locale)
    : s.lastSyncNever

  const isSyncing = sync.status === 'syncing'
  const showReauthButton =
    sync.errorCode === 'auth' && syncState.providerType !== 'supabase'
  // Auto-sync läuft 5s nach jeder Änderung + Auto-Retry alle 30s im Fehlerfall.
  // Manuelles Synchronisieren ist nur dann sinnvoll, wenn ein Fehler ansteht
  // und der Auth-Reauth-Flow nicht greift (also Netzwerk-/Quota-/Decrypt-/
  // Unknown-Fehler oder Supabase-Auth-Fehler).
  const showRetryButton = sync.status === 'error' && !showReauthButton

  return (
    <div className="private-sync-view">
      <h1 className="private-sync-view__title">{s.hubTitle}</h1>

      <section className="friends-section">
        <h3 className="friends-section-title">{s.statusHeading}</h3>
        <div className="friends-tags">
          <SyncStatusBadge status={sync.status} className="friends-tag friends-tag--accent" />
          <span className="friends-tag">{s.tagEncrypted}</span>
        </div>
        <p className="friends-hint">
          <strong>{s.lastSync}:</strong> {lastSyncText}
        </p>
        {sync.errorMessage && (
          <p className="friends-hint friends-hint--warn">{sync.errorMessage}</p>
        )}
        {showReauthButton && (
          <div className="friends-share">
            <button
              className="share-cta-btn"
              onClick={() => sync.reauthenticate()}
              disabled={isSyncing}
              type="button"
            >
              {isSyncing ? (
                <>
                  <span className="share-cta-btn__spinner" aria-hidden="true" />
                  {s.signingIn}
                </>
              ) : (
                s.reauthenticateButton
              )}
            </button>
          </div>
        )}
        {showRetryButton && (
          <div className="friends-share">
            <button
              className="share-cta-btn"
              onClick={() => sync.syncNow()}
              disabled={isSyncing}
              type="button"
            >
              {isSyncing ? (
                <>
                  <span className="share-cta-btn__spinner" aria-hidden="true" />
                  {s.syncing}
                </>
              ) : (
                s.retrySyncButton
              )}
            </button>
          </div>
        )}
      </section>

      <section className="friends-section">
        <h3 className="friends-section-title">{s.storageHeading}</h3>
        <dl className="sync-info">
          <div className="sync-info__row">
            <dt className="sync-info__label">{s.storedAt}</dt>
            <dd className="sync-info__value">{providerLabel}</dd>
          </div>
          <div className="sync-info__row">
            <dt className="sync-info__label">{s.storedWhat}</dt>
            <dd className="sync-info__value">{storedWhat}</dd>
          </div>
        </dl>
      </section>

      <section className="friends-section">
        <h3 className="friends-section-title">{s.deactivateHeading}</h3>
        <p className="friends-hint">{s.deactivateSectionHint}</p>
        <button
          className="btn btn--ghost btn--full"
          onClick={() => setShowDeactivateDialog(true)}
          type="button"
        >
          {s.deactivateButton}
        </button>
      </section>

      {showDeactivateDialog && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-box">
            <h3 className="modal-box__title">{s.deactivateTitle}</h3>
            <p className="modal-box__body">{s.deactivateQuestion}</p>
            <div className="modal-box__actions">
              <button
                className="btn btn--danger btn--full"
                onClick={async () => { await sync.deactivate(true); setShowDeactivateDialog(false); onDeactivated() }}
                type="button"
              >
                {s.deactivateDeleteRemote}
              </button>
              <button
                className="btn btn--secondary btn--full"
                onClick={async () => { await sync.deactivate(false); setShowDeactivateDialog(false); onDeactivated() }}
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

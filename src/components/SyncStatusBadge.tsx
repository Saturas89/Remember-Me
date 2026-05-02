import type { SyncStatus } from '../types'

interface Props {
  status: SyncStatus
  className?: string
}

export function SyncStatusBadge({ status, className = '' }: Props) {
  const labels: Record<SyncStatus, string> = {
    idle: 'Sync aktiv',
    syncing: 'Synchronisiert…',
    error: 'Sync-Fehler',
    success: 'Synchronisiert',
  }
  return (
    <span
      className={`sync-badge sync-badge--${status} ${className}`.trim()}
      aria-label={labels[status]}
    >
      <span className="sync-badge__dot" aria-hidden="true" />
      <span className="sync-badge__label">{labels[status]}</span>
    </span>
  )
}

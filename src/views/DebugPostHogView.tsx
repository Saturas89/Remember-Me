import { useState } from 'react'
import type { TrafficType } from '../lib/analytics'

function readTrafficType(): TrafficType {
  const stored = localStorage.getItem('traffic_type')
  if (stored === 'internal' || stored === 'e2e') return stored
  return 'real-user'
}

export function DebugPostHogView() {
  const [trafficType, setTrafficType] = useState<TrafficType>(readTrafficType)

  function apply(type: TrafficType | null) {
    if (type === null) {
      localStorage.removeItem('traffic_type')
      localStorage.removeItem('github_run_id')
      localStorage.removeItem('test_run_id')
      localStorage.removeItem('browser_profile')
      localStorage.removeItem('device_profile')
    } else {
      localStorage.setItem('traffic_type', type)
    }
    setTrafficType(type ?? 'real-user')
    window.location.reload()
  }

  const labels: Record<TrafficType, string> = {
    'real-user': 'Echter Nutzer',
    'internal': 'Interner Tester',
    'e2e': 'Playwright / E2E',
  }

  const badge: Record<TrafficType, string> = {
    'real-user': 'var(--success)',
    'internal': 'var(--accent)',
    'e2e': 'var(--warn)',
  }

  return (
    <div style={{ padding: '2rem 1rem', maxWidth: '480px', margin: '0 auto' }}>
      <div className="friends-section" style={{ marginBottom: '1.5rem' }}>
        <div className="friends-section-title">PostHog Debug</div>

        <div style={{ marginBottom: '1rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Aktueller Status</span>
          <div style={{ marginTop: '0.4rem' }}>
            <span
              className="friends-tag"
              style={{
                background: badge[trafficType],
                color: 'var(--bg)',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            >
              {trafficType}
            </span>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.4rem' }}>
            {labels[trafficType]}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => apply('real-user')}
            disabled={trafficType === 'real-user'}
          >
            Als echter Nutzer
          </button>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => apply('internal')}
            disabled={trafficType === 'internal'}
          >
            Als interner Tester
          </button>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => apply(null)}
            style={{ color: 'var(--warn)' }}
          >
            Alles zurücksetzen
          </button>
        </div>
      </div>

      <div className="friends-hint">
        <strong>Hinweis:</strong> Diese Seite ist nur für interne Tests.
        Änderungen wirken sich auf PostHog-Analytics aus.
        Nach dem Klick wird die App neu geladen.
      </div>
    </div>
  )
}

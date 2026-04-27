import { useState } from 'react'
import { useTranslation } from '../locales'

interface Props {
  /** True when VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set. */
  configured: boolean
  onActivate: () => void
  onBack: () => void
}

/**
 * Transparent consent screen shown before any Supabase request is made.
 * The "Aktivieren"-button is the first place in the app that can trigger
 * online traffic — explaining clearly what goes where is the whole point.
 */
export function OnlineSharingIntroView({ configured, onActivate, onBack }: Props) {
  const { t } = useTranslation()
  const i = t.onlineSharingIntro
  const [confirmed, setConfirmed] = useState(false)

  return (
    <div className="friends-view">
      <div className="quiz-topbar">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>{i.back}</button>
        <h2 className="archive-title">{i.title}</h2>
      </div>

      <div className="feature-detail__hero">
        <img
          src="/features/familienmodus.jpg"
          alt={i.heroAlt}
          className="feature-detail__hero-img"
        />
      </div>

      <section className="friends-section">
        <h3 className="friends-section-title">{i.whatHeading}</h3>
        <p className="friends-hint">{i.whatBody1}</p>
        <p className="friends-hint">
          <strong>{i.whatBody2Strong}</strong>{i.whatBody2Rest}
        </p>
      </section>

      <section className="friends-section">
        <h3 className="friends-section-title">{i.privacyHeading}</h3>
        <p className="friends-hint">{i.privacyBody}</p>
        <details className="friends-details">
          <summary className="friends-details__summary">{i.privacyDetailsSummary}</summary>
          <table className="online-data-table" role="table">
            <thead>
              <tr>
                <th>{i.tableWhat}</th>
                <th>{i.tableWhere}</th>
                <th>{i.tableForm}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{i.row1What}</td>
                <td>{i.row1Where}</td>
                <td>{i.row1Form}</td>
              </tr>
              <tr>
                <td>{i.row2What}</td>
                <td>{i.row2Where}</td>
                <td>{i.row2Form}</td>
              </tr>
              <tr>
                <td>{i.row3What}</td>
                <td>{i.row3Where}</td>
                <td>{i.row3Form}</td>
              </tr>
              <tr>
                <td>{i.row4What}</td>
                <td>{i.row4Where}</td>
                <td>{i.row4Form}</td>
              </tr>
              <tr>
                <td>{i.row5What}</td>
                <td>{i.row5Where}</td>
                <td>{i.row5Form}</td>
              </tr>
              <tr>
                <td>{i.row6What}</td>
                <td>{i.row6Where}</td>
                <td>{i.row6Form}</td>
              </tr>
            </tbody>
          </table>
        </details>
      </section>

      <section className="friends-section">
        <h3 className="friends-section-title">{i.deactivateHeading}</h3>
        <p className="friends-hint">{i.deactivateBody}</p>
      </section>

      {!configured && (
        <section className="friends-section">
          <p className="friends-hint friends-hint--warn">{i.notConfiguredWarning}</p>
        </section>
      )}

      <section className="friends-section">
        <label className="online-consent">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={e => setConfirmed(e.target.checked)}
          />
          <span>{i.consentLabel}</span>
        </label>

        <button
          className="share-cta-btn"
          disabled={!confirmed || !configured}
          onClick={onActivate}
        >
          {i.activateButton}
        </button>
      </section>
    </div>
  )
}

import { useState } from 'react'

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
  const [confirmed, setConfirmed] = useState(false)

  return (
    <div className="friends-view">
      <div className="quiz-topbar">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>Zurück</button>
        <h2 className="archive-title">Familienmodus</h2>
      </div>

      <div className="feature-detail__hero">
        <img
          src="/features/familienmodus.jpg"
          alt="Familienmodus"
          className="feature-detail__hero-img"
        />
      </div>

      <section className="friends-section">
        <h3 className="friends-section-title">Was ist das?</h3>
        <p className="friends-hint">
          Du kannst einzelne Erinnerungen direkt mit ausgewählten Personen
          teilen – Familie, enge Freunde, Kolleg:innen. Sie sehen die
          Erinnerung in ihrem eigenen Remember Me und können ihre Gedanken
          ergänzen. Deine Erinnerung bleibt dabei unverändert.
        </p>
        <p className="friends-hint">
          <strong>Komplett optional.</strong> Ohne Aktivierung bleibt
          Remember Me vollständig offline auf deinem Gerät – dein
          Einladungslink für Antworten funktioniert wie gewohnt weiter.
        </p>
      </section>

      <section className="friends-section">
        <h3 className="friends-section-title">Datenschutz auf einen Blick</h3>
        <p className="friends-hint">
          Deine Antworten, Fotos und Aufnahmen bleiben immer nur auf deinem
          Gerät. Was du aktiv mit jemandem teilst, wird verschlüsselt
          gespeichert – nur du und die andere Person können es lesen.
        </p>
        <details className="friends-details">
          <summary className="friends-details__summary">Technische Details</summary>
          <table className="online-data-table" role="table">
            <thead>
              <tr>
                <th>Was</th>
                <th>Wo</th>
                <th>Form</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Profilname, alle Antworten, Bilder</td>
                <td>Nur auf deinem Gerät</td>
                <td>Klartext lokal</td>
              </tr>
              <tr>
                <td>Geteilte Erinnerungen (Text + Bilder)</td>
                <td>Server (EU)</td>
                <td>Ende-zu-Ende-verschlüsselt (AES-256-GCM)</td>
              </tr>
              <tr>
                <td>Empfänger einer Erinnerung</td>
                <td>Server</td>
                <td>Anonyme Geräte-IDs, keine Namen</td>
              </tr>
              <tr>
                <td>Zeitstempel der Freigabe</td>
                <td>Server</td>
                <td>Unverschlüsselt (Metadaten)</td>
              </tr>
              <tr>
                <td>Verschlüsselungsschlüssel</td>
                <td>Nur auf deinem Gerät</td>
                <td>Lokal gesichert, nicht exportierbar</td>
              </tr>
              <tr>
                <td>Öffentlicher Schlüssel + Geräte-ID</td>
                <td>Server</td>
                <td>Wird für die Verschlüsselung benötigt (ECDH)</td>
              </tr>
            </tbody>
          </table>
        </details>
      </section>

      <section className="friends-section">
        <h3 className="friends-section-title">Was passiert beim Deaktivieren?</h3>
        <p className="friends-hint">
          Alle geteilten Erinnerungen werden vom Server gelöscht und die
          Verbindung zu deinen Kontakten getrennt. Deine eigenen Antworten
          und Fotos auf diesem Gerät bleiben vollständig erhalten.
        </p>
      </section>

      {!configured && (
        <section className="friends-section">
          <p className="friends-hint friends-hint--warn">
            Diese Installation unterstützt das direkte Teilen noch nicht.
            Frag die Person, die Remember Me für dich betreibt, ob das
            Feature verfügbar ist.
          </p>
        </section>
      )}

      <section className="friends-section">
        <label className="online-consent">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={e => setConfirmed(e.target.checked)}
          />
          <span>
            Ich habe verstanden, dass meine geteilten Erinnerungen
            verschlüsselt gespeichert werden.
          </span>
        </label>

        <button
          className="share-cta-btn"
          disabled={!confirmed || !configured}
          onClick={onActivate}
        >
          Aktivieren
        </button>
      </section>
    </div>
  )
}

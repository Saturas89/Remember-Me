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
        <h2 className="archive-title">Online teilen</h2>
      </div>

      <section className="friends-section">
        <h3 className="friends-section-title">Was ist das?</h3>
        <p className="friends-hint">
          Du kannst einzelne Erinnerungen online mit ausgewählten Personen
          teilen – Familie, enge Freunde, Kolleg:innen. Sie sehen die
          Erinnerung in ihrem eigenen Remember Me und können eigene
          Ergänzungen dazuschreiben (deine ursprüngliche Erinnerung bleibt
          unverändert).
        </p>
        <p className="friends-hint">
          <strong>Das Feature ist komplett optional.</strong> Wenn du es
          nicht aktivierst, arbeitet Remember Me wie bisher 100 % offline auf
          deinem Gerät. Der bestehende Einladungs-Link für Freunde
          funktioniert weiterhin ohne Internet.
        </p>
      </section>

      <section className="friends-section">
        <h3 className="friends-section-title">Was wird wo gespeichert?</h3>
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
              <td>Supabase (EU)</td>
              <td>Ciphertext (AES-256-GCM)</td>
            </tr>
            <tr>
              <td>Empfänger einer Erinnerung</td>
              <td>Supabase</td>
              <td>Opake Geräte-IDs, keine Namen</td>
            </tr>
            <tr>
              <td>Zeitstempel der Freigabe</td>
              <td>Supabase</td>
              <td>Klartext (Metadaten)</td>
            </tr>
            <tr>
              <td>Dein Private Key</td>
              <td>Nur auf deinem Gerät</td>
              <td>IndexedDB, nicht exportierbar</td>
            </tr>
            <tr>
              <td>Dein Public Key + anonyme Geräte-ID</td>
              <td>Supabase</td>
              <td>Klartext (nötig für ECDH)</td>
            </tr>
          </tbody>
        </table>
        <p className="friends-hint">
          <strong>Ende-zu-Ende-verschlüsselt:</strong> Der Server kann deine
          Inhalte nicht entschlüsseln – die Schlüssel dafür liegen nur auf
          den Geräten der Beteiligten.
        </p>
      </section>

      <section className="friends-section">
        <h3 className="friends-section-title">Was passiert beim Deaktivieren?</h3>
        <p className="friends-hint">
          Ein Klick auf „Online-Teilen deaktivieren" löscht alle deine
          geteilten Erinnerungen, Ergänzungen und Medien vom Server, meldet
          dein Gerät ab und entfernt deinen Private Key lokal. Deine eigenen
          Offline-Antworten bleiben unberührt.
        </p>
      </section>

      {!configured && (
        <section className="friends-section">
          <p className="friends-hint friends-hint--warn">
            Diese Installation ist nicht für Online-Sharing konfiguriert.
            Frag die Person, die Remember Me für dich gehostet hat, ob das
            Feature zur Verfügung steht.
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
            Ich habe verstanden, welche Daten bei Aktivierung in
            verschlüsselter Form an den Server gehen.
          </span>
        </label>

        <button
          className="share-cta-btn"
          disabled={!confirmed || !configured}
          onClick={onActivate}
        >
          Online-Teilen aktivieren
        </button>
      </section>
    </div>
  )
}

import { useState, useRef } from 'react'
import { HeroLogo } from '../components/Logo'
import { importFile } from '../utils/archiveImport'
import type { Profile } from '../types'

interface Props {
  onComplete: (profile: Profile) => void
  onImportBackup: (json: string) => { ok: boolean; error?: string }
}

const FEATURES = [
  { icon: '🔒', title: 'Privat', desc: 'Keine Anmeldung, keine Cloud' },
  { icon: '📴', title: 'Offline', desc: 'Funktioniert ohne Internet' },
  { icon: '❤️', title: 'Für immer', desc: 'Für Familie & Nachwelt' },
]

export function OnboardingView({ onComplete, onImportBackup }: Props) {
  const [name, setName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importProgress, setImportProgress] = useState<{ step: string; pct: number } | null>(null)
  const [importStatus, setImportStatus] = useState<{ ok: boolean; message: string } | null>(null)

  function handleStart() {
    const trimmed = name.trim()
    if (!trimmed) return
    onComplete({
      name: trimmed,
      createdAt: new Date().toISOString(),
    })
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const isZip = file.name.toLowerCase().endsWith('.zip')
    const confirmed = window.confirm(
      isZip
        ? 'Dies stellt alle Erinnerungen – Texte, Fotos, Videos und Aufnahmen – aus dem Archiv wieder her. Fortfahren?'
        : 'Dies lädt die Backup-Daten. Fortfahren?'
    )
    if (!confirmed) {
      e.target.value = ''
      return
    }

    setImportProgress({ step: 'Vorbereitung…', pct: 0 })
    setImportStatus(null)

    const result = await importFile(file, (step, pct) => {
      setImportProgress({ step, pct })
    })

    setImportProgress(null)
    e.target.value = ''

    if (!result.ok) {
      setImportStatus({ ok: false, message: result.error ?? 'Import fehlgeschlagen.' })
      return
    }

    const restore = onImportBackup(result.jsonText!)
    const stats = result.stats
    const mediaHint = stats && (stats.photos + stats.audio + stats.videos) > 0
      ? ` (${[
          stats.photos  > 0 ? `${stats.photos} Foto${stats.photos !== 1 ? 's' : ''}` : '',
          stats.videos  > 0 ? `${stats.videos} Video${stats.videos !== 1 ? 's' : ''}` : '',
          stats.audio   > 0 ? `${stats.audio} Aufnahme${stats.audio !== 1 ? 'n' : ''}` : '',
        ].filter(Boolean).join(', ')} wiederhergestellt)`
      : ''

    setImportStatus({
      ok: restore.ok,
      message: restore.ok
        ? `✓ Archiv erfolgreich geladen${mediaHint}.`
        : (restore.error ?? 'Import fehlgeschlagen.'),
    })

    // If it was successful, App.tsx will automatically transition out of OnboardingView
    // since `profile` will now be set in state after `restoreBackup`.
  }

  return (
    <div className="onboarding">
      {/* Hero */}
      <div className="onboarding__hero">
        <HeroLogo />
        <p className="onboarding__tagline">
          Deine Geschichte verdient es,<br />erzählt zu werden.
        </p>
      </div>

      {/* Story text */}
      <div className="onboarding__story">
        <p>
          Viele Erinnerungen verblassen. Fragen, die du deinen Großeltern nie gestellt hast.
          Momente, die niemand aufgeschrieben hat.
        </p>
        <p>
          <strong>Remember Me</strong> führt dich mit gezielten Fragen durch dein Leben –
          damit die Menschen, die dir wichtig sind, dich wirklich kennen.
        </p>
      </div>

      {/* Feature pills */}
      <div className="onboarding__features">
        {FEATURES.map((f, i) => (
          <div key={f.title} className="onboarding__feature" style={{ animationDelay: `${0.1 + i * 0.1}s` }}>
            <span className="onboarding__feature-icon">{f.icon}</span>
            <span className="onboarding__feature-title">{f.title}</span>
            <span className="onboarding__feature-desc">{f.desc}</span>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="onboarding__divider" />

      {/* Name input */}
      <div className="onboarding__form">
        <label className="onboarding__label" htmlFor="onboarding-name">
          Wie heißt du?
        </label>
        <p className="onboarding__label-hint">
          Dein Name personalisiert die Einladungen für Freunde und Familie.
        </p>
        <input
          id="onboarding-name"
          className="input-text onboarding__input"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleStart()}
          placeholder="Dein Name..."
          autoFocus
          autoComplete="given-name"
        />
        <button
          className="btn btn--primary onboarding__cta"
          onClick={handleStart}
          disabled={!name.trim()}
        >
          Loslegen →
        </button>
      </div>

      <div className="onboarding__import">
        <div className="onboarding__divider" />
        <p className="onboarding__label-hint" style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
          Du hast Remember Me schon einmal genutzt?
        </p>
        <button
          type="button"
          className="btn btn--outline onboarding__import-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={!!importProgress}
        >
          📂 Archiv laden…
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,.json,application/zip,application/json"
          style={{ display: 'none' }}
          onChange={handleImportFile}
        />
        {importProgress && (
          <div className="import-progress" style={{ marginTop: '1rem', width: '100%', maxWidth: '320px', margin: '1rem auto 0' }}>
            <p className="import-progress__step">{importProgress.step}</p>
            <div className="import-progress__bar">
              <div
                className="import-progress__fill"
                style={{ width: `${importProgress.pct}%` }}
              />
            </div>
          </div>
        )}
        {importStatus && (
          <p className={`import-msg import-msg--${importStatus.ok ? 'success' : 'error'}`} style={{ marginTop: '1rem', textAlign: 'center' }}>
            {importStatus.message}
          </p>
        )}
      </div>

      {/* Footer note */}
      <p className="onboarding__footer">
        Kostenlos · Keine Anmeldung nötig · Deine Daten bleiben auf deinem Gerät
      </p>
    </div>
  )
}

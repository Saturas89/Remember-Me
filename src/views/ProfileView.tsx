import { useState, useRef } from 'react'
import { CATEGORIES } from '../data/categories'
import { THEMES, useTheme } from '../hooks/useTheme'
import type { Profile, Answer } from '../types'

interface Props {
  profile: Profile | null
  answers: Record<string, Answer>
  friendCount: number
  onSave: (profile: Profile) => void
  onBack: () => void
  onExportMarkdown: () => void
  onExportJson: () => void
  onExportBackup: () => void
  onImportBackup: (json: string) => { ok: boolean; error?: string }
}

export function ProfileView({
  profile, answers, friendCount,
  onSave, onBack,
  onExportMarkdown, onExportJson, onExportBackup, onImportBackup,
}: Props) {
  const { theme, setTheme } = useTheme()
  const [name, setName] = useState(profile?.name ?? '')
  const [birthYear, setBirthYear] = useState(
    profile?.birthYear ? String(profile.birthYear) : '',
  )
  const [saved, setSaved] = useState(false)
  const [importStatus, setImportStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const totalQuestions = CATEGORIES.reduce((s, c) => s + c.questions.length, 0)
  const totalAnswered = Object.values(answers).filter(
    a => a.value.trim() || (a.imageIds?.length ?? 0) > 0,
  ).length
  const overallPct = totalQuestions > 0 ? Math.round((totalAnswered / totalQuestions) * 100) : 0

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('de-DE', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  const daysSince = profile?.createdAt
    ? Math.floor((Date.now() - new Date(profile.createdAt).getTime()) / 86_400_000)
    : 0

  const initials = name.trim()
    ? name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  function handleSave() {
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      birthYear: birthYear ? parseInt(birthYear, 10) : undefined,
      createdAt: profile?.createdAt ?? new Date().toISOString(),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const ok = window.confirm(
      'Dies überschreibt alle aktuellen Daten mit dem Backup. Fortfahren?'
    )
    if (!ok) {
      e.target.value = ''
      return
    }

    const text = await file.text()
    const result = onImportBackup(text)
    setImportStatus({
      ok: result.ok,
      message: result.ok
        ? '✓ Backup erfolgreich wiederhergestellt.'
        : (result.error ?? 'Import fehlgeschlagen.'),
    })
    e.target.value = ''
    if (result.ok) setTimeout(() => setImportStatus(null), 4000)
  }

  return (
    <div className="profile-view">

      {/* Topbar */}
      <div className="profile-topbar">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>
          ← Zurück
        </button>
      </div>

      {/* Identity header */}
      <div className="profile-identity">
        <div className="profile-avatar" aria-hidden="true">{initials}</div>
        <h1 className="profile-identity__name">{profile?.name}</h1>
        {memberSince && (
          <p className="profile-identity__meta">Dabei seit {memberSince}</p>
        )}
      </div>

      {/* Progress stats */}
      <section className="profile-card">
        <h2 className="profile-card__heading">Fortschritt</h2>
        <div className="profile-stats">
          <div className="profile-stat">
            <span className="profile-stat__value">{totalAnswered}</span>
            <span className="profile-stat__label">Antworten</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat__value">{overallPct}%</span>
            <span className="profile-stat__label">Abgeschlossen</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat__value">{friendCount}</span>
            <span className="profile-stat__label">Freunde</span>
          </div>
          {daysSince > 0 && (
            <div className="profile-stat">
              <span className="profile-stat__value">{daysSince}</span>
              <span className="profile-stat__label">Tage dabei</span>
            </div>
          )}
        </div>
      </section>

      {/* Profil bearbeiten */}
      <section className="profile-card">
        <h2 className="profile-card__heading">Angaben</h2>
        <div className="profile-fields">
          <div className="profile-field-row">
            <label className="profile-field-label" htmlFor="profile-name">Name</label>
            <input
              id="profile-name"
              className="input-text profile-field-input"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="Dein Name…"
            />
          </div>
          <div className="profile-field-row profile-field-row--top-border">
            <label className="profile-field-label" htmlFor="profile-year">Geburtsjahr</label>
            <input
              id="profile-year"
              className="input-year profile-field-input"
              type="number"
              min={1900}
              max={new Date().getFullYear()}
              value={birthYear}
              onChange={e => setBirthYear(e.target.value)}
              placeholder="z. B. 1970"
            />
          </div>
        </div>
        <button
          className={`btn ${saved ? 'btn--success' : 'btn--primary'} profile-save-btn`}
          onClick={handleSave}
          disabled={!name.trim()}
        >
          {saved ? '✓ Gespeichert' : 'Speichern'}
        </button>
      </section>

      {/* Erscheinungsbild */}
      <section className="profile-card">
        <h2 className="profile-card__heading">Erscheinungsbild</h2>
        <div className="theme-cards">
          {THEMES.map(t => (
            <button
              key={t.id}
              type="button"
              className={`theme-card ${theme === t.id ? 'theme-card--active' : ''}`}
              onClick={() => setTheme(t.id)}
              aria-pressed={theme === t.id}
            >
              <span
                className="theme-card__dot"
                style={{ background: t.color }}
                aria-hidden="true"
              />
              <span className="theme-card__emoji">{t.emoji}</span>
              <span className="theme-card__label">{t.label}</span>
              {theme === t.id && <span className="theme-card__check" aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      </section>

      {/* Exportieren & Sichern */}
      <section className="profile-card">
        <h2 className="profile-card__heading">Exportieren & Sichern</h2>

        <p className="backup-desc">
          Exportiere deine Lebensgeschichte als lesbare Datei oder erstelle ein vollständiges Backup zum Wiederherstellen.
        </p>

        <div className="backup-export-row">
          <button className="btn btn--ghost backup-btn" onClick={onExportMarkdown}>
            <span className="backup-btn__icon">📄</span>
            <span className="backup-btn__label">Markdown</span>
            <span className="backup-btn__hint">für KI &amp; Texteditoren</span>
          </button>
          <button className="btn btn--ghost backup-btn" onClick={onExportJson}>
            <span className="backup-btn__icon">📊</span>
            <span className="backup-btn__label">JSON</span>
            <span className="backup-btn__hint">strukturierter Export</span>
          </button>
          <button className="btn btn--ghost backup-btn" onClick={onExportBackup}>
            <span className="backup-btn__icon">💾</span>
            <span className="backup-btn__label">Backup</span>
            <span className="backup-btn__hint">vollständig wiederherstellbar</span>
          </button>
        </div>

        <div className="backup-restore">
          <p className="backup-restore__label">Backup wiederherstellen</p>
          <p className="backup-restore__hint">
            Lade eine Backup-Datei (.json) um alle Daten auf diesem Gerät wiederherzustellen.
            Fotos sind nicht im Backup enthalten.
          </p>
          <button
            type="button"
            className="btn btn--outline backup-restore-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            📂 Backup-Datei laden…
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
          {importStatus && (
            <p className={`import-msg import-msg--${importStatus.ok ? 'success' : 'error'}`}>
              {importStatus.message}
            </p>
          )}
        </div>
      </section>

    </div>
  )
}

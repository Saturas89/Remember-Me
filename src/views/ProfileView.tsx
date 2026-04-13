import { useState, useRef } from 'react'
import { CATEGORIES } from '../data/categories'
import { THEMES, useTheme } from '../hooks/useTheme'
import { ArchiveExportCard } from '../components/ArchiveExportCard'
import { getLastBackupDate, backupAgeLabel, backupAgeStatus } from '../utils/backupStatus'
import { importFile } from '../utils/archiveImport'
import type { Profile, Answer } from '../types'
import type { ExportData } from '../utils/export'

interface Props {
  profile: Profile | null
  answers: Record<string, Answer>
  friendCount: number
  exportData: ExportData
  safeName: string
  onSave: (profile: Profile) => void
  onBack: () => void
  onExportMarkdown: () => void
  onExportJson: () => void
  onImportBackup: (json: string) => { ok: boolean; error?: string }
  onOpenImport: () => void
  onOpenFaq: () => void
}

function BackupStatusRow({ last }: { last: Date | null }) {
  const status = backupAgeStatus(last)
  const icon   = status === 'fresh' ? '✓' : '⚠'
  const age    = last ? backupAgeLabel(last) : ''
  const label  =
    status === 'fresh' ? `Erinnerungen gesichert – ${age}` :
    status === 'stale' ? `Erinnerungen sichern – zuletzt ${age}` :
    status === 'old'   ? `Erinnerungen sichern – zuletzt ${age}` :
                         'Erinnerungen noch nicht gesichert'

  return (
    <div className={`backup-status backup-status--${status}`}>
      <span className="backup-status__icon" aria-hidden="true">{icon}</span>
      <span className="backup-status__label">{label}</span>
    </div>
  )
}

export function ProfileView({
  profile, answers, friendCount,
  exportData, safeName,
  onSave, onBack,
  onExportMarkdown, onExportJson, onImportBackup,
  onOpenImport, onOpenFaq,
}: Props) {
  const { theme, setTheme } = useTheme()
  const [lastBackup, setLastBackup] = useState<Date | null>(() => getLastBackupDate())
  const [name, setName] = useState(profile?.name ?? '')
  const [birthYear, setBirthYear] = useState(
    profile?.birthYear ? String(profile.birthYear) : '',
  )
  const [saved, setSaved] = useState(false)
  const [importStatus, setImportStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const [importProgress, setImportProgress] = useState<{ step: string; pct: number } | null>(null)
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

    const isZip = file.name.toLowerCase().endsWith('.zip')
    const confirmed = window.confirm(
      isZip
        ? 'Dies stellt alle Erinnerungen – Texte, Fotos, Videos und Aufnahmen – aus dem Archiv wieder her und überschreibt alle aktuellen Daten. Fortfahren?'
        : 'Dies überschreibt alle aktuellen Daten mit dem Backup. Fortfahren?'
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
        ? `✓ Erinnerungen wiederhergestellt${mediaHint}.`
        : (restore.error ?? 'Import fehlgeschlagen.'),
    })
    if (restore.ok) setTimeout(() => setImportStatus(null), 5000)
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
        <BackupStatusRow last={lastBackup} />
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

      {/* Social-Media-Import */}
      <section className="profile-card">
        <h2 className="profile-card__heading">Importieren</h2>
        <button type="button" className="profile-import-card" onClick={onOpenImport}>
          <span className="profile-import-card__icon">📥</span>
          <span className="profile-import-card__body">
            <span className="profile-import-card__title">Social Media importieren</span>
            <span className="profile-import-card__desc">
              Fotos &amp; Erinnerungen von Instagram übernehmen
            </span>
          </span>
          <span className="profile-import-card__arrow">›</span>
        </button>
      </section>

      {/* Erinnerungs-Archiv – hero export action */}
      <section className="profile-card">
        <h2 className="profile-card__heading">Sichern & Teilen</h2>
        <ArchiveExportCard
          data={exportData}
          safeName={safeName}
          onBackupRecorded={() => setLastBackup(new Date())}
        />
      </section>

      {/* Weitere Exportformate */}
      <section className="profile-card">
        <h2 className="profile-card__heading">Weitere Formate</h2>
        <p className="backup-desc">
          Deine Geschichte als lesbarer Text oder für KI-Assistenten und Texteditoren.
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
        </div>

        <div className="backup-restore">
          <p className="backup-restore__label">Erinnerungen wiederherstellen</p>
          <p className="backup-restore__hint">
            Lade ein Erinnerungs-Archiv (.zip) oder eine Backup-Datei (.json).
            Das vollständige Archiv stellt auch Fotos, Videos und Aufnahmen wieder her.
          </p>
          <button
            type="button"
            className="btn btn--outline backup-restore-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={!!importProgress}
          >
            📂 Archiv oder Backup laden…
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,.json,application/zip,application/json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
          {importProgress && (
            <div className="import-progress">
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
            <p className={`import-msg import-msg--${importStatus.ok ? 'success' : 'error'}`}>
              {importStatus.message}
            </p>
          )}
        </div>
      </section>

      {/* Hilfe & FAQ */}
      <section className="profile-card">
        <button type="button" className="profile-import-card" onClick={onOpenFaq}>
          <span className="profile-import-card__icon">❓</span>
          <span className="profile-import-card__body">
            <span className="profile-import-card__title">Hilfe & FAQ</span>
            <span className="profile-import-card__desc">
              Datenschutz, Import, Export – häufige Fragen
            </span>
          </span>
          <span className="profile-import-card__arrow">›</span>
        </button>
      </section>

    </div>
  )
}

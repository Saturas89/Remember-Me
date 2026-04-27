import { useState, useRef } from 'react'
import { getCategoriesForLocale } from '../data/categories'
import { THEMES, useTheme } from '../hooks/useTheme'
import { ArchiveExportCard } from '../components/ArchiveExportCard'
import { getLastBackupDate, backupAgeLabel, backupAgeStatus } from '../utils/backupStatus'
import { importFile } from '../utils/archiveImport'
import { useTranslation } from '../locales'
import { useReminder } from '../hooks/useReminder'
import { useStreak } from '../hooks/useStreak'
import type { Locale } from '../locales'
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
  onShowReleaseNotes: () => void
}

function TreeProgressLogo({ pct, size = 80 }: { pct: number; size?: number }) {
  const THRESHOLDS = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90]
  const filledCount = THRESHOLDS.filter(thresh => pct >= thresh).length
  const { t } = useTranslation()

  return (
    <div
      className="tree-progress-logo"
      style={{ width: size, height: size }}
      aria-label={t.profile.progressAriaLabel.replace('{pct}', String(filledCount * 10))}
    >
      <div className="tree-progress-logo__bg" />
      <div
        className="tree-progress-logo__fill"
        style={{ height: `${filledCount * 10}%` }}
      />
    </div>
  )
}

function BackupStatusRow({ last }: { last: Date | null }) {
  const { t, locale } = useTranslation()
  const status = backupAgeStatus(last)
  const icon   = status === 'fresh' ? '✓' : '⚠'
  const age    = last ? backupAgeLabel(last, locale) : ''
  const label  =
    status === 'fresh' ? t.profile.backupFresh.replace('{age}', age) :
    status === 'stale' ? t.profile.backupStale.replace('{age}', age) :
    status === 'old'   ? t.profile.backupOld.replace('{age}', age) :
                         t.profile.backupNone

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
  onOpenImport, onOpenFaq, onShowReleaseNotes,
}: Props) {
  const { t, locale, setLocale } = useTranslation()
  const { theme, setTheme } = useTheme()
  const { requestPermission, disable, isEnabled } = useReminder()
  const { streak } = useStreak()
  const [lastBackup, setLastBackup] = useState<Date | null>(() => getLastBackupDate())
  const [name, setName] = useState(profile?.name ?? '')
  const [birthYear, setBirthYear] = useState(
    profile?.birthYear ? String(profile.birthYear) : '',
  )
  const [importStatus, setImportStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const [importProgress, setImportProgress] = useState<{ step: string; pct: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const categories = getCategoriesForLocale(locale)
  const totalQuestions = categories.reduce((s, c) => s + c.questions.length, 0)
  const totalAnswered = Object.values(answers).filter(
    a => a.value.trim() || (a.imageIds?.length ?? 0) > 0,
  ).length
  const overallPct = totalQuestions > 0 ? Math.round((totalAnswered / totalQuestions) * 100) : 0

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(locale === 'en' ? 'en-GB' : 'de-DE', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  const daysSince = profile?.createdAt
    ? Math.floor((Date.now() - new Date(profile.createdAt).getTime()) / 86_400_000)
    : 0

  function handleSave() {
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      birthYear: birthYear ? parseInt(birthYear, 10) : undefined,
      createdAt: profile?.createdAt ?? new Date().toISOString(),
    })
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const isZip = file.name.toLowerCase().endsWith('.zip')
    const confirmed = window.confirm(isZip ? t.profile.confirmZip : t.profile.confirmJson)
    if (!confirmed) {
      e.target.value = ''
      return
    }

    setImportProgress({ step: t.profile.preparing, pct: 0 })
    setImportStatus(null)

    const result = await importFile(file, (step, pct) => {
      setImportProgress({ step, pct })
    })

    setImportProgress(null)
    e.target.value = ''

    if (!result.ok) {
      setImportStatus({ ok: false, message: result.error ?? t.profile.importFailed })
      return
    }

    const restore = onImportBackup(result.jsonText!)
    const stats = result.stats
    const mediaHint = stats && (stats.photos + stats.audio + stats.videos) > 0
      ? ` (${[
          stats.photos > 0 ? `${stats.photos} ${stats.photos === 1 ? t.profile.photo : t.profile.photos}` : '',
          stats.videos > 0 ? `${stats.videos} ${stats.videos === 1 ? t.profile.video : t.profile.videos}` : '',
          stats.audio  > 0 ? `${stats.audio}  ${stats.audio  === 1 ? t.profile.recording : t.profile.recordings}` : '',
        ].filter(Boolean).join(', ')} ${t.profile.restored})`
      : ''

    setImportStatus({
      ok: restore.ok,
      message: restore.ok
        ? `${t.profile.restoreSuccess}${mediaHint}.`
        : (restore.error ?? t.profile.restoreFailed),
    })
    if (restore.ok) setTimeout(() => setImportStatus(null), 5000)
  }

  function handleReminderToggle() {
    if (isEnabled) {
      disable()
    } else {
      requestPermission()
    }
  }

  const hasNotificationApi = typeof window !== 'undefined' && typeof Notification !== 'undefined'
  const currentPermission = hasNotificationApi ? Notification.permission : 'default'
  const isIOS = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
  const supportsShowTrigger = hasNotificationApi && Notification.prototype != null && 'showTrigger' in Notification.prototype

  return (
    <div className="profile-view">
      <h1 className="sr-only">{t.profile.pageTitle}</h1>

      <div className="profile-topbar">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>
          {t.global.back}
        </button>
      </div>

      <div className="profile-identity">
        <TreeProgressLogo pct={overallPct} size={80} />
        <h1 className="profile-identity__name">{profile?.name}</h1>
        {memberSince && (
          <p className="profile-identity__meta">{t.profile.memberSince.replace('{date}', memberSince)}</p>
        )}
      </div>

      <section className="profile-card">
        <h2 className="profile-card__heading">{t.profile.progressHeading}</h2>
        <div className="profile-stats">
          <div className="profile-stat">
            <span className="profile-stat__value">{totalAnswered}</span>
            <span className="profile-stat__label">{t.profile.answersLabel}</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat__value">{overallPct}%</span>
            <span className="profile-stat__label">{t.profile.completedLabel}</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat__value">{friendCount}</span>
            <span className="profile-stat__label">{t.profile.friendsLabel}</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat__value">{daysSince}</span>
            <span className="profile-stat__label">{t.profile.daysLabel}</span>
          </div>
        </div>
        <BackupStatusRow last={lastBackup} />
      </section>

      <section className="profile-card">
        <h2 className="profile-card__heading">{t.profile.profileHeading}</h2>
        <div className="profile-fields">
          <div className="profile-field-row">
            <label className="profile-field-label" htmlFor="profile-name">{t.profile.nameLabel}</label>
            <input
              id="profile-name"
              className="input-text profile-field-input"
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={handleSave}
              onKeyDown={e => e.key === 'Enter' && (e.currentTarget.blur())}
              placeholder={t.profile.namePlaceholder}
            />
          </div>
          <div className="profile-field-row profile-field-row--top-border">
            <label className="profile-field-label" htmlFor="profile-year">{t.profile.yearLabel}</label>
            <input
              id="profile-year"
              className="input-year profile-field-input"
              type="number"
              min={1900}
              max={new Date().getFullYear()}
              value={birthYear}
              onChange={e => setBirthYear(e.target.value)}
              onBlur={handleSave}
              placeholder={t.profile.yearPlaceholder}
            />
          </div>
        </div>
      </section>

      <section className="profile-card" data-testid="reminder-settings">
        <h2 className="profile-card__heading">{t.reminder.settings.title}</h2>
        
        {currentPermission === 'denied' ? (
          <div className="reminder-settings-disabled">
            <p className="reminder-settings__hint">
              {t.reminder.settings.permissionDeniedHint}
            </p>
          </div>
        ) : isIOS && !supportsShowTrigger ? (
          <div className="reminder-settings-disabled">
            <p className="reminder-settings__hint">
              {t.reminder.settings.iosFallbackHint}
            </p>
          </div>
        ) : (
          <div className="reminder-settings">
            <div className="reminder-toggle">
              <input
                type="checkbox"
                id="reminder-checkbox"
                data-testid="reminder-toggle"
                checked={isEnabled}
                onChange={handleReminderToggle}
              />
              <label htmlFor="reminder-checkbox">
                {t.reminder.settings.toggleLabel}
              </label>
            </div>
            
            <p className="reminder-settings__cadence">
              {t.reminder.settings.cadenceExplanation}
            </p>
            
            <p className="reminder-settings__quiet-hours">
              {t.reminder.settings.quietHours}
            </p>
          </div>
        )}
        
        {streak && (
          <div className="streak-display">
            <h3 className="streak-display__heading">{t.reminder.settings.streakLabel}</h3>
            <div className="streak-stats">
              <div className="streak-stat">
                <span className="streak-stat__value">{streak.current}</span>
                <span className="streak-stat__label">{t.reminder.settings.streakCurrent}</span>
              </div>
              <div className="streak-stat">
                <span className="streak-stat__value">{streak.longest}</span>
                <span className="streak-stat__label">{t.reminder.settings.streakLongest}</span>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="profile-card">
        <h2 className="profile-card__heading">{t.profile.historyHeading}</h2>
        <ArchiveExportCard
          data={exportData}
          safeName={safeName}
          onBackupRecorded={() => setLastBackup(new Date())}
        />
      </section>

      <section className="profile-card">
        <h2 className="profile-card__heading">{t.profile.appearanceHeading}</h2>
        <div className="theme-cards">
          {THEMES.map(thm => (
            <button
              key={thm.id}
              type="button"
              className={`theme-card ${theme === thm.id ? 'theme-card--active' : ''}`}
              onClick={() => setTheme(thm.id)}
              aria-pressed={theme === thm.id}
            >
              <span
                className="theme-card__dot"
                style={{ background: thm.color }}
                aria-hidden="true"
              />
              <span className="theme-card__emoji">{thm.emoji}</span>
              <span className="theme-card__label">{t.themes[thm.id as keyof typeof t.themes]}</span>
              {theme === thm.id && <span className="theme-card__check" aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      </section>

      <section className="profile-card">
        <h2 className="profile-card__heading">{t.profile.langLabel}</h2>
        <div className="lang-cards">
          {(['de', 'en'] as Locale[]).map(l => (
            <button
              key={l}
              type="button"
              className={`lang-card ${locale === l ? 'lang-card--active' : ''}`}
              onClick={() => setLocale(l)}
              aria-pressed={locale === l}
            >
              <span className="lang-card__flag" aria-hidden="true">
                {l === 'de' ? '🇩🇪' : '🇬🇧'}
              </span>
              <span className="lang-card__label">
                {l === 'de' ? 'Deutsch' : 'English'}
              </span>
              {locale === l && <span className="lang-card__check" aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      </section>

      <section className="profile-card">
        <h2 className="profile-card__heading">{t.profile.importHeading}</h2>
        <button type="button" className="profile-import-card" onClick={onOpenImport}>
          <span className="profile-import-card__icon">📥</span>
          <span className="profile-import-card__body">
            <span className="profile-import-card__title">{t.profile.socialTitle}</span>
            <span className="profile-import-card__desc">{t.profile.socialDesc}</span>
          </span>
          <span className="profile-import-card__arrow">›</span>
        </button>
      </section>

      <section className="profile-card">
        <h2 className="profile-card__heading">{t.profile.formatsHeading}</h2>
        <p className="backup-desc">{t.profile.formatsDesc}</p>
        <div className="backup-export-row">
          <button className="btn btn--ghost backup-btn" onClick={onExportMarkdown}>
            <span className="backup-btn__icon">📄</span>
            <span className="backup-btn__label">Markdown</span>
            <span className="backup-btn__hint">{t.profile.markdownHint}</span>
          </button>
          <button className="btn btn--ghost backup-btn" onClick={onExportJson}>
            <span className="backup-btn__icon">📊</span>
            <span className="backup-btn__label">JSON</span>
            <span className="backup-btn__hint">{t.profile.jsonHint}</span>
          </button>
        </div>

        <div className="backup-restore">
          <p className="backup-restore__label">{t.profile.restoreLabel}</p>
          <p className="backup-restore__hint">{t.profile.restoreHint}</p>
          <button
            type="button"
            className="btn btn--outline backup-restore-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={!!importProgress}
          >
            {t.profile.restoreButton}
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

      <section className="profile-card">
        <button type="button" className="profile-import-card" onClick={onOpenFaq}>
          <span className="profile-import-card__icon">❓</span>
          <span className="profile-import-card__body">
            <span className="profile-import-card__title">{t.profile.faqTitle}</span>
            <span className="profile-import-card__desc">{t.profile.faqDesc}</span>
          </span>
          <span className="profile-import-card__arrow">›</span>
        </button>
        <button type="button" className="profile-import-card" onClick={onShowReleaseNotes}>
          <span className="profile-import-card__icon">🆕</span>
          <span className="profile-import-card__body">
            <span className="profile-import-card__title">{t.releaseNotes.title}</span>
            <span className="profile-import-card__desc">{t.releaseNotes.versionPrefix} 1.6.0</span>
          </span>
          <span className="profile-import-card__arrow">›</span>
        </button>
      </section>

    </div>
  )
}

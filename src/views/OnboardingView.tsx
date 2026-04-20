import { useState, useRef } from 'react'
import { HeroLogo } from '../components/Logo'
import { importFile } from '../utils/archiveImport'
import { useTranslation } from '../locales'
import type { Profile } from '../types'

interface Props {
  onComplete: (profile: Profile) => void
  onImportBackup: (json: string) => { ok: boolean; error?: string }
}

export function OnboardingView({ onComplete, onImportBackup }: Props) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importProgress, setImportProgress] = useState<{ step: string; pct: number } | null>(null)
  const [importStatus, setImportStatus] = useState<{ ok: boolean; message: string } | null>(null)

  const features = [
    { icon: '🔒', title: t.onboarding.featuresPrivateTitle, desc: t.onboarding.featuresPrivateDesc },
    { icon: '📴', title: t.onboarding.featuresOfflineTitle, desc: t.onboarding.featuresOfflineDesc },
    { icon: '❤️', title: t.onboarding.featuresForeverTitle, desc: t.onboarding.featuresForeverDesc },
  ]

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
    const confirmed = window.confirm(isZip ? t.onboarding.confirmZip : t.onboarding.confirmJson)
    if (!confirmed) {
      e.target.value = ''
      return
    }

    setImportProgress({ step: t.onboarding.preparing, pct: 0 })
    setImportStatus(null)

    const result = await importFile(file, (step, pct) => {
      setImportProgress({ step, pct })
    })

    setImportProgress(null)
    e.target.value = ''

    if (!result.ok) {
      setImportStatus({ ok: false, message: result.error ?? t.onboarding.importFailed })
      return
    }

    const restore = onImportBackup(result.jsonText!)
    const stats = result.stats
    const mediaHint = stats && (stats.photos + stats.audio + stats.videos) > 0
      ? ` (${[
          stats.photos > 0 ? `${stats.photos} ${stats.photos === 1 ? t.onboarding.photo : t.onboarding.photos}` : '',
          stats.videos > 0 ? `${stats.videos} ${stats.videos === 1 ? t.onboarding.video : t.onboarding.videos}` : '',
          stats.audio  > 0 ? `${stats.audio}  ${stats.audio  === 1 ? t.onboarding.recording : t.onboarding.recordings}` : '',
        ].filter(Boolean).join(', ')} ${t.onboarding.restored})`
      : ''

    setImportStatus({
      ok: restore.ok,
      message: restore.ok
        ? `${t.onboarding.importSuccess}${mediaHint}.`
        : (restore.error ?? t.onboarding.importFailed),
    })
  }

  return (
    <div className="onboarding">
      <div className="onboarding__hero">
        <HeroLogo />
        <p className="onboarding__tagline">
          {t.onboarding.tagline.split('\n').map((line, i) => (
            i === 0 ? <span key={i}>{line}<br /></span> : <span key={i}>{line}</span>
          ))}
        </p>
      </div>

      <div className="onboarding__story">
        <p>{t.onboarding.story1}</p>
        <p><strong>Remember Me</strong> {t.onboarding.story2}</p>
      </div>

      <div className="onboarding__features">
        {features.map((f, i) => (
          <div key={f.title} className="onboarding__feature" style={{ animationDelay: `${0.1 + i * 0.1}s` }}>
            <span className="onboarding__feature-icon">{f.icon}</span>
            <span className="onboarding__feature-title">{f.title}</span>
            <span className="onboarding__feature-desc">{f.desc}</span>
          </div>
        ))}
      </div>

      <div className="onboarding__divider" />

      <div className="onboarding__form">
        <label className="onboarding__label" htmlFor="onboarding-name">
          {t.onboarding.nameLabel}
        </label>
        <p className="onboarding__label-hint">{t.onboarding.nameLabelHint}</p>
        <input
          id="onboarding-name"
          className="input-text onboarding__input"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleStart()}
          placeholder={t.onboarding.namePlaceholder}
          autoFocus
          autoComplete="given-name"
        />
        <button
          className="btn btn--primary onboarding__cta"
          onClick={handleStart}
          disabled={!name.trim()}
        >
          {t.onboarding.startButton}
        </button>
      </div>

      <div className="onboarding__import">
        <div className="onboarding__divider" />
        <p className="onboarding__label-hint" style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
          {t.onboarding.alreadyUsed}
        </p>
        <button
          type="button"
          className="btn btn--outline onboarding__import-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={!!importProgress}
        >
          {t.onboarding.importButton}
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

      <p className="onboarding__footer">{t.onboarding.footer}</p>
    </div>
  )
}

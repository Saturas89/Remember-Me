import { useState } from 'react'
import { buildMemoryArchive, fmtBytes, type ArchiveStats } from '../utils/archiveExport'
import { recordBackup } from '../utils/backupStatus'
import { LogoIcon } from './Logo'
import { useTranslation } from '../locales'
import type { ExportData } from '../utils/export'

type Phase = 'idle' | 'building' | 'ready' | 'error'

interface Props {
  data:               ExportData
  safeName:           string
  onBackupRecorded?:  () => void
}

export function ArchiveExportCard({ data, safeName, onBackupRecorded }: Props) {
  const { t } = useTranslation()
  const [phase,    setPhase]    = useState<Phase>('idle')
  const [step,     setStep]     = useState('')
  const [pct,      setPct]      = useState(0)
  const [stats,    setStats]    = useState<ArchiveStats | null>(null)
  const [zipBlob,  setZipBlob]  = useState<Blob | null>(null)
  const [errMsg,   setErrMsg]   = useState('')

  const date     = new Date().toISOString().split('T')[0]
  const filename = `remember-me-${safeName}-archiv-${date}.zip`

  // ── Stats for idle display ──────────────────────────────
  const answerCount = Object.values(data.answers).filter(a => a.value.trim()).length
  const photoCount  = Object.values(data.answers).flatMap(a => a.imageIds ?? []).length
  const videoCount  = Object.values(data.answers).flatMap(a => a.videoIds ?? []).length
  const audioCount  = Object.values(data.answers).filter(a => a.audioId).length

  // ── Build ───────────────────────────────────────────────
  async function handleCreate() {
    setPhase('building')
    setPct(0)
    setStep(t.onboarding.preparing)
    try {
      const res = await buildMemoryArchive({
        data,
        onProgress: (s, p) => { setStep(s); setPct(p) },
      })
      setZipBlob(res.blob)
      setStats(res.stats)
      setPct(100)
      setPhase('ready')
    } catch {
      setErrMsg(t.archiveExport.error)
      setPhase('error')
    }
  }

  // ── Save locally ────────────────────────────────────────
  function handleSave() {
    if (!zipBlob) return
    recordBackup()
    onBackupRecorded?.()
    const url = URL.createObjectURL(zipBlob)
    const a   = document.createElement('a')
    a.href     = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  // ── Share via Web Share API (files) ─────────────────────
  async function handleShare() {
    if (!zipBlob) return
    const file = new File([zipBlob], filename, { type: 'application/zip' })
    try {
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: t.archiveExport.shareTitle,
          text:  t.archiveExport.shareText,
        })
        recordBackup()
        onBackupRecorded?.()
        return
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return  // user cancelled – no fallback
    }
    handleSave()  // fallback (also calls recordBackup)
  }

  const canShare = typeof navigator !== 'undefined' && 'share' in navigator

  // ── Render ──────────────────────────────────────────────

  if (phase === 'idle') {
    return (
      <div className="arc-outer">
        <div className="arc-card">
          <div className="arc-icon"><LogoIcon size={56} /></div>
          <h3 className="arc-title">{t.archiveExport.title}</h3>
          <p className="arc-desc">{t.archiveExport.desc}</p>
          {(answerCount + photoCount + videoCount + audioCount) > 0 && (
            <div className="arc-chips">
              {answerCount > 0 && <span className="arc-chip">📝 {t.archiveExport.answersChip.replace('{n}', String(answerCount))}</span>}
              {photoCount  > 0 && <span className="arc-chip">🖼 {t.archiveExport.photosChip.replace('{n}', String(photoCount))}</span>}
              {videoCount  > 0 && <span className="arc-chip">🎬 {t.archiveExport.videosChip.replace('{n}', String(videoCount))}</span>}
              {audioCount  > 0 && <span className="arc-chip">🎙 {t.archiveExport.recordingsChip.replace('{n}', String(audioCount))}</span>}
            </div>
          )}
          <button className="btn btn--primary arc-cta" onClick={handleCreate}>
            {t.archiveExport.saveButton}
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'building') {
    return (
      <div className="arc-outer">
        <div className="arc-card arc-card--building">
          <div className="arc-icon arc-icon--pulse">
            <LogoIcon size={56} />
          </div>
          <p className="arc-step">{step}</p>
          <div className="arc-progress">
            <div className="arc-progress__fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="arc-pct">{pct}%</p>
        </div>
      </div>
    )
  }

  if (phase === 'ready' && stats && zipBlob) {
    const fmt = (n: number, one: string, many: string) => n === 1 ? `${n} ${one}` : `${n} ${many}`
    const mediaLine = [
      stats.photoCount > 0 ? fmt(stats.photoCount, t.archiveExport.photo, t.archiveExport.photos) : '',
      stats.videoCount > 0 ? fmt(stats.videoCount, t.archiveExport.video, t.archiveExport.videos) : '',
      stats.audioCount > 0 ? fmt(stats.audioCount, t.archiveExport.recording, t.archiveExport.recordings) : '',
    ].filter(Boolean).join(' · ')

    return (
      <div className="arc-outer">
        <div className="arc-card arc-card--ready">
          <div className="arc-done-icon" aria-hidden="true">✓</div>
          <h3 className="arc-title">{t.archiveExport.saved}</h3>
          <p className="arc-desc arc-desc--subtle">
            {mediaLine && <span>{mediaLine} · </span>}
            {fmtBytes(stats.totalBytes)}
          </p>
          <div className="arc-actions">
            <button className="btn btn--primary arc-action-btn" onClick={handleSave}>
              {t.archiveExport.saveToDevice}
            </button>
            {canShare && (
              <button className="btn btn--outline arc-action-btn" onClick={handleShare}>
                {t.archiveExport.share}
              </button>
            )}
          </div>
          <button
            className="arc-reset"
            onClick={() => { setPhase('idle'); setZipBlob(null); setStats(null) }}
          >
            {t.archiveExport.saveAgain}
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="arc-outer">
        <div className="arc-card">
          <p className="arc-error">{errMsg}</p>
          <button className="btn btn--ghost" onClick={() => setPhase('idle')}>
            {t.archiveExport.retry}
          </button>
        </div>
      </div>
    )
  }

  return null
}

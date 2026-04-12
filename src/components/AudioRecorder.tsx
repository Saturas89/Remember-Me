import { useRef } from 'react'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { AudioPlayer } from './AudioPlayer'

interface Props {
  /** If set, shows the saved audio player + replace / delete actions */
  existingAudioId?: string
  /** Called when the user confirms a new recording. Save blob → return id. */
  onSave: (transcript: string, blob: Blob) => Promise<void>
  /** Called when the user deletes the existing audio */
  onRemove?: () => void
}

function fmtDur(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export function AudioRecorder({ existingAudioId, onSave, onRemove }: Props) {
  const rec          = useAudioRecorder()
  const savingRef    = useRef(false)

  async function handleConfirm() {
    if (!rec.previewBlob || savingRef.current) return
    savingRef.current = true
    try {
      await onSave(rec.transcript, rec.previewBlob)
      rec.reset()
    } finally {
      savingRef.current = false
    }
  }

  // ── Recording active ──────────────────────────────────────
  if (rec.state === 'recording') {
    return (
      <div className="audio-recorder audio-recorder--recording">
        <div className="audio-rec-indicator">
          <span className="audio-rec-dot" aria-hidden="true" />
          <span className="audio-rec-bars" aria-hidden="true">
            {Array.from({ length: 7 }).map((_, i) => (
              <span key={i} className="audio-rec-bar" style={{ animationDelay: `${i * 0.11}s` }} />
            ))}
          </span>
          <span className="audio-rec-time" aria-live="polite">{fmtDur(rec.duration)}</span>
        </div>
        {rec.transcript && (
          <p className="audio-rec-live-transcript" aria-live="polite">{rec.transcript}</p>
        )}
        <div className="audio-rec-actions">
          <button type="button" className="btn btn--primary btn--sm" onClick={rec.stop}>
            ⏹ Stop
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={rec.cancel}>
            ✕ Abbrechen
          </button>
        </div>
      </div>
    )
  }

  // ── Preview / confirm ─────────────────────────────────────
  if (rec.state === 'preview') {
    return (
      <div className="audio-recorder audio-recorder--preview">
        {rec.previewUrl && (
          <audio
            className="audio-rec-preview-audio"
            src={rec.previewUrl}
            controls
          />
        )}
        {rec.transcript ? (
          <div className="audio-rec-transcript">
            <p className="audio-rec-transcript__label">Transkription</p>
            <p className="audio-rec-transcript__text">{rec.transcript}</p>
          </div>
        ) : !rec.hasTranscription && (
          <p className="audio-rec-no-transcript">
            💡 Automatische Transkription ist in diesem Browser nicht verfügbar –
            du kannst den Text oben manuell eintippen.
          </p>
        )}
        <div className="audio-rec-actions">
          <button type="button" className="btn btn--primary btn--sm" onClick={handleConfirm}>
            ✓ Übernehmen
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={rec.reset}>
            ↺ Neu aufnehmen
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={rec.cancel}>
            ✕ Verwerfen
          </button>
        </div>
      </div>
    )
  }

  // ── Idle / requesting ─────────────────────────────────────
  return (
    <div className="audio-recorder audio-recorder--idle">
      {rec.error && <p className="audio-rec-error">{rec.error}</p>}

      {existingAudioId ? (
        <>
          <AudioPlayer audioId={existingAudioId} />
          <div className="audio-rec-existing-actions">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={rec.start}
              disabled={rec.state === 'requesting'}
            >
              🔄 Aufnahme ersetzen
            </button>
            {onRemove && (
              <button
                type="button"
                className="btn btn--ghost btn--sm audio-rec-delete"
                onClick={onRemove}
              >
                🗑 Löschen
              </button>
            )}
          </div>
        </>
      ) : (
        <button
          type="button"
          className="audio-rec-btn"
          onClick={rec.start}
          disabled={rec.state === 'requesting'}
        >
          {rec.state === 'requesting' ? '⏳ Warte auf Mikrofon…' : '🎙 Aufnehmen'}
        </button>
      )}
    </div>
  )
}

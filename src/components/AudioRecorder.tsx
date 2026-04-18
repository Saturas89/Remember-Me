import { useRef, useState } from 'react'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { AudioPlayer } from './AudioPlayer'

interface Props {
  /** If set, shows the saved audio player + replace / delete actions */
  existingAudioId?: string
  /** Current text value of the answer – used to detect transcript conflict on re-recording */
  existingValue?: string
  /** Called when the user confirms a new recording.
   *  blob is null when the user chose not to save the audio file (transcript-only mode).
   *  replaceText indicates whether the transcript should overwrite the existing text field. */
  onSave: (transcript: string, blob: Blob | null, replaceText: boolean) => Promise<void>
  /** Called when the user deletes the existing audio */
  onRemove?: () => void
}

function fmtDur(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export function AudioRecorder({ existingAudioId, existingValue, onSave, onRemove }: Props) {
  const rec          = useAudioRecorder()
  const savingRef    = useRef(false)
  const [saveAudioFile, setSaveAudioFile] = useState(false)
  const [textChoice, setTextChoice] = useState<'new' | 'keep'>('new')

  const hasTextConflict = !!(existingValue?.trim()) && !!rec.transcript.trim()
    && existingValue!.trim() !== rec.transcript.trim()

  async function handleConfirm() {
    if (!rec.previewBlob || savingRef.current) return
    savingRef.current = true
    try {
      const replaceText = !hasTextConflict || textChoice === 'new'
      await onSave(rec.transcript, saveAudioFile ? rec.previewBlob : null, replaceText)
      rec.reset()
      setTextChoice('new')
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
        {hasTextConflict && (
          <div className="audio-text-choice">
            <p className="audio-text-choice__label">Welchen Text übernehmen?</p>
            <div className="audio-text-choice__options">
              <button
                type="button"
                className={`audio-text-choice__btn${textChoice === 'new' ? ' audio-text-choice__btn--selected' : ''}`}
                onClick={() => setTextChoice('new')}
              >
                <span>🆕 Neue Transkription</span>
                <span className="audio-text-choice__preview">{rec.transcript.length > 60 ? `${rec.transcript.substring(0, 60)}…` : rec.transcript}</span>
              </button>
              <button
                type="button"
                className={`audio-text-choice__btn${textChoice === 'keep' ? ' audio-text-choice__btn--selected' : ''}`}
                onClick={() => setTextChoice('keep')}
              >
                <span>💾 Bisherigen Text behalten</span>
                <span className="audio-text-choice__preview">{existingValue!.length > 60 ? `${existingValue!.substring(0, 60)}…` : existingValue}</span>
              </button>
            </div>
          </div>
        )}
        <label className="audio-rec-save-toggle">
          <input
            type="checkbox"
            checked={saveAudioFile}
            onChange={e => setSaveAudioFile(e.target.checked)}
          />
          <span>🗂 Aufnahme als Audio-Datei speichern</span>
        </label>
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

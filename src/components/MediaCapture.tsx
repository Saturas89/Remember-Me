import { useRef } from 'react'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { ImageAttachment } from './ImageAttachment'
import { VideoAttachment } from './VideoAttachment'
import { AudioPlayer } from './AudioPlayer'

const MAX_IMAGES = 5
const MAX_VIDEOS = 3

function fmtDur(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

interface Props {
  imageIds: string[]
  imageCache: Record<string, string>
  videoIds: string[]
  audioId?: string
  onLoadImages: (ids: string[]) => void
  onAddImage: (file: File) => void
  onRemoveImage: (id: string) => void
  onAddVideo: (file: File) => void
  onRemoveVideo: (id: string) => void
  onSaveAudio: (transcript: string, blob: Blob) => Promise<void>
  onRemoveAudio: () => void
}

export function MediaCapture({
  imageIds, imageCache, videoIds, audioId,
  onLoadImages, onAddImage, onRemoveImage,
  onAddVideo, onRemoveVideo,
  onSaveAudio, onRemoveAudio,
}: Props) {
  const photoTrigger = useRef<HTMLInputElement>(null)
  const videoTrigger = useRef<HTMLInputElement>(null)
  const rec = useAudioRecorder()
  const savingRef = useRef(false)

  async function handleAudioConfirm() {
    if (!rec.previewBlob || savingRef.current) return
    savingRef.current = true
    try {
      await onSaveAudio(rec.transcript, rec.previewBlob)
      rec.reset()
    } finally {
      savingRef.current = false
    }
  }

  const isAudioActive = rec.state !== 'idle'
  const hasAudio = !!audioId || isAudioActive
  const hasAnyMedia = imageIds.length > 0 || videoIds.length > 0 || hasAudio

  return (
    <div className="media-capture">
      {/* Hint – visible only before any media is attached */}
      {!hasAnyMedia && (
        <p className="media-capture__hint">
          Damit dieser Moment nie verblasst – ergänze ihn mit Fotos, einem Video oder erzähl ihn mit deiner eigenen Stimme.
        </p>
      )}

      {/* Thumbnail strip – shown when content exists; components always rendered so triggerRefs stay in DOM */}
      <div className={imageIds.length > 0 || videoIds.length > 0 ? 'media-capture__strip' : undefined}>
        <ImageAttachment
          imageIds={imageIds}
          cache={imageCache}
          onLoad={onLoadImages}
          onAdd={onAddImage}
          onRemove={onRemoveImage}
          triggerRef={photoTrigger}
          noAddButton
        />
        <VideoAttachment
          videoIds={videoIds}
          onAdd={onAddVideo}
          onRemove={onRemoveVideo}
          triggerRef={videoTrigger}
          noAddButton
        />
      </div>

      {/* ── Audio panel ─────────────────────────────────────── */}

      {rec.error && (
        <p className="audio-rec-error">{rec.error}</p>
      )}

      {rec.state === 'requesting' && (
        <div className="audio-panel audio-panel--requesting">
          <span className="audio-panel__spinner" aria-hidden="true" />
          <span>Warte auf Mikrofon…</span>
        </div>
      )}

      {rec.state === 'recording' && (
        <div className="audio-panel audio-panel--recording">
          <div className="audio-panel__row">
            <span className="audio-rec-dot" aria-hidden="true" />
            <span className="audio-rec-bars" aria-hidden="true">
              {Array.from({ length: 7 }).map((_, i) => (
                <span key={i} className="audio-rec-bar" style={{ animationDelay: `${i * 0.11}s` }} />
              ))}
            </span>
            <span className="audio-rec-time" aria-live="polite">{fmtDur(rec.duration)}</span>
            <div className="audio-panel__actions">
              <button type="button" className="btn btn--primary btn--sm" onClick={rec.stop}>
                ⏹ Stopp
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={rec.cancel} aria-label="Abbrechen">
                ✕
              </button>
            </div>
          </div>
          {rec.transcript && (
            <p className="audio-rec-live-transcript" aria-live="polite">{rec.transcript}</p>
          )}
        </div>
      )}

      {rec.state === 'preview' && (
        <div className="audio-panel audio-panel--preview">
          {rec.previewUrl && (
            <audio src={rec.previewUrl} controls className="audio-rec-preview-audio" />
          )}
          {rec.transcript ? (
            <div className="audio-rec-transcript">
              <p className="audio-rec-transcript__label">Transkription</p>
              <p className="audio-rec-transcript__text">{rec.transcript}</p>
            </div>
          ) : !rec.hasTranscription && (
            <p className="audio-rec-no-transcript">
              💡 Keine automatische Transkription verfügbar – du kannst den Text oben manuell eintippen.
            </p>
          )}
          <div className="audio-rec-actions">
            <button type="button" className="btn btn--primary btn--sm" onClick={handleAudioConfirm}>
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
      )}

      {rec.state === 'idle' && audioId && (
        <div className="audio-panel audio-panel--existing">
          <AudioPlayer audioId={audioId} />
          <div className="audio-rec-existing-actions">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={rec.start}
            >
              🔄 Ersetzen
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm audio-rec-delete"
              onClick={onRemoveAudio}
            >
              🗑 Löschen
            </button>
          </div>
        </div>
      )}

      {/* ── Unified media toolbar ───────────────────────────── */}
      <div className="media-toolbar" role="group" aria-label="Medien hinzufügen">
        {/* Photo */}
        <button
          type="button"
          className={`media-toolbar__btn${imageIds.length > 0 ? ' media-toolbar__btn--has' : ''}`}
          onClick={() => photoTrigger.current?.click()}
          disabled={imageIds.length >= MAX_IMAGES}
          title={imageIds.length >= MAX_IMAGES ? 'Maximum erreicht (5)' : 'Foto hinzufügen'}
          aria-label={`Foto hinzufügen${imageIds.length > 0 ? `, ${imageIds.length} vorhanden` : ''}`}
        >
          <span className="media-toolbar__icon" aria-hidden="true">📷</span>
          <span className="media-toolbar__label">Foto</span>
          {imageIds.length > 0 && (
            <span className="media-toolbar__badge" aria-hidden="true">{imageIds.length}</span>
          )}
        </button>

        {/* Video */}
        <button
          type="button"
          className={`media-toolbar__btn${videoIds.length > 0 ? ' media-toolbar__btn--has' : ''}`}
          onClick={() => videoTrigger.current?.click()}
          disabled={videoIds.length >= MAX_VIDEOS}
          title={videoIds.length >= MAX_VIDEOS ? 'Maximum erreicht (3)' : 'Video hinzufügen'}
          aria-label={`Video hinzufügen${videoIds.length > 0 ? `, ${videoIds.length} vorhanden` : ''}`}
        >
          <span className="media-toolbar__icon" aria-hidden="true">🎬</span>
          <span className="media-toolbar__label">Video</span>
          {videoIds.length > 0 && (
            <span className="media-toolbar__badge" aria-hidden="true">{videoIds.length}</span>
          )}
        </button>

        {/* Audio */}
        <button
          type="button"
          className={[
            'media-toolbar__btn',
            hasAudio ? 'media-toolbar__btn--has' : '',
            rec.state === 'recording' ? 'media-toolbar__btn--recording' : '',
          ].filter(Boolean).join(' ')}
          onClick={() => { if (rec.state === 'idle' && !audioId) rec.start() }}
          disabled={rec.state === 'requesting' || rec.state === 'recording' || rec.state === 'preview' || !!audioId}
          title={audioId ? 'Aufnahme vorhanden' : 'Sprachaufnahme starten'}
          aria-label={audioId ? 'Sprachaufnahme vorhanden' : 'Sprachaufnahme starten'}
        >
          <span className="media-toolbar__icon" aria-hidden="true">
            {rec.state === 'recording' ? '🔴' : '🎙'}
          </span>
          <span className="media-toolbar__label">
            {rec.state === 'requesting' ? 'Warte…' : 'Aufnahme'}
          </span>
          {hasAudio && rec.state === 'idle' && (
            <span className="media-toolbar__badge" aria-hidden="true">✓</span>
          )}
        </button>
      </div>
    </div>
  )
}

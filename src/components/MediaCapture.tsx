import { useRef, useState } from 'react'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { ImageAttachment } from './ImageAttachment'
import { VideoAttachment } from './VideoAttachment'
import { AudioPlayer } from './AudioPlayer'
import { useTranslation } from '../locales'

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
  currentValue?: string
  onLoadImages: (ids: string[]) => void
  onAddImage: (file: File) => void
  onRemoveImage: (id: string) => void
  onAddVideo: (file: File) => void
  onRemoveVideo: (id: string) => void
  onSaveAudio: (transcript: string, blob: Blob | null, replaceText: boolean) => Promise<void>
  onRemoveAudio: () => void
}

export function MediaCapture({
  imageIds, imageCache, videoIds, audioId,
  currentValue,
  onLoadImages, onAddImage, onRemoveImage,
  onAddVideo, onRemoveVideo,
  onSaveAudio, onRemoveAudio,
}: Props) {
  const { t } = useTranslation()
  const m = t.media
  const photoTrigger = useRef<HTMLInputElement>(null)
  const videoTrigger = useRef<HTMLInputElement>(null)
  const rec = useAudioRecorder()
  const savingRef = useRef(false)
  const [saveAudioFile, setSaveAudioFile] = useState(false)
  const [textChoice, setTextChoice] = useState<'new' | 'keep'>('new')

  const hasTextConflict = !!(currentValue?.trim()) && !!rec.transcript.trim()
    && currentValue!.trim() !== rec.transcript.trim()

  async function handleAudioConfirm() {
    if (!rec.previewBlob || savingRef.current) return
    savingRef.current = true
    try {
      const replaceText = !hasTextConflict || textChoice === 'new'
      await onSaveAudio(rec.transcript, saveAudioFile ? rec.previewBlob : null, replaceText)
      rec.reset()
      setTextChoice('new')
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
        <p className="media-capture__hint">{m.introHint}</p>
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
          <span>{m.waitingMicrophone}</span>
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
                {m.stopRecording}
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={rec.cancel} aria-label={m.cancelRecordingAria}>
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
              <p className="audio-rec-transcript__label">{m.transcriptionLabel}</p>
              <p className="audio-rec-transcript__text">{rec.transcript}</p>
            </div>
          ) : !rec.hasTranscription && (
            <p className="audio-rec-no-transcript">{m.noTranscriptionHint}</p>
          )}
          {hasTextConflict && (
            <div className="audio-text-choice">
              <p className="audio-text-choice__label">{m.whichTextLabel}</p>
              <div className="audio-text-choice__options">
                <button
                  type="button"
                  className={`audio-text-choice__btn${textChoice === 'new' ? ' audio-text-choice__btn--selected' : ''}`}
                  onClick={() => setTextChoice('new')}
                >
                  <span>{m.chooseNewTranscription}</span>
                  <span className="audio-text-choice__preview">{rec.transcript.length > 60 ? `${rec.transcript.substring(0, 60)}…` : rec.transcript}</span>
                </button>
                <button
                  type="button"
                  className={`audio-text-choice__btn${textChoice === 'keep' ? ' audio-text-choice__btn--selected' : ''}`}
                  onClick={() => setTextChoice('keep')}
                >
                  <span>{m.chooseKeepText}</span>
                  <span className="audio-text-choice__preview">{currentValue!.length > 60 ? `${currentValue!.substring(0, 60)}…` : currentValue}</span>
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
            <span>{m.saveAudioFileLabel}</span>
          </label>
          <div className="audio-rec-actions">
            <button type="button" className="btn btn--primary btn--sm" onClick={handleAudioConfirm}>
              {m.confirmAccept}
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={rec.reset}>
              {m.retryRecord}
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={rec.cancel}>
              {m.discardRecord}
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
              {m.replaceRecording}
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm audio-rec-delete"
              onClick={onRemoveAudio}
            >
              {m.deleteRecording}
            </button>
          </div>
        </div>
      )}

      {/* ── Unified media toolbar ───────────────────────────── */}
      <div className="media-toolbar" role="group" aria-label={m.toolbarAriaLabel}>
        {/* Photo */}
        <button
          type="button"
          className={`media-toolbar__btn${imageIds.length > 0 ? ' media-toolbar__btn--has' : ''}`}
          onClick={() => photoTrigger.current?.click()}
          disabled={imageIds.length >= MAX_IMAGES}
          title={imageIds.length >= MAX_IMAGES ? m.photoTooltipMax : m.photoTooltipAdd}
          aria-label={`${m.photoAriaAdd}${imageIds.length > 0 ? `, ${m.photoAriaCount.replace('{n}', String(imageIds.length))}` : ''}`}
        >
          <span className="media-toolbar__icon" aria-hidden="true">📷</span>
          <span className="media-toolbar__label">{m.photoLabel}</span>
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
          title={videoIds.length >= MAX_VIDEOS ? m.videoTooltipMax : m.videoTooltipAdd}
          aria-label={`${m.videoAriaAdd}${videoIds.length > 0 ? `, ${m.videoAriaCount.replace('{n}', String(videoIds.length))}` : ''}`}
        >
          <span className="media-toolbar__icon" aria-hidden="true">🎬</span>
          <span className="media-toolbar__label">{m.videoLabel}</span>
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
          title={audioId ? m.audioExistingTitle : m.audioStartTitle}
          aria-label={audioId ? m.audioExistingAria : m.audioStartAria}
        >
          <span className="media-toolbar__icon" aria-hidden="true">
            {rec.state === 'recording' ? '🔴' : '🎙'}
          </span>
          <span className="media-toolbar__label">
            {rec.state === 'requesting' ? m.audioWaitLabel : m.audioLabel}
          </span>
          {hasAudio && rec.state === 'idle' && (
            <span className="media-toolbar__badge" aria-hidden="true">✓</span>
          )}
        </button>
      </div>
    </div>
  )
}

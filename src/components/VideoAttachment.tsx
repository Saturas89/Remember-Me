import { useState, useEffect, useRef } from 'react'
import { getVideoBlob } from '../hooks/useVideoStore'
import { useTranslation } from '../locales'

const MAX_VIDEOS = 3

// ── Single thumbnail that loads its own blob URL ──────────────
function VideoThumb({
  id,
  onRemove,
  onPlay,
  readOnly,
}: {
  id: string
  onRemove?: () => void
  onPlay: () => void
  readOnly?: boolean
}) {
  const { t } = useTranslation()
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)

  useEffect(() => {
    let url: string | null = null
    getVideoBlob(id).then(blob => {
      if (blob) {
        url = URL.createObjectURL(blob)
        setThumbUrl(url)
      }
    })
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [id])

  return (
    <div className="video-thumb">
      {thumbUrl
        ? <video src={thumbUrl} className="video-thumb__preview" preload="metadata" muted playsInline />
        : <div className="video-thumb__skeleton" />
      }
      <button
        type="button"
        className="video-thumb__play"
        onClick={onPlay}
        aria-label={t.media.videoPlayAria}
      >
        ▶
      </button>
      {!readOnly && onRemove && (
        <button
          type="button"
          className="video-thumb__remove"
          onClick={onRemove}
          aria-label={t.media.videoRemoveAria}
        >
          ✕
        </button>
      )}
    </div>
  )
}

// ── Lightbox – creates its own fresh object URL ───────────────
function VideoLightbox({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation()
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let u: string | null = null
    getVideoBlob(id).then(blob => {
      if (blob) {
        u = URL.createObjectURL(blob)
        setUrl(u)
      }
    })
    return () => { if (u) URL.revokeObjectURL(u) }
  }, [id])

  return (
    <div className="video-lightbox" onClick={onClose}>
      <button
        type="button"
        className="video-lightbox__close"
        onClick={onClose}
        aria-label={t.media.videoLightboxCloseAria}
      >
        ✕
      </button>
      {url && (
        <video
          src={url}
          className="video-lightbox__video"
          controls
          autoPlay
          playsInline
          onClick={e => e.stopPropagation()}
        />
      )}
    </div>
  )
}

// ── Public component ──────────────────────────────────────────
interface Props {
  videoIds: string[]
  readOnly?: boolean
  onAdd?: (file: File) => void
  onRemove?: (id: string) => void
  /** Expose the hidden file input to a parent-controlled ref */
  triggerRef?: React.RefObject<HTMLInputElement | null>
  /** Suppress the built-in add button (parent toolbar handles triggering) */
  noAddButton?: boolean
}

export function VideoAttachment({ videoIds, readOnly = false, onAdd, onRemove, triggerRef, noAddButton }: Props) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)

  // Expose internal file input to parent toolbar
  useEffect(() => {
    if (triggerRef) {
      (triggerRef as React.MutableRefObject<HTMLInputElement | null>).current = inputRef.current
    }
  })
  const [playingId, setPlayingId] = useState<string | null>(null)

  function handleFiles(files: FileList | null) {
    if (!files || !onAdd) return
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('video/')) continue
      onAdd(file)
    }
  }

  if (videoIds.length === 0 && readOnly) return null

  return (
    <div className="video-attachment">
      {videoIds.length > 0 && (
        <div className="video-attachment__strip">
          {videoIds.map(id => (
            <VideoThumb
              key={id}
              id={id}
              readOnly={readOnly}
              onPlay={() => setPlayingId(id)}
              onRemove={onRemove ? () => onRemove(id) : undefined}
            />
          ))}
        </div>
      )}

      {!readOnly && videoIds.length < MAX_VIDEOS && (
        <>
          {!noAddButton && (
            <button
              type="button"
              className="video-attachment__add"
              onClick={() => inputRef.current?.click()}
            >
              {t.media.videoAddButton}
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            style={{ display: 'none' }}
            onChange={e => { handleFiles(e.target.files); e.target.value = '' }}
          />
        </>
      )}

      {playingId && (
        <VideoLightbox id={playingId} onClose={() => setPlayingId(null)} />
      )}
    </div>
  )
}

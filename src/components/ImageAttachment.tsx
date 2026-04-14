import { useState, useRef, useEffect } from 'react'

const MAX_IMAGES = 5

interface Props {
  imageIds: string[]
  cache: Record<string, string>
  onLoad: (ids: string[]) => void
  onAdd?: (file: File) => void
  onRemove?: (id: string) => void
  /** Expose the hidden file input to a parent-controlled ref */
  triggerRef?: React.RefObject<HTMLInputElement | null>
  /** Suppress the built-in add button (parent toolbar handles triggering) */
  noAddButton?: boolean
}

export function ImageAttachment({ imageIds, cache, onLoad, onAdd, onRemove, triggerRef, noAddButton }: Props) {
  const [lightbox, setLightbox] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // stable join string to avoid re-running effect on every render
  const idsKey = imageIds.join(',')

  useEffect(() => {
    if (imageIds.length > 0) onLoad(imageIds)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  // Expose internal file input to parent toolbar
  useEffect(() => {
    if (triggerRef) {
      (triggerRef as React.MutableRefObject<HTMLInputElement | null>).current = fileRef.current
    }
  })

  if (imageIds.length === 0 && !onAdd) return null

  return (
    <>
      <div className="img-strip">
        {imageIds.map(id => (
          <div
            key={id}
            className="img-thumb"
            onClick={() => cache[id] && setLightbox(cache[id])}
            role="button"
            tabIndex={0}
            aria-label="Bild vergrößern"
            onKeyDown={e => e.key === 'Enter' && cache[id] && setLightbox(cache[id])}
          >
            {cache[id] ? (
              <img src={cache[id]} alt="" className="img-thumb__img" />
            ) : (
              <div className="img-thumb__skeleton" aria-label="Bild wird geladen" />
            )}
            {onRemove && (
              <button
                type="button"
                className="img-thumb__del"
                onClick={e => { e.stopPropagation(); onRemove(id) }}
                aria-label="Bild entfernen"
              >
                ✕
              </button>
            )}
          </div>
        ))}

        {onAdd && imageIds.length < MAX_IMAGES && !noAddButton && (
          <button
            type="button"
            className="img-add-btn"
            onClick={() => fileRef.current?.click()}
            aria-label="Foto hinzufügen"
          >
            <span>📷</span>
            <span className="img-add-btn__label">Foto</span>
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={e => {
            const file = e.target.files?.[0]
            if (file && onAdd) onAdd(file)
            e.target.value = ''
          }}
        />
      </div>

      {lightbox && (
        <div
          className="img-lightbox"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Bild in voller Größe"
        >
          <img src={lightbox} alt="" />
          <button className="img-lightbox__close" aria-label="Schließen">✕</button>
        </div>
      )}
    </>
  )
}

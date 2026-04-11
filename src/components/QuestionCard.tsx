import { useState, useEffect } from 'react'
import { ImageAttachment } from './ImageAttachment'
import type { Question } from '../types'

interface Props {
  question: Question
  initialValue: string
  imageIds: string[]
  imageCache: Record<string, string>
  index: number
  total: number
  onSave: (value: string) => void
  onLoadImages: (ids: string[]) => void
  onAddImage: (file: File) => void
  onRemoveImage: (id: string) => void
  onNext: () => void
  onPrev: () => void
  canGoBack: boolean
}

export function QuestionCard({
  question, initialValue, imageIds, imageCache,
  index, total, onSave, onLoadImages, onAddImage, onRemoveImage,
  onNext, onPrev, canGoBack,
}: Props) {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    setValue(initialValue)
  }, [question.id, initialValue])

  function handleChange(next: string) {
    setValue(next)
    onSave(next)
  }

  const hasAnswer =
    question.type === 'text'
      ? value.trim() !== '' || imageIds.length > 0
      : value !== ''

  return (
    <div className="question-card">
      <div className="question-card__meta">
        Frage {index + 1} von {total}
      </div>

      <h2 className="question-card__text">{question.text}</h2>

      {question.helpText && (
        <p className="question-card__help">{question.helpText}</p>
      )}

      <div className="question-card__input">
        {question.type === 'text' && (
          <>
            <textarea
              className="input-textarea"
              value={value}
              onChange={e => handleChange(e.target.value)}
              placeholder="Deine Antwort..."
              rows={5}
            />
            <ImageAttachment
              imageIds={imageIds}
              cache={imageCache}
              onLoad={onLoadImages}
              onAdd={onAddImage}
              onRemove={onRemoveImage}
            />
          </>
        )}

        {question.type === 'choice' && question.options && (
          <div className="choice-group">
            {question.options.map(opt => (
              <button
                key={opt}
                className={`choice-btn ${value === opt ? 'choice-btn--selected' : ''}`}
                onClick={() => handleChange(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {question.type === 'scale' && (
          <div className="scale-group">
            <span className="scale-label">{question.scaleMin}</span>
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                className={`scale-btn ${value === String(n) ? 'scale-btn--selected' : ''}`}
                onClick={() => handleChange(String(n))}
              >
                {n}
              </button>
            ))}
            <span className="scale-label">{question.scaleMax}</span>
          </div>
        )}

        {question.type === 'year' && (
          <input
            type="number"
            className="input-year"
            value={value}
            onChange={e => handleChange(e.target.value)}
            placeholder="z.B. 1985"
            min={1900}
            max={2100}
          />
        )}
      </div>

      <div className="question-card__nav">
        <button className="btn btn--ghost" onClick={onPrev} disabled={!canGoBack}>
          ← Zurück
        </button>
        <button className="btn btn--primary" onClick={onNext}>
          {index + 1 < total ? 'Weiter →' : 'Fertig ✓'}
        </button>
      </div>

      {!hasAnswer && (
        <button type="button" className="question-card__skip" onClick={onNext}>
          Frage überspringen
        </button>
      )}
    </div>
  )
}

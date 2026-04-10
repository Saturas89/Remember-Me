import { useState, useEffect } from 'react'
import type { Question } from '../types'

interface Props {
  question: Question
  initialValue: string
  index: number
  total: number
  onSave: (value: string) => void
  onNext: () => void
  onPrev: () => void
  canGoBack: boolean
}

export function QuestionCard({ question, initialValue, index, total, onSave, onNext, onPrev, canGoBack }: Props) {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    setValue(initialValue)
  }, [question.id, initialValue])

  function handleChange(next: string) {
    setValue(next)
    onSave(next)
  }

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
          <textarea
            className="input-textarea"
            value={value}
            onChange={e => handleChange(e.target.value)}
            placeholder="Deine Antwort..."
            rows={5}
          />
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
    </div>
  )
}

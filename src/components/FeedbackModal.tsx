import { useState } from 'react'
import { useTranslation } from '../locales'
import { submitFeedback, markFeedbackSubmitted } from '../utils/feedbackSubmit'

interface Props {
  onClose: () => void
}

type Status = 'idle' | 'sending' | 'thanks' | 'error-config' | 'error-network'

const SMILEYS: ReadonlyArray<{ rating: number; emoji: string; labelKey: 'r1' | 'r2' | 'r3' | 'r4' | 'r5' }> = [
  { rating: 1, emoji: '😞', labelKey: 'r1' },
  { rating: 2, emoji: '😐', labelKey: 'r2' },
  { rating: 3, emoji: '🙂', labelKey: 'r3' },
  { rating: 4, emoji: '😊', labelKey: 'r4' },
  { rating: 5, emoji: '🤩', labelKey: 'r5' },
]

const MAX_COMMENT = 500

export function FeedbackModal({ onClose }: Props) {
  const { t } = useTranslation()
  const [rating, setRating] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [status, setStatus] = useState<Status>('idle')

  async function handleSubmit() {
    if (rating === null) return
    setStatus('sending')
    const res = await submitFeedback({ rating, comment })
    if (res.ok) {
      markFeedbackSubmitted()
      setStatus('thanks')
      setTimeout(onClose, 1500)
      return
    }
    setStatus(res.reason === 'not-configured' ? 'error-config' : 'error-network')
  }

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-modal-title"
    >
      <div className="modal-box feedback-modal">
        <h3 id="feedback-modal-title" className="modal-box__title">
          {t.feedback.modalTitle}
        </h3>

        {status === 'thanks' ? (
          <p className="modal-box__body feedback-thanks">{t.feedback.thanks}</p>
        ) : (
          <>
            <p className="modal-box__body feedback-subtitle">{t.feedback.subtitle}</p>

            <div
              className="feedback-smileys"
              role="radiogroup"
              aria-label={t.feedback.smileyGroupLabel}
            >
              {SMILEYS.map(s => {
                const active = rating === s.rating
                return (
                  <button
                    key={s.rating}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={t.feedback[s.labelKey]}
                    className={`feedback-smiley${active ? ' feedback-smiley--active' : ''}`}
                    onClick={() => setRating(s.rating)}
                    disabled={status === 'sending'}
                  >
                    <span aria-hidden="true">{s.emoji}</span>
                  </button>
                )
              })}
            </div>

            {rating !== null && (
              <div className="feedback-comment-wrap">
                <label className="input-label" htmlFor="feedback-comment">
                  {t.feedback.commentLabel}
                </label>
                <textarea
                  id="feedback-comment"
                  className="input-textarea"
                  value={comment}
                  onChange={e => setComment(e.target.value.slice(0, MAX_COMMENT))}
                  placeholder={t.feedback.commentPlaceholder}
                  rows={3}
                  maxLength={MAX_COMMENT}
                  disabled={status === 'sending'}
                />
                <p className="feedback-comment-counter" aria-live="polite">
                  {comment.length}/{MAX_COMMENT}
                </p>
              </div>
            )}

            <p className="friends-hint feedback-privacy">{t.feedback.privacy}</p>

            {status === 'error-config' && (
              <p className="friends-hint friends-hint--warn">{t.feedback.errorNoConnection}</p>
            )}
            {status === 'error-network' && (
              <p className="friends-hint friends-hint--warn">{t.feedback.errorNetwork}</p>
            )}

            <div className="modal-box__actions">
              <button
                type="button"
                className="share-cta-btn"
                onClick={handleSubmit}
                disabled={rating === null || status === 'sending'}
              >
                {status === 'sending' ? t.feedback.sending : t.feedback.submit}
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--full"
                onClick={onClose}
                disabled={status === 'sending'}
              >
                {t.feedback.close}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import type { SandraFlowStrings } from '../../locales/types'
import type { ComposedQuestion, SandraAnchor } from '../../types/sandraFlow'

function pronounForRelation(relation: string): string {
  return relation === 'papa' || relation === 'opa' ? 'er' : 'sie'
}

interface Props {
  t: SandraFlowStrings
  anchor: SandraAnchor
  questions: ComposedQuestion[]
  preferSimpleMode: boolean
  onTogglePreferSimpleMode: (next: boolean) => void
  /**
   * Async function that creates the invite in Supabase and returns the short
   * URL. Called on mount; result is cached so the share button can fire
   * navigator.share() synchronously when clicked.
   * Pass null when online sharing is not ready yet (identity still bootstrapping).
   */
  onShare: (() => Promise<string>) | null
  /** True when online sharing is configured but the user hasn't enabled it. */
  onlineSharingEnabled: boolean
  /** Called when the user taps "Activate online sharing" from this step. */
  onEnableOnlineSharing: () => void
  onBack: () => void
  onClearDraft: () => void
}

export function SandraShareStep({
  t,
  anchor,
  questions,
  preferSimpleMode,
  onTogglePreferSimpleMode,
  onShare,
  onlineSharingEnabled,
  onEnableOnlineSharing,
  onBack,
  onClearDraft,
}: Props) {
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [urlLoading, setUrlLoading] = useState(false)
  const [urlError, setUrlError] = useState(false)
  const [status, setStatus] = useState<'idle' | 'copied' | 'error' | 'sent'>('idle')
  const [isSharing, setIsSharing] = useState(false)

  // Pre-generate the invite URL as soon as onShare becomes available.
  useEffect(() => {
    if (!onShare) {
      setShareUrl(null)
      setUrlLoading(false)
      setUrlError(false)
      return
    }
    setUrlLoading(true)
    setUrlError(false)
    setShareUrl(null)
    onShare()
      .then(url => setShareUrl(url))
      .catch(() => setUrlError(true))
      .finally(() => setUrlLoading(false))
  }, [onShare])

  useEffect(() => {
    if (status === 'idle') return
    const timer = setTimeout(() => setStatus('idle'), 3500)
    return () => clearTimeout(timer)
  }, [status])

  const hasRelationship = questions.some(q => q.group === 'relationship')

  function handleShare() {
    if (isSharing || !shareUrl) return
    setIsSharing(true)
    const title = t.share.shareTitle.replace('{anrede}', anchor.anrede)
    const text = t.share.shareMessage

    if (typeof navigator.share === 'function') {
      navigator
        .share({ title, text, url: shareUrl })
        .then(() => {
          setIsSharing(false)
          setStatus('sent')
          setTimeout(() => onClearDraft(), 200)
        })
        .catch(err => {
          setIsSharing(false)
          if ((err as Error).name === 'AbortError') return
          fallbackCopy(shareUrl)
        })
    } else {
      fallbackCopy(shareUrl)
    }
  }

  function handleRetry() {
    if (!onShare) return
    setUrlError(false)
    setUrlLoading(true)
    onShare()
      .then(url => setShareUrl(url))
      .catch(() => setUrlError(true))
      .finally(() => setUrlLoading(false))
  }

  function fallbackCopy(url: string) {
    if (!navigator.clipboard) {
      setStatus('error')
      setIsSharing(false)
      return
    }
    navigator.clipboard
      .writeText(url)
      .then(() => setStatus('copied'))
      .catch(() => setStatus('error'))
      .finally(() => setIsSharing(false))
  }

  const buttonLabel =
    isSharing
      ? t.share.sending
      : status === 'copied'
      ? t.share.copied
      : status === 'error'
      ? t.share.error
      : t.share.primaryCta.replace('{anrede}', anchor.anrede)

  return (
    <div className="sandra-flow-view">
      <div className="quiz-topbar">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>
          {t.share.backToList}
        </button>
      </div>

      <section className="friends-section sandra-share">
        <h2 className="friends-section-title">
          {t.share.title
            .replace('{anrede}', anchor.anrede)
            .replace('{count}', String(questions.length))}
        </h2>

        {hasRelationship && (
          <p className="friends-hint">
            {t.share.relationshipHint.replace('{anrede}', anchor.anrede)}
          </p>
        )}

        <div className="sandra-share__preview" data-testid="sandra-share-preview">
          <p className="sandra-share__preview-heading">
            {t.share.recipientPreviewHeading
              .replace('{anrede}', anchor.anrede)
              .replace('{pronoun}', pronounForRelation(anchor.relation))}
          </p>
          <ul className="sandra-share__preview-list">
            {t.share.recipientPreviewLines.map((line, i) => (
              <li key={i} className="sandra-share__preview-line">
                {line.split('{anrede}').join(anchor.anrede)}
              </li>
            ))}
          </ul>
        </div>

        <label
          className="sandra-share__simple-toggle"
          data-testid="sandra-share-prefer-simple"
        >
          <input
            type="checkbox"
            checked={preferSimpleMode}
            onChange={e => onTogglePreferSimpleMode(e.target.checked)}
          />
          <span>
            <strong>
              {t.share.preferSimpleModeLabel.replace('{anrede}', anchor.anrede)}
            </strong>
            <span className="sandra-share__simple-toggle-hint">
              {t.share.preferSimpleModeHint.split('{anrede}').join(anchor.anrede)}
            </span>
          </span>
        </label>

        <div className="friends-share">
          {!onlineSharingEnabled && (
            <>
              <p className="friends-hint">{t.share.connectingHint}</p>
              <button className="share-cta-btn" onClick={onEnableOnlineSharing}>
                {t.share.activateOnlineSharingCta}
              </button>
            </>
          )}

          {onlineSharingEnabled && urlError && (
            <>
              <p className="friends-hint friends-hint--warn">{t.share.inviteError}</p>
              <button type="button" className="share-cta-btn" onClick={handleRetry}>
                {t.share.retryInvite}
              </button>
            </>
          )}

          {onlineSharingEnabled && !urlError && (
            <button
              type="button"
              className={`share-cta-btn${status === 'copied' || status === 'sent' ? ' share-cta-btn--success' : status === 'error' ? ' share-cta-btn--error' : ''}`}
              onClick={handleShare}
              disabled={isSharing || urlLoading || !shareUrl}
              data-testid="sandra-share-cta"
            >
              {(isSharing || urlLoading) && <span className="share-cta-btn__spinner" aria-hidden="true" />}
              {urlLoading ? t.share.generatingInvite : buttonLabel}
            </button>
          )}
        </div>

        <p className="friends-hint">
          {t.share.privacyHint.split('{anrede}').join(anchor.anrede)}
        </p>
      </section>
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import type { SandraFlowStrings } from '../../i18n/de/sandraFlow'
import type { ComposedQuestion, SandraAnchor } from '../../types/sandraFlow'

interface SyncShareData {
  url: string
  encoded: string
}

interface Props {
  t: SandraFlowStrings
  anchor: SandraAnchor
  questions: ComposedQuestion[]
  /** Current value of the simple-mode-handoff opt-in (#163). */
  preferSimpleMode: boolean
  /** Persist a change so buildPersonalPack picks it up. */
  onTogglePreferSimpleMode: (next: boolean) => void
  /**
   * Synchronous URL builder. Called inside the click gesture so
   * `navigator.share()` can be invoked without any prior `await`.
   */
  onShareSync: () => SyncShareData
  /**
   * Optional async upgrade. If compression succeeds, the shorter URL
   * is used for the clipboard fallback / second share attempt.
   */
  onShareUpgrade: () => Promise<string>
  onBack: () => void
  onClearDraft: () => void
}

export function SandraShareStep({
  t,
  anchor,
  questions,
  preferSimpleMode,
  onTogglePreferSimpleMode,
  onShareSync,
  onShareUpgrade,
  onBack,
  onClearDraft,
}: Props) {
  const [isSharing, setIsSharing] = useState(false)
  const [status, setStatus] = useState<'idle' | 'copied' | 'error' | 'sent'>('idle')
  const shareUrlRef = useRef<string | null>(null)

  // Eagerly start the async upgrade so it's ready by the time the user clicks.
  useEffect(() => {
    onShareUpgrade()
      .then(url => { shareUrlRef.current = url })
      .catch(() => { /* keep the sync url as fallback */ })
  }, [onShareUpgrade])

  useEffect(() => {
    if (status === 'idle') return
    const timer = setTimeout(() => setStatus('idle'), 3500)
    return () => clearTimeout(timer)
  }, [status])

  const hasRelationship = questions.some(q => q.group === 'relationship')

  function handleShare() {
    if (isSharing) return
    setIsSharing(true)

    const { url: syncUrl } = onShareSync()
    // Prefer the upgraded (compressed) URL if available, else sync URL.
    const url = shareUrlRef.current || syncUrl
    const title = t.share.shareTitle.replace('{anrede}', anchor.anrede)
    const text = t.share.shareMessage.replace('{url}', url)

    if (typeof navigator.share === 'function') {
      navigator
        .share({ title, text, url })
        .then(() => {
          setIsSharing(false)
          setStatus('sent')
          // Clear the draft after a successful send so opening #/ask again
          // starts fresh. We keep it on AbortError (user cancelled).
          setTimeout(() => onClearDraft(), 200)
        })
        .catch(err => {
          setIsSharing(false)
          if ((err as Error).name === 'AbortError') return
          fallbackCopy(url)
        })
    } else {
      fallbackCopy(url)
    }
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
            {t.share.recipientPreviewHeading.replace('{anrede}', anchor.anrede)}
          </p>
          <ul className="sandra-share__preview-list">
            {t.share.recipientPreviewLines.map((line, i) => (
              <li key={i} className="sandra-share__preview-line">{line}</li>
            ))}
          </ul>
        </div>

        {/* #163 — explicit opt-in to land Mama in Vereinfachter Bedienmodus
            (REQ-019) without an extra choice screen. Default-on; Sandra can
            opt out for tech-savvier recipients. */}
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
          <button
            type="button"
            className={`share-cta-btn${status === 'copied' || status === 'sent' ? ' share-cta-btn--success' : status === 'error' ? ' share-cta-btn--error' : ''}`}
            onClick={handleShare}
            disabled={isSharing}
            data-testid="sandra-share-cta"
          >
            {isSharing && <span className="share-cta-btn__spinner" aria-hidden="true" />}
            {buttonLabel}
          </button>
        </div>

        <p className="friends-hint">
          {t.share.privacyHint.replace('{anrede}', anchor.anrede)}
        </p>
      </section>
    </div>
  )
}

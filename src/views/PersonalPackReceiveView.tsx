import { useState, useEffect } from 'react'
import { useSandraFlowStrings } from '../i18n/sandraFlow'
import { useAppMode } from '../hooks/useAppMode'
import type { PersonalQuestionPack } from '../lib/sandraFlow/packBuilder'

interface Props {
  pack: PersonalQuestionPack
  /** When set, the recipient already has a Storyhold profile. The name-entry
   *  step is skipped and a tailored "existing user" welcome is shown instead. */
  existingProfileName?: string
  /** Called when the recipient finished or skipped all questions and wants
   *  to send the answers back. The view itself stages the answers in memory;
   *  the parent decides what to do with them. */
  onSubmit: (
    recipientName: string,
    answers: Array<{ questionId: string; questionText: string; value: string }>,
  ) => void
  /** Called when the recipient closes the dialog without sending anything. */
  onDismiss: () => void
}

type Phase = 'auto-suggest' | 'welcome' | 'existing-welcome' | 'quiz'

/** Big-button minimum size for the senior persona (REQ-019). Used by the
 *  primary "Antwort speichern" CTA in the quiz phase – the e2e Ingrid path
 *  asserts ≥80 × 80 px for this target. */
const PRIMARY_CTA_MIN_SIZE = 80

/**
 * Receiver-side view for Sandra-flow personal packs.
 *
 * Differences vs. the regular FriendAnswerView:
 *
 *  - Soft "{senderName} hat dir {n} Fragen geschickt" header
 *  - Auto-suggests Vereinfachter Bedienmodus (REQ-019) on first open
 *  - One-question-at-a-time, no list view, big mic button, single skip CTA
 *  - Progress = dot indicator, no percentages
 *  - No pack-code / no edit tools / no settings sidebar
 */
export function PersonalPackReceiveView({ pack, existingProfileName, onSubmit, onDismiss }: Props) {
  const t = useSandraFlowStrings()
  const { appMode, setAppMode } = useAppMode()

  // #163: when the sender (Sandra) ticked the simple-mode-handoff checkbox in
  // SandraShareStep, the pack carries `preferSimpleMode: true`. We honor that
  // by skipping the auto-suggest screen and activating Simple Mode silently —
  // so the senior persona never has to make the choice. Effect runs once; if
  // the user later opts out via Profile, that decision stands.
  //
  // Existing users (existingProfileName set) skip the auto-suggest and
  // name-entry steps entirely — they land on a tailored welcome instead.
  const [phase, setPhase] = useState<Phase>(() => {
    if (existingProfileName) return 'existing-welcome'
    if (appMode === 'simple') return 'welcome'
    if (pack.preferSimpleMode === true) return 'welcome'
    return 'auto-suggest'
  })
  useEffect(() => {
    if (pack.preferSimpleMode === true && appMode !== 'simple' && !existingProfileName) {
      setAppMode('simple')
    }
    // run once on mount so a later toggle from Profile doesn't fight us
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [name, setName] = useState(existingProfileName ?? '')
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [draft, setDraft] = useState('')

  useEffect(() => {
    if (phase !== 'quiz') return
    const current = pack.questions[index]
    setDraft(current ? answers[current.id] ?? '' : '')
  }, [phase, index, pack.questions, answers])

  function activateSimpleAndContinue() {
    setAppMode('simple')
    setPhase('welcome')
  }

  function declineSimple() {
    setPhase('welcome')
  }

  function start() {
    if (!name.trim()) return
    setIndex(0)
    setPhase('quiz')
  }

  function submit(finalAnswers: Record<string, string>) {
    const collected = pack.questions
      .map(q => ({
        questionId: q.id,
        questionText: q.text,
        value: finalAnswers[q.id]?.trim() ?? '',
      }))
      .filter(a => a.value.length > 0)
    onSubmit(name.trim() || pack.recipientLabel || 'Anonym', collected)
  }

  function saveAndNext() {
    const current = pack.questions[index]
    // Compute the next answer map synchronously so the submit path on the last
    // question doesn't read stale state from React's batched setAnswers.
    const nextAnswers = current
      ? { ...answers, [current.id]: draft.trim() }
      : answers
    if (current) setAnswers(nextAnswers)
    if (index + 1 < pack.questions.length) {
      setIndex(i => i + 1)
    } else {
      submit(nextAnswers)
    }
  }

  function skip() {
    if (index + 1 < pack.questions.length) {
      setIndex(i => i + 1)
    } else {
      submit(answers)
    }
  }

  // ── Existing-user welcome (skips name-entry and mode-suggest) ────
  if (phase === 'existing-welcome') {
    const title = t.receiver.existingUserTitle
      .replace('{recipientName}', existingProfileName ?? '')
      .replace('{senderName}', pack.senderName)
      .replace('{n}', String(pack.questions.length))
    return (
      <div className="sandra-flow-view sandra-receive">
        <section className="friends-section sandra-receive__welcome">
          <h1 className="sandra-receive__title" data-testid="sandra-receive-existing-title">
            {title}
          </h1>
          <p className="friends-hint sandra-receive__subline">
            {t.receiver.existingUserHint}
          </p>
          <div className="friends-share">
            <button
              type="button"
              className="share-cta-btn"
              onClick={() => { setIndex(0); setPhase('quiz') }}
              data-testid="sandra-receive-existing-start"
            >
              {t.receiver.existingUserStart}
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.6rem' }}>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={onDismiss}
            >
              {t.back}
            </button>
          </div>
        </section>
      </div>
    )
  }

  // ── Auto-suggest Vereinfachter Bedienmodus ────────────────────────
  if (phase === 'auto-suggest') {
    return (
      <div className="sandra-flow-view sandra-receive">
        <section className="friends-section sandra-receive__suggest">
          <h2 className="friends-section-title">{t.receiver.autoSuggestTitle}</h2>
          <p className="friends-hint">{t.receiver.autoSuggestDesc}</p>
          <div className="friends-share">
            <button
              type="button"
              className="share-cta-btn"
              onClick={activateSimpleAndContinue}
              data-testid="sandra-receive-simple-yes"
            >
              {t.receiver.autoSuggestYes}
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.6rem' }}>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={declineSimple}
              data-testid="sandra-receive-simple-no"
            >
              {t.receiver.autoSuggestNo}
            </button>
          </div>
        </section>
      </div>
    )
  }

  // ── Welcome (header + name input) ─────────────────────────────────
  if (phase === 'welcome') {
    return (
      <div className="sandra-flow-view sandra-receive">
        <section className="friends-section sandra-receive__welcome">
          <h1 className="sandra-receive__title">
            {t.receiver.headerTitle
              .replace('{senderName}', pack.senderName)
              .replace('{n}', String(pack.questions.length))}
          </h1>
          <p className="friends-hint sandra-receive__subline">{t.receiver.headerSubline}</p>
          <p className="friends-hint">
            {t.receiver.welcomePrivacyHint.replace('{senderName}', pack.senderName)}
          </p>

          <label className="input-label" htmlFor="sandra-receive-name">
            {t.receiver.welcomeNameLabel.replace('{senderName}', pack.senderName)}
          </label>
          <input
            id="sandra-receive-name"
            type="text"
            className="input-text"
            placeholder={t.receiver.welcomeNamePlaceholder}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && start()}
            autoFocus
            data-testid="sandra-receive-name"
          />
          <div className="friends-share">
            <button
              type="button"
              className="share-cta-btn"
              onClick={start}
              disabled={!name.trim()}
              data-testid="sandra-receive-start"
            >
              {t.receiver.welcomeStart}
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.6rem' }}>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={onDismiss}
            >
              {t.back}
            </button>
          </div>
        </section>
      </div>
    )
  }

  // ── Quiz: one question at a time ──────────────────────────────────
  const current = pack.questions[index]
  return (
    <div className="sandra-flow-view sandra-receive">
      <section className="friends-section sandra-receive__quiz">
        <p className="friends-hint sandra-receive__qlabel">
          {t.receiver.questionLabel
            .replace('{n}', String(index + 1))
            .replace('{total}', String(pack.questions.length))}
        </p>
        <h2 className="sandra-receive__qtext">{current.text}</h2>

        <textarea
          className="input-textarea sandra-receive__answer"
          placeholder={t.receiver.answerPlaceholder}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={6}
          aria-label={t.receiver.answerPlaceholder}
          data-testid="sandra-receive-answer"
        />

        <div className="sandra-receive__actions">
          {/* Primary "Antwort speichern" CTA. Previously rendered a 🎙 icon
              and was labelled "Sprachaufnahme starten" via aria-label – but
              clicking it never recorded audio, it just called saveAndNext.
              The Sandra persona flagged this as a trust-breaking
              accessibility fake (#169). The button now states its real
              action clearly; the senior tap-target ≥ 80×80 px is preserved. */}
          <button
            type="button"
            className="share-cta-btn sandra-receive__save"
            style={{ minWidth: PRIMARY_CTA_MIN_SIZE, minHeight: PRIMARY_CTA_MIN_SIZE }}
            aria-label={t.receiver.saveAndNextAria}
            title={t.receiver.saveAndNextLabel}
            onClick={saveAndNext}
            data-testid="sandra-receive-next"
          >
            {t.receiver.saveAndNextLabel}
          </button>
        </div>

        <div className="sandra-receive__nav">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={skip}
            data-testid="sandra-receive-skip"
          >
            {t.receiver.skip}
          </button>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={saveAndNext}
            data-testid="sandra-receive-continue"
          >
            {index + 1 < pack.questions.length ? t.receiver.next : t.receiver.done}
          </button>
        </div>

        {/* Progress dots */}
        <div
          className="sandra-receive__dots"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={pack.questions.length}
          aria-valuenow={index + 1}
          aria-label={t.receiver.progressDotAria
            .replace('{n}', String(index + 1))
            .replace('{total}', String(pack.questions.length))}
        >
          {pack.questions.map((_, i) => (
            <span
              key={i}
              className={`sandra-receive__dot${i === index ? ' sandra-receive__dot--current' : ''}${i < index ? ' sandra-receive__dot--done' : ''}`}
              aria-hidden="true"
            />
          ))}
        </div>
      </section>
    </div>
  )
}

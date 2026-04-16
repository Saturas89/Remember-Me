import { useState, useMemo, useEffect } from 'react'
import { QuestionCard } from '../components/QuestionCard'
import { ProgressBar } from '../components/ProgressBar'
import { FRIEND_TOPICS } from '../data/friendQuestions'
import { encodeAnswerExport } from '../utils/sharing'
import { generateAnswerUrl, generatePlainAnswerUrl } from '../utils/secureLink'
import type { InviteData, AnswerExport } from '../types'

interface Props {
  invite: InviteData
}

/** Resolves {name} placeholder in question texts */
function resolve(text: string, name: string): string {
  return text.replace(/\{name\}/g, name)
}

function newFriendId(): string {
  return `friend-${Date.now()}-${crypto.randomUUID()}`
}

export function FriendAnswerView({ invite }: Props) {
  // Use the friendId from the invite if it was a legacy per-friend link,
  // otherwise generate a fresh one for this visitor.
  const [friendId] = useState<string>(() => invite.friendId ?? newFriendId())

  const [friendName, setFriendName] = useState('')

  // The inviter may have pre-selected a topic (legacy per-friend invite).
  // For general invites the friend picks their own topic.
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(
    invite.topicId ?? null,
  )

  type Step = 'welcome' | 'topic' | 'quiz' | 'done'
  const [step, setStep] = useState<Step>('welcome')

  const [index, setIndex] = useState(0)
  const [localAnswers, setLocalAnswers] = useState<Record<string, string>>({})
  const [exportCode, setExportCode] = useState<string | null>(null)
  const [answerUrl, setAnswerUrl] = useState<string | null>(null)

  // Share-button state – same pattern as FriendsView
  const [isSharing, setIsSharing] = useState(false)
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>('idle')

  // Code-copy fallback button
  const [codeCopied, setCodeCopied] = useState(false)

  // Auto-clear share status feedback after 2.5 s (same as FriendsView)
  useEffect(() => {
    if (shareStatus === 'idle') return
    const t = setTimeout(() => setShareStatus('idle'), 2500)
    return () => clearTimeout(t)
  }, [shareStatus])

  const topic = useMemo(
    () =>
      FRIEND_TOPICS.find(t => t.id === selectedTopicId) ?? FRIEND_TOPICS[0],
    [selectedTopicId],
  )

  const questions = useMemo(
    () =>
      topic.questions.map(q => ({
        ...q,
        text: resolve(q.text, invite.profileName),
        helpText: q.helpText ? resolve(q.helpText, invite.profileName) : undefined,
        options: q.options?.map(o => resolve(o, invite.profileName)),
      })),
    [topic, invite.profileName],
  )

  function handleStartFromWelcome() {
    if (!friendName.trim()) return
    // If no topic was pre-selected, show the picker; else go straight to quiz.
    setStep(selectedTopicId ? 'quiz' : 'topic')
  }

  function handleChooseTopic(topicId: string) {
    setSelectedTopicId(topicId)
    setIndex(0)
    setLocalAnswers({})
    setStep('quiz')
  }

  function handleSave(value: string) {
    const q = questions[index]
    setLocalAnswers(prev => ({ ...prev, [q.id]: value }))
  }

  function handleNext() {
    if (index + 1 < questions.length) {
      setIndex(i => i + 1)
    } else {
      finish()
    }
  }

  function buildExportData(): AnswerExport {
    const questionMap = new Map(questions.map(q => [q.id, q]))
    return {
      friendId,
      friendName: friendName.trim() || 'Anonym',
      answers: Object.entries(localAnswers)
        .filter(([, v]) => v.trim())
        .map(([questionId, value]) => {
          const q = questionMap.get(questionId)
          return { questionId, value, questionText: q?.text }
        }),
    }
  }

  function finish() {
    const data = buildExportData()
    setExportCode(encodeAnswerExport(data))

    // Set a plain URL immediately (synchronous) so the share button is
    // never disabled – identical pattern to the invite-link generation.
    setAnswerUrl(generatePlainAnswerUrl(data))

    // Upgrade to a compressed URL in the background
    generateAnswerUrl(data).then(url => setAnswerUrl(url)).catch(() => {})

    setStep('done')
  }

  // Synchronous share handler – navigator.share() must be called directly
  // inside the click gesture (no await before the call), otherwise Safari
  // blocks the share sheet. Identical pattern to FriendsView.handleShare.
  function handleShare() {
    if (isSharing || !answerUrl) return

    const shareData = {
      title: 'Meine Erinnerungen',
      text: `Hier sind meine Erinnerungen für ${invite.profileName}:`,
      url: answerUrl,
    }
    setIsSharing(true)

    if (typeof navigator.share === 'function') {
      navigator
        .share(shareData)
        .then(() => setIsSharing(false))
        .catch(err => {
          setIsSharing(false)
          if ((err as Error).name === 'AbortError') return
          // Non-abort error – fall back to clipboard copy
          navigator.clipboard
            ?.writeText(answerUrl)
            .then(() => setShareStatus('copied'))
            .catch(() => setShareStatus('error'))
        })
    } else {
      navigator.clipboard
        .writeText(answerUrl)
        .then(() => setShareStatus('copied'))
        .catch(() => setShareStatus('error'))
        .finally(() => setIsSharing(false))
    }
  }

  function handleCopyCode() {
    navigator.clipboard.writeText(exportCode ?? '').then(() => setCodeCopied(true))
  }

  // ── Done screen ──────────────────────────────────────────
  if (step === 'done' && exportCode) {
    return (
      <div className="friend-answer-view">
        <div className="export-done">
          <div className="export-done__icon">🎉</div>
          <h2>Danke für deine Erinnerungen!</h2>
          <p>
            Schick deine Antworten jetzt an <strong>{invite.profileName}</strong> – sie werden
            direkt in deren Lebensarchiv gespeichert.
          </p>

          {/* Share button – same class and pattern as the invite share in FriendsView */}
          <button
            className={`share-cta-btn${shareStatus === 'copied' ? ' share-cta-btn--success' : shareStatus === 'error' ? ' share-cta-btn--error' : ''}`}
            onClick={handleShare}
            disabled={isSharing}
          >
            {isSharing ? (
              <><span className="share-cta-btn__spinner" aria-hidden="true" />Wird geöffnet…</>
            ) : shareStatus === 'copied' ? (
              '✓ Link kopiert!'
            ) : shareStatus === 'error' ? (
              '⚠ Nochmal versuchen'
            ) : (
              '📤 Erinnerungen verschicken'
            )}
          </button>

          {/* Visible link with copy button – always shown since URL is pre-generated */}
          {answerUrl && (
            <div className="answer-link-box">
              <div className="answer-link-row">
                <span className="answer-link-url">{answerUrl}</span>
              </div>
              <p className="export-hint">
                Wenn {invite.profileName} diesen Link öffnet, werden die Antworten automatisch importiert.
              </p>
            </div>
          )}

          {/* Deep fallback: manual code copy */}
          {exportCode && (
            <details className="export-fallback">
              <summary>Code manuell kopieren</summary>
              <div className="export-code">{exportCode}</div>
              <button
                className={`btn btn--outline btn--sm ${codeCopied ? 'btn--success' : ''}`}
                onClick={handleCopyCode}
              >
                {codeCopied ? '✓ Kopiert!' : '📋 Code kopieren'}
              </button>
              <p className="export-hint">
                {invite.profileName} fügt den Code unter „Erinnerung einsammeln → Antwort-Link oder
                Code eingeben" ein.
              </p>
            </details>
          )}
        </div>
      </div>
    )
  }

  // ── Welcome screen ───────────────────────────────────────
  if (step === 'welcome') {
    return (
      <div className="friend-answer-view">
        <div className="friend-welcome">
          <div className="friend-welcome__icon">👋</div>
          <h1>Hallo!</h1>
          <p>
            Du wurdest von <strong>{invite.profileName}</strong> eingeladen, ein paar Fragen
            über sie oder ihn zu beantworten. Deine Antworten werden im persönlichen
            Lebensarchiv gespeichert – ein schönes Geschenk!
          </p>
          <div className="friend-name-input">
            <label className="input-label">Wie heißt du?</label>
            <input
              className="input-text"
              value={friendName}
              onChange={e => setFriendName(e.target.value)}
              onKeyDown={e =>
                e.key === 'Enter' && friendName.trim() && handleStartFromWelcome()
              }
              placeholder="Dein Name..."
              autoFocus
            />
          </div>
          <button
            className="btn btn--primary"
            onClick={handleStartFromWelcome}
            disabled={!friendName.trim()}
          >
            Weiter →
          </button>
          {selectedTopicId && (
            <p className="friend-welcome__note">
              {topic.emoji} {topic.title} · {questions.length} Fragen · ca. 5 Minuten
            </p>
          )}
        </div>
      </div>
    )
  }

  // ── Topic selection screen ───────────────────────────────
  if (step === 'topic') {
    return (
      <div className="friend-answer-view">
        <div className="friend-topic-picker">
          <h2 className="friend-topic-picker__title">
            Worüber möchtest du erzählen, {friendName}?
          </h2>
          <p className="friend-topic-picker__intro">
            Wähle eine Kategorie – pro Kategorie gibt es ein paar Fragen über{' '}
            <strong>{invite.profileName}</strong>.
          </p>
          <div className="friends-topic-grid">
            {FRIEND_TOPICS.map(t => (
              <button
                key={t.id}
                type="button"
                className="friend-topic-card"
                onClick={() => handleChooseTopic(t.id)}
              >
                <span className="friend-topic-card__emoji">{t.emoji}</span>
                <span className="friend-topic-card__title">{t.title}</span>
                <span className="friend-topic-card__desc">
                  {resolve(t.description, invite.profileName)}
                </span>
              </button>
            ))}
          </div>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => setStep('welcome')}
          >
            ← Zurück
          </button>
        </div>
      </div>
    )
  }

  // ── Quiz screen ──────────────────────────────────────────
  const question = questions[index]
  const progress = Math.round((index / questions.length) * 100)

  return (
    <div className="friend-answer-view">
      <div className="quiz-topbar">
        <span className="quiz-category-title">
          {topic.emoji} {topic.title} – über {invite.profileName}
        </span>
      </div>
      <ProgressBar value={progress} />
      <QuestionCard
        question={question}
        initialValue={localAnswers[question.id] ?? ''}
        imageIds={[]}
        imageCache={{}}
        videoIds={[]}
        index={index}
        total={questions.length}
        onSave={handleSave}
        onLoadImages={() => {}}
        onAddImage={() => {}}
        onRemoveImage={() => {}}
        onAddVideo={() => {}}
        onRemoveVideo={() => {}}
        onSaveAudio={async () => {}}
        onRemoveAudio={() => {}}
        onNext={handleNext}
        onPrev={() => setIndex(i => Math.max(0, i - 1))}
        canGoBack={index > 0}
      />
    </div>
  )
}

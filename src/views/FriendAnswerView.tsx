import { useState } from 'react'
import { QuestionCard } from '../components/QuestionCard'
import { ProgressBar } from '../components/ProgressBar'
import { FRIEND_TOPICS } from '../data/friendQuestions'
import { encodeAnswerExport } from '../utils/sharing'
import { generateAnswerUrl, shareOrCopy } from '../utils/secureLink'
import type { InviteData, AnswerExport } from '../types'

interface Props {
  invite: InviteData
}

/** Resolves {name} placeholder in question texts */
function resolve(text: string, name: string): string {
  return text.replace(/\{name\}/g, name)
}

export function FriendAnswerView({ invite }: Props) {
  const [friendName, setFriendName] = useState('')
  const [started, setStarted] = useState(false)
  const [index, setIndex] = useState(0)
  const [localAnswers, setLocalAnswers] = useState<Record<string, string>>({})
  const [exportCode, setExportCode] = useState<string | null>(null)
  const [answerUrl, setAnswerUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isSharing, setIsSharing] = useState(false)

  const topic =
    FRIEND_TOPICS.find(t => t.id === invite.topicId) ?? FRIEND_TOPICS[0]

  const questions = topic.questions.map(q => ({
    ...q,
    text: resolve(q.text, invite.profileName),
    helpText: q.helpText ? resolve(q.helpText, invite.profileName) : undefined,
    options: q.options?.map(o => resolve(o, invite.profileName)),
  }))

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
      friendId: invite.friendId,
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
    // Pre-generate the answer URL in the background
    generateAnswerUrl(data).then(url => setAnswerUrl(url)).catch(() => {})
  }

  async function handleShare() {
    if (!answerUrl || isSharing) return
    setIsSharing(true)
    try {
      const didShare = await shareOrCopy({
        title: 'Meine Erinnerungen',
        text: `Hier sind meine Erinnerungen für ${invite.profileName}:`,
        url: answerUrl,
      })
      if (!didShare) {
        // Fallback: copy the raw code
        navigator.clipboard.writeText(exportCode ?? '').then(() => setCopied(true))
      }
    } finally {
      setIsSharing(false)
    }
  }

  function handleCopyCode() {
    navigator.clipboard.writeText(exportCode ?? '').then(() => setCopied(true))
  }

  // ── Done screen ──────────────────────────────────────────
  if (exportCode) {
    return (
      <div className="friend-answer-view">
        <div className="export-done">
          <div className="export-done__icon">🎉</div>
          <h2>Danke für deine Erinnerungen!</h2>
          <p>
            Schick deine Antworten jetzt an <strong>{invite.profileName}</strong> – sie werden
            direkt in deren Lebensarchiv gespeichert.
          </p>

          {/* Primary: share via Web Share / WhatsApp / iMessage */}
          <button
            className="btn btn--primary share-btn"
            onClick={handleShare}
            disabled={!answerUrl || isSharing}
          >
            {isSharing
              ? 'Wird geöffnet…'
              : copied
                ? '✓ Kopiert!'
                : 'Erinnerungen verschicken'}
          </button>

          {/* Secondary: manual code copy */}
          {exportCode && (
            <details className="export-fallback">
              <summary>Code manuell kopieren</summary>
              <div className="export-code">{exportCode}</div>
              <button
                className={`btn btn--outline btn--sm ${copied ? 'btn--success' : ''}`}
                onClick={handleCopyCode}
              >
                {copied ? '✓ Kopiert!' : '📋 Code kopieren'}
              </button>
              <p className="export-hint">
                {invite.profileName} fügt den Code unter „Erinnerung einsammeln → Antwort-Code
                eingeben" ein.
              </p>
            </details>
          )}
        </div>
      </div>
    )
  }

  // ── Welcome screen ───────────────────────────────────────
  if (!started) {
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
              onKeyDown={e => e.key === 'Enter' && friendName.trim() && setStarted(true)}
              placeholder="Dein Name..."
              autoFocus
            />
          </div>
          <button
            className="btn btn--primary"
            onClick={() => setStarted(true)}
            disabled={!friendName.trim()}
          >
            Los geht's →
          </button>
          <p className="friend-welcome__note">
            {topic.emoji} {topic.title} · {questions.length} Fragen · ca. 5 Minuten
          </p>
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
          Fragen über {invite.profileName} – beantwortet von {friendName}
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

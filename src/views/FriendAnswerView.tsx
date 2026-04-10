import { useState } from 'react'
import { QuestionCard } from '../components/QuestionCard'
import { ProgressBar } from '../components/ProgressBar'
import { FRIEND_QUESTIONS } from '../data/friendQuestions'
import { encodeAnswerExport } from '../utils/sharing'
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
  const [copied, setCopied] = useState(false)

  const questions = FRIEND_QUESTIONS.map(q => ({
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

  function finish() {
    const data: AnswerExport = {
      friendId: invite.friendId,
      friendName: friendName.trim() || 'Anonym',
      answers: Object.entries(localAnswers)
        .filter(([, v]) => v.trim())
        .map(([questionId, value]) => ({ questionId, value })),
    }
    setExportCode(encodeAnswerExport(data))
  }

  function handleCopy(code: string) {
    navigator.clipboard.writeText(code).then(() => setCopied(true))
  }

  // ── Done screen ──────────────────────────────────────────
  if (exportCode) {
    return (
      <div className="friend-answer-view">
        <div className="export-done">
          <div className="export-done__icon">🎉</div>
          <h2>Vielen Dank!</h2>
          <p>
            Deine Antworten sind gespeichert. Schicke diesen Code an{' '}
            <strong>{invite.profileName}</strong>, damit sie in deren Archiv landen:
          </p>
          <div className="export-code">{exportCode}</div>
          <button
            className={`btn btn--primary ${copied ? 'btn--success' : ''}`}
            onClick={() => handleCopy(exportCode)}
          >
            {copied ? '✓ Kopiert!' : '📋 Code kopieren'}
          </button>
          <p className="export-hint">
            {invite.profileName} fügt den Code unter „Freunde → Antworten importieren" ein.
          </p>
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
            {questions.length} Fragen · dauert ca. 5–10 Minuten
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
        index={index}
        total={questions.length}
        onSave={handleSave}
        onNext={handleNext}
        onPrev={() => setIndex(i => Math.max(0, i - 1))}
        canGoBack={index > 0}
      />
    </div>
  )
}

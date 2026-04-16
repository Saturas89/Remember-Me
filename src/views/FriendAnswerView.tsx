import { useState, useRef, useMemo, useEffect } from 'react'
import { QuestionCard } from '../components/QuestionCard'
import { ProgressBar } from '../components/ProgressBar'
import { FRIEND_TOPICS } from '../data/friendQuestions'
import { encodeAnswerExport } from '../utils/sharing'
import { generateAnswerUrl, generatePlainAnswerUrl } from '../utils/secureLink'
import { buildFriendAnswerArchive, fmtBytes } from '../utils/archiveExport'
import { useImageStore } from '../hooks/useImageStore'
import { addAudio, removeAudio } from '../hooks/useAudioStore'
import { addVideo, removeVideo } from '../hooks/useVideoStore'
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

  // ── Media state (per question) ───────────────────────────
  const { cache, loadImages, addImage, removeImage } = useImageStore()
  const [localImageIds, setLocalImageIds] = useState<Record<string, string[]>>({})
  const [localVideoIds, setLocalVideoIds] = useState<Record<string, string[]>>({})
  const [localAudioIds, setLocalAudioIds] = useState<Record<string, string | undefined>>({})

  // ── ZIP generation state ─────────────────────────────────
  type ZipState = 'idle' | 'building' | 'ready' | 'error'
  const [zipState, setZipState] = useState<ZipState>('idle')
  const [zipStep, setZipStep] = useState('')
  const [zipBlob, setZipBlob] = useState<Blob | null>(null)
  const [zipSize, setZipSize] = useState(0)

  // Ref always holds the latest (preferably compressed) URL so the synchronous
  // share handler can access it without relying on React state timing.
  const shareUrlRef = useRef<string | null>(null)

  // Share-button state – same pattern as FriendsView
  const [isSharing, setIsSharing] = useState(false)
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>('idle')

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

  // Whether any attachments were added across all questions
  const hasAttachments =
    Object.values(localImageIds).some(ids => ids.length > 0) ||
    Object.values(localVideoIds).some(ids => ids.length > 0) ||
    Object.values(localAudioIds).some(id => !!id)

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

  // ── Media handlers (mirror QuizView pattern) ─────────────

  async function handleAddImage(file: File) {
    const qId = questions[index].id
    const id  = await addImage(file)
    setLocalImageIds(prev => ({ ...prev, [qId]: [...(prev[qId] ?? []), id] }))
  }

  async function handleRemoveImage(id: string) {
    const qId = questions[index].id
    await removeImage(id)
    setLocalImageIds(prev => ({ ...prev, [qId]: (prev[qId] ?? []).filter(i => i !== id) }))
  }

  async function handleAddVideo(file: File) {
    const qId = questions[index].id
    const id  = await addVideo(file)
    setLocalVideoIds(prev => ({ ...prev, [qId]: [...(prev[qId] ?? []), id] }))
  }

  async function handleRemoveVideo(id: string) {
    const qId = questions[index].id
    await removeVideo(id)
    setLocalVideoIds(prev => ({ ...prev, [qId]: (prev[qId] ?? []).filter(v => v !== id) }))
  }

  async function handleSaveAudio(_transcript: string, blob: Blob) {
    const qId    = questions[index].id
    const existing = localAudioIds[qId]
    if (existing) await removeAudio(existing)
    const id = await addAudio(blob)
    setLocalAudioIds(prev => ({ ...prev, [qId]: id }))
  }

  async function handleRemoveAudio() {
    const qId    = questions[index].id
    const existing = localAudioIds[qId]
    if (existing) await removeAudio(existing)
    setLocalAudioIds(prev => ({ ...prev, [qId]: undefined }))
  }

  // ── Export helpers ───────────────────────────────────────

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

  function buildZipOptions() {
    const questionMap = new Map(questions.map(q => [q.id, q]))
    const allQuestionIds = questions.map(q => q.id)
    return {
      friendId,
      friendName: friendName.trim() || 'Anonym',
      answers: allQuestionIds
        .filter(qId =>
          (localAnswers[qId]?.trim()) ||
          (localImageIds[qId]?.length) ||
          localVideoIds[qId]?.length ||
          localAudioIds[qId],
        )
        .map(qId => ({
          questionId: qId,
          value: localAnswers[qId] ?? '',
          questionText: questionMap.get(qId)?.text,
          imageIds: localImageIds[qId] ?? [],
          audioId: localAudioIds[qId],
          videoIds: localVideoIds[qId] ?? [],
        })),
    }
  }

  function finish() {
    const data = buildExportData()
    setExportCode(encodeAnswerExport(data))

    // Always generate URL as fallback / text-only path
    const plainUrl = generatePlainAnswerUrl(data)
    shareUrlRef.current = plainUrl
    generateAnswerUrl(data)
      .then(url => { shareUrlRef.current = url })
      .catch(() => {})

    // If attachments present, build ZIP in background
    if (hasAttachments) {
      setZipState('building')
      buildFriendAnswerArchive(buildZipOptions(), (s, _pct) => setZipStep(s))
        .then(({ blob, stats }) => {
          setZipBlob(blob)
          setZipSize(stats.totalBytes)
          setZipState('ready')
        })
        .catch(() => setZipState('error'))
    }

    setStep('done')
  }

  // Synchronous URL share handler – navigator.share() must be called directly
  // inside the click gesture (no await before the call), otherwise Safari
  // blocks the share sheet. Identical pattern to FriendsView.handleShare.
  function handleShare() {
    if (isSharing || !shareUrlRef.current) return

    const url = shareUrlRef.current
    const shareData = {
      title: `Meine Erinnerungen an ${invite.profileName}`,
      text: `Hey ${invite.profileName}! Ich habe gerade ein paar Fragen über dich beantwortet – öffne einfach diesen Link und meine Erinnerungen landen direkt in deinem Lebensarchiv. 🎉`,
      url,
    }
    setIsSharing(true)

    if (typeof navigator.share === 'function') {
      navigator
        .share(shareData)
        .then(() => setIsSharing(false))
        .catch(err => {
          setIsSharing(false)
          if ((err as Error).name === 'AbortError') return
          navigator.clipboard
            ?.writeText(url)
            .then(() => setShareStatus('copied'))
            .catch(() => setShareStatus('error'))
        })
    } else {
      navigator.clipboard
        .writeText(url)
        .then(() => setShareStatus('copied'))
        .catch(() => setShareStatus('error'))
        .finally(() => setIsSharing(false))
    }
  }

  // ZIP share: tries native file share first, falls back to download
  function handleShareZip() {
    if (!zipBlob || isSharing) return
    const safeName = invite.profileName.replace(/\s+/g, '-').toLowerCase()
    const zipFile  = new File([zipBlob], `erinnerungen-an-${safeName}.zip`, { type: 'application/zip' })
    setIsSharing(true)

    if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [zipFile] })) {
      navigator
        .share({
          files: [zipFile],
          title: `Meine Erinnerungen an ${invite.profileName}`,
        })
        .then(() => setIsSharing(false))
        .catch(err => {
          setIsSharing(false)
          if ((err as Error).name !== 'AbortError') downloadZip(zipFile)
        })
    } else {
      downloadZip(zipFile)
      setIsSharing(false)
    }
  }

  function downloadZip(file: File) {
    const url = URL.createObjectURL(file)
    const a   = document.createElement('a')
    a.href     = url
    a.download = file.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
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

          {/* Primary share action */}
          {hasAttachments ? (
            <button
              className={`share-cta-btn${zipState === 'error' ? ' share-cta-btn--error' : ''}`}
              onClick={zipState === 'ready' ? handleShareZip : handleShare}
              disabled={isSharing || zipState === 'building'}
            >
              {isSharing ? (
                <><span className="share-cta-btn__spinner" aria-hidden="true" />Wird geöffnet…</>
              ) : zipState === 'building' ? (
                <><span className="share-cta-btn__spinner" aria-hidden="true" />{zipStep || 'Anhänge werden verpackt…'}</>
              ) : zipState === 'ready' ? (
                `📦 Als ZIP teilen${zipSize ? ` (${fmtBytes(zipSize)})` : ''}`
              ) : zipState === 'error' ? (
                '⚠ Fehler – nur Text teilen'
              ) : (
                '📤 Erinnerungen verschicken'
              )}
            </button>
          ) : (
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
          )}

          {/* Fallback: text-only link when ZIP is ready */}
          {hasAttachments && zipState === 'ready' && (
            <button
              className="btn btn--ghost btn--sm"
              style={{ marginTop: '0.5rem' }}
              onClick={handleShare}
              disabled={isSharing}
            >
              Nur Text (ohne Anhänge) teilen
            </button>
          )}

          <div className="export-done__own-cta">
            <a href="https://rememberme.dad" target="_blank" rel="noopener noreferrer">
              <img
                src="/friend-invite-promo.jpeg"
                alt="RememberMe – Lebensarchiv für deine Erinnerungen"
                className="export-done__own-cta-img"
              />
            </a>
            <p>
              Möchtest du auch deine eigenen Erinnerungen festhalten?{' '}
              <a href="https://rememberme.dad" target="_blank" rel="noopener noreferrer">
                Erstelle dein eigenes Lebensarchiv
              </a>{' '}
              – kostenlos, für immer und deine Daten bleiben komplett privat.
            </p>
          </div>
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
        imageIds={localImageIds[question.id] ?? []}
        imageCache={cache}
        videoIds={localVideoIds[question.id] ?? []}
        audioId={localAudioIds[question.id]}
        index={index}
        total={questions.length}
        onSave={handleSave}
        onLoadImages={loadImages}
        onAddImage={handleAddImage}
        onRemoveImage={handleRemoveImage}
        onAddVideo={handleAddVideo}
        onRemoveVideo={handleRemoveVideo}
        onSaveAudio={handleSaveAudio}
        onRemoveAudio={handleRemoveAudio}
        onNext={handleNext}
        onPrev={() => setIndex(i => Math.max(0, i - 1))}
        canGoBack={index > 0}
      />
    </div>
  )
}

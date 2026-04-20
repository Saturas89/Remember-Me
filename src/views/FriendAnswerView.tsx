import { useState, useRef, useMemo, useEffect } from 'react'
import { QuestionCard } from '../components/QuestionCard'
import { ProgressBar } from '../components/ProgressBar'
import { getFriendTopicsForLocale } from '../data/friendQuestions'
import { encodeAnswerExport } from '../utils/sharing'
import { generateAnswerUrl, generatePlainAnswerUrl } from '../utils/secureLink'
import { buildFriendAnswerArchive, fmtBytes } from '../utils/archiveExport'
import { useImageStore } from '../hooks/useImageStore'
import { addAudio, removeAudio } from '../hooks/useAudioStore'
import { addVideo, removeVideo } from '../hooks/useVideoStore'
import { useTranslation } from '../locales'
import type { InviteData, AnswerExport } from '../types'

interface Props {
  invite: InviteData
}

function resolve(text: string, name: string): string {
  return text.replace(/\{name\}/g, name)
}

function newFriendId(): string {
  return `friend-${Date.now()}-${crypto.randomUUID()}`
}

export function FriendAnswerView({ invite }: Props) {
  const { t, locale } = useTranslation()
  const friendTopics = getFriendTopicsForLocale(locale)

  const [friendId] = useState<string>(() => invite.friendId ?? newFriendId())
  const [friendName, setFriendName] = useState('')
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(
    invite.topicId ?? null,
  )

  type Step = 'welcome' | 'topic' | 'quiz' | 'done'
  const [step, setStep] = useState<Step>('welcome')

  const [index, setIndex] = useState(0)
  const [localAnswers, setLocalAnswers] = useState<Record<string, string>>({})
  const [exportCode, setExportCode] = useState<string | null>(null)

  const { cache, loadImages, addImage, removeImage } = useImageStore()
  const [localImageIds, setLocalImageIds] = useState<Record<string, string[]>>({})
  const [localVideoIds, setLocalVideoIds] = useState<Record<string, string[]>>({})
  const [localAudioIds, setLocalAudioIds] = useState<Record<string, string | undefined>>({})

  type ZipState = 'idle' | 'building' | 'ready' | 'error'
  const [zipState, setZipState] = useState<ZipState>('idle')
  const [zipStep, setZipStep] = useState('')
  const [zipBlob, setZipBlob] = useState<Blob | null>(null)
  const [zipSize, setZipSize] = useState(0)

  const shareUrlRef = useRef<string | null>(null)
  const [isSharing, setIsSharing] = useState(false)
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>('idle')

  useEffect(() => {
    if (shareStatus === 'idle') return
    const timer = setTimeout(() => setShareStatus('idle'), 2500)
    return () => clearTimeout(timer)
  }, [shareStatus])

  const topic = useMemo(
    () => friendTopics.find(topic => topic.id === selectedTopicId) ?? friendTopics[0],
    [selectedTopicId, friendTopics],
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

  const hasAttachments =
    Object.values(localImageIds).some(ids => ids.length > 0) ||
    Object.values(localVideoIds).some(ids => ids.length > 0) ||
    Object.values(localAudioIds).some(id => !!id)

  function handleStartFromWelcome() {
    if (!friendName.trim()) return
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

  // ── Media handlers ───────────────────────────────────────

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

  async function handleSaveAudio(_transcript: string, blob: Blob | null) {
    const qId      = questions[index].id
    const existing = localAudioIds[qId]
    if (existing) await removeAudio(existing)
    const id = blob ? await addAudio(blob) : undefined
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

    const plainUrl = generatePlainAnswerUrl(data)
    shareUrlRef.current = plainUrl
    generateAnswerUrl(data)
      .then(url => { shareUrlRef.current = url })
      .catch(() => {})

    if (hasAttachments) {
      setZipState('building')
      buildFriendAnswerArchive({ ...buildZipOptions(), onProgress: (s) => setZipStep(s) })
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
  // inside the click gesture (no await before the call).
  function handleShare() {
    if (isSharing || !shareUrlRef.current) return

    const url = shareUrlRef.current
    const shareData = {
      title: `${t.friendAnswer.doneTitle}`,
      text: `${t.friendAnswer.doneText.replace('{name}', invite.profileName)}`,
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
            ?.writeText(`${shareData.text}\n\n${url}`)
            .then(() => setShareStatus('copied'))
            .catch(() => setShareStatus('error'))
        })
    } else {
      navigator.clipboard
        .writeText(`${shareData.text}\n\n${url}`)
        .then(() => setShareStatus('copied'))
        .catch(() => setShareStatus('error'))
        .finally(() => setIsSharing(false))
    }
  }

  function handleShareZip() {
    if (!zipBlob || isSharing) return
    const safeName  = invite.profileName.replace(/\s+/g, '-').toLowerCase()
    const zipFile   = new File([zipBlob], `erinnerungen-an-${safeName}.zip`, { type: 'application/zip' })
    const importUrl = `${window.location.origin}/friends`
    setIsSharing(true)

    if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [zipFile] })) {
      navigator
        .share({
          files: [zipFile],
          title: `${t.friendAnswer.doneTitle}`,
          text: `${t.friendAnswer.doneText.replace('{name}', invite.profileName)} ${importUrl}`,
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
          <div className="export-done__icon">{t.friendAnswer.doneIcon}</div>
          <h2>{t.friendAnswer.doneTitle}</h2>
          <p>
            {t.friendAnswer.doneText.replace('{name}', invite.profileName)}
          </p>

          {hasAttachments ? (
            <button
              className={`share-cta-btn${zipState === 'error' ? ' share-cta-btn--error' : ''}`}
              onClick={zipState === 'ready' ? handleShareZip : handleShare}
              disabled={isSharing || zipState === 'building'}
            >
              {isSharing ? (
                <><span className="share-cta-btn__spinner" aria-hidden="true" />{t.friendAnswer.shareOpening}</>
              ) : zipState === 'building' ? (
                <><span className="share-cta-btn__spinner" aria-hidden="true" />{zipStep || t.friendAnswer.buildingAttachments}</>
              ) : zipState === 'ready' ? (
                `${t.friendAnswer.shareWithAttachments}${zipSize ? ` (${fmtBytes(zipSize)})` : ''}`
              ) : zipState === 'error' ? (
                t.friendAnswer.shareError
              ) : (
                t.friendAnswer.shareButton
              )}
            </button>
          ) : (
            <button
              className={`share-cta-btn${shareStatus === 'copied' ? ' share-cta-btn--success' : shareStatus === 'error' ? ' share-cta-btn--error' : ''}`}
              onClick={handleShare}
              disabled={isSharing}
            >
              {isSharing ? (
                <><span className="share-cta-btn__spinner" aria-hidden="true" />{t.friendAnswer.shareOpening}</>
              ) : shareStatus === 'copied' ? (
                t.friendAnswer.shareCopied
              ) : shareStatus === 'error' ? (
                t.friendAnswer.shareRetry
              ) : (
                t.friendAnswer.shareTextOnly
              )}
            </button>
          )}

          {hasAttachments && zipState === 'ready' && (
            <button
              className="btn btn--ghost btn--sm"
              style={{ marginTop: '0.5rem' }}
              onClick={handleShare}
              disabled={isSharing}
            >
              {t.friendAnswer.textOnlyShare}
            </button>
          )}

          <div className="export-done__own-cta">
            <a href="https://rememberme.dad" target="_blank" rel="noopener noreferrer">
              <img
                src="/friend-invite-promo.jpeg"
                alt={t.friendAnswer.ownCtaImgAlt}
                className="export-done__own-cta-img"
              />
            </a>
            <p>
              {t.friendAnswer.ownCtaText}{' '}
              <a href="https://rememberme.dad" target="_blank" rel="noopener noreferrer">
                {t.friendAnswer.ownCtaLink}
              </a>
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
          <div className="friend-welcome__icon">{t.friendAnswer.welcomeIcon}</div>
          <h1>{t.friendAnswer.welcomeTitle}</h1>
          <p
            dangerouslySetInnerHTML={{
              __html: t.friendAnswer.welcomeText.replace(
                '{name}',
                `<strong>${invite.profileName}</strong>`,
              ),
            }}
          />
          <div className="friend-name-input">
            <label className="input-label">{t.friendAnswer.nameLabel}</label>
            <input
              className="input-text"
              value={friendName}
              onChange={e => setFriendName(e.target.value)}
              onKeyDown={e =>
                e.key === 'Enter' && friendName.trim() && handleStartFromWelcome()
              }
              placeholder={t.friendAnswer.namePlaceholder}
              autoFocus
            />
          </div>
          <button
            className="btn btn--primary"
            onClick={handleStartFromWelcome}
            disabled={!friendName.trim()}
          >
            {t.friendAnswer.startButton}
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
            {t.friendAnswer.topicHeading.replace('{name}', friendName)}
          </h2>
          <div className="friends-topic-grid">
            {friendTopics.map(topic => (
              <button
                key={topic.id}
                type="button"
                className="friend-topic-card"
                onClick={() => handleChooseTopic(topic.id)}
              >
                <span className="friend-topic-card__emoji">{topic.emoji}</span>
                <span className="friend-topic-card__title">{topic.title}</span>
                <span className="friend-topic-card__desc">
                  {resolve(topic.description, invite.profileName)}
                </span>
              </button>
            ))}
          </div>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => setStep('welcome')}
          >
            {t.friendAnswer.back}
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
          {topic.emoji} {topic.title} – {invite.profileName}
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

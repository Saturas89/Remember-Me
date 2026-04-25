import { useState, useEffect, useRef } from 'react'
import { decodeQuestionPack } from '../utils/sharing'
import { generateMemoryShareUrlSync } from '../utils/secureLink'
import { generateShareCard } from '../utils/shareCard'
import { useImageStore } from '../hooks/useImageStore'
import { addAudio, removeAudio } from '../hooks/useAudioStore'
import { addVideo, removeVideo } from '../hooks/useVideoStore'
import { MediaCapture } from '../components/MediaCapture'
import { useTranslation } from '../locales'
import type { CustomQuestion } from '../types'

interface Props {
  customQuestions: CustomQuestion[]
  profileName: string
  getAnswer: (questionId: string) => string
  getAnswerImageIds: (questionId: string) => string[]
  getAnswerVideoIds: (questionId: string) => string[]
  getAnswerAudioId: (questionId: string) => string | undefined
  onSave: (questionId: string, categoryId: string, value: string) => void
  onSetImages: (questionId: string, categoryId: string, imageIds: string[]) => void
  onSetVideos: (questionId: string, categoryId: string, videoIds: string[]) => void
  onSetAudio: (questionId: string, categoryId: string, audioId: string | undefined, audioTranscribedAt: string | undefined, audioTranscript?: string) => void
  onAdd: (
    text: string,
    type: CustomQuestion['type'],
    helpText?: string,
    options?: string[],
  ) => CustomQuestion
  onRemove: (id: string) => void
  onImport: (questions: CustomQuestion[]) => void
  onBack: () => void
}

export function CustomQuestionsView({
  customQuestions,
  profileName,
  getAnswer,
  getAnswerImageIds,
  getAnswerVideoIds,
  getAnswerAudioId,
  onSave,
  onSetImages,
  onSetVideos,
  onSetAudio,
  onAdd,
  onRemove,
  onImport,
  onBack,
}: Props) {
  const { t } = useTranslation()
  const { cache, loadImages, addImage, removeImage } = useImageStore()
  const [newText, setNewText] = useState('')
  const [answeringId, setAnsweringId] = useState<string | null>(null)
  const [draftAnswer, setDraftAnswer] = useState('')
  const [importCode, setImportCode] = useState('')
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isSharing, setIsSharing] = useState(false)
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const shareCardRef = useRef<File | null>(null)

  useEffect(() => {
    if (shareStatus === 'idle') return
    const timer = setTimeout(() => setShareStatus('idle'), 2500)
    return () => clearTimeout(timer)
  }, [shareStatus])

  useEffect(() => {
    if (customQuestions.length === 0) { shareCardRef.current = null; return }
    const name = profileName.trim()
    fetch('/pwa-192x192.png')
      .then(r => r.blob())
      .then(b => generateShareCard(b, {
        title: name ? `${name}s Erinnerungen` : 'Meine Erinnerungen',
        items: customQuestions.map(q => q.text),
      }))
      .then(f => { shareCardRef.current = f })
      .catch(() => {})
  }, [customQuestions, profileName])

  function handleAdd() {
    if (!newText.trim()) return
    onAdd(newText.trim(), 'text')
    setNewText('')
  }

  function startAnswering(q: CustomQuestion) {
    setAnsweringId(q.id)
    setDraftAnswer(getAnswer(q.id))
  }

  function saveAnswer(q: CustomQuestion) {
    onSave(q.id, 'custom', draftAnswer)
    setAnsweringId(null)
  }

  // Synchronous handler – URL is built before any await so navigator.share()
  // is called directly inside the click gesture (required by Safari / iOS).
  function handleShare() {
    if (customQuestions.length === 0 || isSharing) return

    let url: string
    try {
      const memories = customQuestions.map(q => ({
        title: q.text,
        content: getAnswer(q.id).trim() || undefined,
      }))
      url = generateMemoryShareUrlSync({ memories, sharedBy: profileName || undefined })
    } catch {
      setShareStatus('error')
      return
    }
    const name = profileName.trim()
    const title = name ? `${name}s Erinnerungen` : 'Meine Erinnerungen'
    const text = `${title}\n\n${url}`

    setIsSharing(true)

    const card = shareCardRef.current
    if (card && typeof navigator.share === 'function') {
      if (navigator.canShare?.({ files: [card] })) {
        navigator
          .share({ files: [card], title, text })
          .then(() => setIsSharing(false))
          .catch(err => {
            setIsSharing(false)
            if ((err as Error).name !== 'AbortError') {
              navigator.clipboard?.writeText(url)
                .then(() => setShareStatus('copied'))
                .catch(() => setShareStatus('error'))
            }
          })
        return
      }
    }

    if (typeof navigator.share === 'function') {
      navigator
        .share({ title, text })
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

  function handleImport() {
    const pack = decodeQuestionPack(importCode.trim())
    if (!pack) {
      setImportMsg({ type: 'error', text: t.customQ.importFailed })
      return
    }
    onImport(pack.questions)
    setImportCode('')
    setImportMsg({ type: 'success', text: t.customQ.importSuccess.replace('{n}', String(pack.questions.length)) })
    setTimeout(() => setImportMsg(null), 3000)
  }

  return (
    <div className="custom-q-view">
      <img src="/categories/custom-banner.svg" className="quiz-banner" alt="" />
      <div className="archive-topbar">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>
          {t.global.back}
        </button>
        <h2 className="archive-title">{t.customQ.title}</h2>
      </div>

      <p className="friends-intro">{t.customQ.intro}</p>

      <section className="friends-section">
        <h3 className="friends-section-title">{t.customQ.addHeading}</h3>
        <div className="friends-add-row">
          <input
            className="input-text"
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder={t.customQ.titlePlaceholder}
            style={{ flex: 1 }}
          />
          <button className="btn btn--primary" onClick={handleAdd} disabled={!newText.trim()}>
            {t.customQ.addButton}
          </button>
        </div>
      </section>

      {customQuestions.length > 0 && (
        <section className="friends-section">
          <h3 className="friends-section-title">{t.customQ.listHeading}</h3>
          <div className="custom-q-list">
            {customQuestions.map(q => {
              const answer = getAnswer(q.id)
              const imageIds = getAnswerImageIds(q.id)
              const videoIds = getAnswerVideoIds(q.id)
              const audioId  = getAnswerAudioId(q.id)
              const hasMedia = imageIds.length > 0 || videoIds.length > 0 || !!audioId
              const isAnswering = answeringId === q.id

              async function handleAddImage(file: File) {
                const id = await addImage(file)
                onSetImages(q.id, 'custom', [...imageIds, id])
              }
              async function handleRemoveImage(id: string) {
                await removeImage(id)
                onSetImages(q.id, 'custom', imageIds.filter(i => i !== id))
              }
              async function handleAddVideo(file: File) {
                const id = await addVideo(file)
                onSetVideos(q.id, 'custom', [...videoIds, id])
              }
              async function handleRemoveVideo(id: string) {
                await removeVideo(id)
                onSetVideos(q.id, 'custom', videoIds.filter(v => v !== id))
              }
              async function handleSaveAudio(transcript: string, blob: Blob | null) {
                if (audioId) await removeAudio(audioId)
                const id = blob ? await addAudio(blob) : undefined
                onSetAudio(q.id, 'custom', id, new Date().toISOString(), transcript || undefined)
              }
              async function handleRemoveAudio() {
                if (audioId) await removeAudio(audioId)
                onSetAudio(q.id, 'custom', undefined, undefined)
              }

              return (
                <div key={q.id} className="custom-q-item">
                  <div className="custom-q-item__header">
                    <p className="custom-q-item__text">{q.text}</p>
                    <button
                      className="btn btn--ghost btn--sm custom-q-delete"
                      onClick={() => onRemove(q.id)}
                      aria-label={t.customQ.deleteAriaLabel}
                    >
                      ✕
                    </button>
                  </div>

                  {isAnswering ? (
                    <div className="custom-q-item__answer-form">
                      <textarea
                        className="input-textarea"
                        rows={5}
                        value={draftAnswer}
                        onChange={e => setDraftAnswer(e.target.value)}
                        autoFocus
                        placeholder={t.customQ.answerPlaceholder}
                        style={{ marginBottom: '0.6rem' }}
                      />
                      <MediaCapture
                        imageIds={imageIds}
                        imageCache={cache}
                        videoIds={videoIds}
                        audioId={audioId}
                        currentValue={draftAnswer}
                        onLoadImages={loadImages}
                        onAddImage={handleAddImage}
                        onRemoveImage={handleRemoveImage}
                        onAddVideo={handleAddVideo}
                        onRemoveVideo={handleRemoveVideo}
                        onSaveAudio={async (transcript, blob, replaceText) => {
                          await handleSaveAudio(transcript, blob)
                          if (replaceText && transcript.trim()) {
                            setDraftAnswer(transcript)
                          }
                        }}
                        onRemoveAudio={handleRemoveAudio}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                        <button
                          className="btn btn--primary btn--sm"
                          onClick={() => saveAnswer(q)}
                        >
                          {t.customQ.save}
                        </button>
                        <button
                          className="btn btn--ghost btn--sm"
                          onClick={() => setAnsweringId(null)}
                        >
                          {t.customQ.cancel}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="custom-q-item__answer-row">
                      {answer.trim() ? (
                        <p className="custom-q-item__answer">{answer}</p>
                      ) : !hasMedia ? (
                        <span className="custom-q-item__unanswered">{t.customQ.noAnswerYet}</span>
                      ) : null}
                      {hasMedia && !isAnswering && (
                        <span className="custom-q-item__media-badges">
                          {imageIds.length > 0 && <span>📷 {imageIds.length}</span>}
                          {videoIds.length > 0 && <span>🎬 {videoIds.length}</span>}
                          {audioId && <span>🎙 1</span>}
                        </span>
                      )}
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={() => startAnswering(q)}
                      >
                        {answer.trim() || hasMedia ? t.customQ.editLabel : t.customQ.enterLabel}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {customQuestions.length > 0 && (
        <section className="friends-section">
          <h3 className="friends-section-title">{t.customQ.shareHeading}</h3>
          <p className="friends-hint">{t.customQ.shareHint}</p>
          <div className="friends-share">
            <button
              className={`share-cta-btn${shareStatus === 'copied' ? ' share-cta-btn--success' : shareStatus === 'error' ? ' share-cta-btn--error' : ''}`}
              onClick={handleShare}
              disabled={isSharing}
            >
              {isSharing ? (
                <><span className="share-cta-btn__spinner" aria-hidden="true" />{t.customQ.opening}</>
              ) : shareStatus === 'copied' ? (
                t.customQ.linkCopied
              ) : shareStatus === 'error' ? (
                t.customQ.shareRetry
              ) : (
                t.customQ.shareCta
              )}
            </button>
          </div>
        </section>
      )}

      <section className="friends-section">
        <h3 className="friends-section-title">{t.customQ.importHeading}</h3>
        <textarea
          className="input-textarea"
          rows={3}
          value={importCode}
          onChange={e => setImportCode(e.target.value)}
          placeholder={t.customQ.importPlaceholder}
          style={{ marginBottom: '0.6rem' }}
        />
        {importMsg && (
          <p className={`import-msg import-msg--${importMsg.type}`} style={{ marginBottom: '0.6rem' }}>
            {importMsg.text}
          </p>
        )}
        <button
          className="btn btn--outline"
          onClick={handleImport}
          disabled={!importCode.trim()}
        >
          {t.customQ.importButton}
        </button>
      </section>
    </div>
  )
}

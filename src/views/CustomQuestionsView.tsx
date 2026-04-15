import { useState, useEffect } from 'react'
import { decodeQuestionPack } from '../utils/sharing'
import { generateMemoryShareUrl } from '../utils/secureLink'
import { useImageStore } from '../hooks/useImageStore'
import { addAudio, removeAudio } from '../hooks/useAudioStore'
import { addVideo, removeVideo } from '../hooks/useVideoStore'
import { MediaCapture } from '../components/MediaCapture'
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
  onSetAudio: (questionId: string, categoryId: string, audioId: string | undefined, audioTranscribedAt: string | undefined) => void
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
  const { cache, loadImages, addImage, removeImage } = useImageStore()
  const [newText, setNewText] = useState('')
  const [answeringId, setAnsweringId] = useState<string | null>(null)
  const [draftAnswer, setDraftAnswer] = useState('')
  const [importCode, setImportCode] = useState('')
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isSharing, setIsSharing] = useState(false)
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>('idle')

  // Auto-clear the "Kopiert!" / "Fehler" status after a moment
  useEffect(() => {
    if (shareStatus === 'idle') return
    const t = setTimeout(() => setShareStatus('idle'), 2500)
    return () => clearTimeout(t)
  }, [shareStatus])

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

  async function handleShare() {
    if (customQuestions.length === 0 || isSharing) return
    setIsSharing(true)
    try {
      const memories = customQuestions.map(q => ({
        title: q.text,
        content: getAnswer(q.id).trim() || undefined,
      }))
      const url = await generateMemoryShareUrl({ memories, sharedBy: profileName || undefined })
      const shareData = {
        title: 'Meine Erinnerungen',
        text: profileName
          ? `${profileName} hat Erinnerungen mit dir geteilt.`
          : 'Geteilte Erinnerungen',
        url,
      }
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share(shareData)
        } catch (e) {
          if ((e as Error).name === 'AbortError') return
          // share failed – fall back to clipboard
          await navigator.clipboard.writeText(url)
          setShareStatus('copied')
        }
      } else {
        await navigator.clipboard.writeText(url)
        setShareStatus('copied')
      }
    } catch {
      setShareStatus('error')
    } finally {
      setIsSharing(false)
    }
  }

  function handleImport() {
    const pack = decodeQuestionPack(importCode.trim())
    if (!pack) {
      setImportMsg({ type: 'error', text: 'Ungültiger Code. Bitte erneut versuchen.' })
      return
    }
    onImport(pack.questions)
    setImportCode('')
    setImportMsg({ type: 'success', text: `${pack.questions.length} Erinnerung(en) importiert.` })
    setTimeout(() => setImportMsg(null), 3000)
  }

  const answeredCount = customQuestions.filter(q => getAnswer(q.id).trim()).length

  return (
    <div className="custom-q-view">
      <img src="/categories/custom-banner.svg" className="quiz-banner" alt="" />
      <div className="archive-topbar">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>
          ← Zurück
        </button>
        <h2 className="archive-title">✏️ Eigene Erinnerungen</h2>
      </div>

      <p className="friends-intro">
        Halte hier deine eigenen Erinnerungen fest – gib ihnen einen Titel und schreibe auf, was du bewahren möchtest.
        {customQuestions.length > 0 && (
          <> {answeredCount}/{customQuestions.length} eingetragen.</>
        )}
      </p>

      {/* Add question */}
      <section className="friends-section">
        <h3 className="friends-section-title">Erinnerung hinzufügen</h3>
        <div className="friends-add-row">
          <input
            className="input-text"
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Titel der Erinnerung..."
            style={{ flex: 1 }}
          />
          <button className="btn btn--primary" onClick={handleAdd} disabled={!newText.trim()}>
            + Hinzufügen
          </button>
        </div>
      </section>

      {/* Question list */}
      {customQuestions.length > 0 && (
        <section className="friends-section">
          <h3 className="friends-section-title">Meine Erinnerungen</h3>
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
              async function handleSaveAudio(_transcript: string, blob: Blob) {
                if (audioId) await removeAudio(audioId)
                const id = await addAudio(blob)
                onSetAudio(q.id, 'custom', id, new Date().toISOString())
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
                      aria-label="Erinnerung löschen"
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
                        placeholder="Deine Erinnerung..."
                        style={{ marginBottom: '0.6rem' }}
                      />
                      <MediaCapture
                        imageIds={imageIds}
                        imageCache={cache}
                        videoIds={videoIds}
                        audioId={audioId}
                        onLoadImages={loadImages}
                        onAddImage={handleAddImage}
                        onRemoveImage={handleRemoveImage}
                        onAddVideo={handleAddVideo}
                        onRemoveVideo={handleRemoveVideo}
                        onSaveAudio={async (transcript, blob) => {
                          await handleSaveAudio(transcript, blob)
                          if (transcript.trim() && !draftAnswer.trim()) {
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
                          Speichern
                        </button>
                        <button
                          className="btn btn--ghost btn--sm"
                          onClick={() => setAnsweringId(null)}
                        >
                          Abbrechen
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="custom-q-item__answer-row">
                      {answer.trim() ? (
                        <p className="custom-q-item__answer">{answer}</p>
                      ) : !hasMedia ? (
                        <span className="custom-q-item__unanswered">Noch nichts eingetragen</span>
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
                        {answer.trim() || hasMedia ? '✎ Bearbeiten' : '+ Eintragen'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Share */}
      {customQuestions.length > 0 && (
        <section className="friends-section">
          <h3 className="friends-section-title">Erinnerungen teilen</h3>
          <p className="friends-hint">
            Teile die Erinnerung, sodass andere ihre Gedanken und Erinnerungen daran hinzufügen können.
          </p>
          <div className="friends-share">
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
                '🔗 Erinnerungen teilen'
              )}
            </button>
          </div>
        </section>
      )}

      {/* Import */}
      <section className="friends-section">
        <h3 className="friends-section-title">Erinnerungen importieren</h3>
        <p className="friends-hint">
          Hast du einen Erinnerungs-Code erhalten? Füge ihn hier ein.
        </p>
        <textarea
          className="input-textarea"
          rows={3}
          value={importCode}
          onChange={e => setImportCode(e.target.value)}
          placeholder="Code hier einfügen..."
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
          Importieren
        </button>
      </section>
    </div>
  )
}

import { useState, useEffect, useMemo } from 'react'
import { getCategoriesForLocale } from '../data/categories'
import { getFriendQuestionsForLocale } from '../data/friendQuestions'
import { ImageAttachment } from '../components/ImageAttachment'
import { VideoAttachment } from '../components/VideoAttachment'
import { AudioPlayer } from '../components/AudioPlayer'
import { MediaCapture } from '../components/MediaCapture'
import { useImageStore } from '../hooks/useImageStore'
import { addAudio, removeAudio } from '../hooks/useAudioStore'
import { addVideo, removeVideo } from '../hooks/useVideoStore'
import { useTranslation } from '../locales'
import type { Answer, FriendAnswer, Friend, CustomQuestion } from '../types'

interface Props {
  answers: Record<string, Answer>
  friendAnswers: FriendAnswer[]
  friends: Friend[]
  customQuestions: CustomQuestion[]
  profileName: string
  onSaveAnswer: (questionId: string, categoryId: string, value: string) => void
  onSetImages: (questionId: string, categoryId: string, imageIds: string[]) => void
  onSetVideos: (questionId: string, categoryId: string, videoIds: string[]) => void
  onSetAudio: (questionId: string, categoryId: string, audioId: string | undefined, audioTranscribedAt: string | undefined, audioTranscript?: string) => void
  onDeleteAnswer: (questionId: string) => void
  onDeleteEntry: (questionId: string) => void
  onBack: () => void
}

export function ArchiveView({
  answers,
  friendAnswers,
  friends,
  customQuestions,
  profileName,
  onSaveAnswer,
  onSetImages,
  onSetVideos,
  onSetAudio,
  onDeleteAnswer,
  onDeleteEntry,
  onBack,
}: Props) {
  const { t, locale } = useTranslation()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const { cache, loadImages, addImage, removeImage } = useImageStore()

  const friendQuestionsMap = useMemo(() => {
    return Object.fromEntries(getFriendQuestionsForLocale(locale).map(q => [
      q.id,
      q.text.replace(/\{name\}/g, profileName || 'dir')
    ]))
  }, [profileName, locale])

  const friendAnswersByFriendId = useMemo(() => {
    return friendAnswers.reduce((acc, a) => {
      const hasContent = a.value.trim() || (a.imageIds?.length ?? 0) > 0 || (a.videoIds?.length ?? 0) > 0 || !!a.audioId
      if (hasContent) {
        acc[a.friendId] = acc[a.friendId] || []
        acc[a.friendId].push(a)
      }
      return acc
    }, {} as Record<string, FriendAnswer[]>)
  }, [friendAnswers])

  useEffect(() => {
    const ownerIds  = Object.values(answers).flatMap(a => a.imageIds ?? [])
    const friendIds = friendAnswers.flatMap(a => a.imageIds ?? [])
    const allIds    = [...ownerIds, ...friendIds]
    if (allIds.length > 0) loadImages(allIds)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Image handlers ───────────────────────────────────────

  async function handleAddImage(questionId: string, categoryId: string, file: File) {
    const id = await addImage(file)
    const current = answers[questionId]?.imageIds ?? []
    onSetImages(questionId, categoryId, [...current, id])
  }

  async function handleRemoveImage(questionId: string, categoryId: string, imgId: string) {
    await removeImage(imgId)
    const next = (answers[questionId]?.imageIds ?? []).filter(i => i !== imgId)
    onSetImages(questionId, categoryId, next)
  }

  // ── Video handlers ───────────────────────────────────────

  async function handleAddVideo(questionId: string, categoryId: string, file: File) {
    const id = await addVideo(file)
    const current = answers[questionId]?.videoIds ?? []
    onSetVideos(questionId, categoryId, [...current, id])
  }

  async function handleRemoveVideo(questionId: string, categoryId: string, videoId: string) {
    await removeVideo(videoId)
    const next = (answers[questionId]?.videoIds ?? []).filter(v => v !== videoId)
    onSetVideos(questionId, categoryId, next)
  }

  // ── Edit handlers ────────────────────────────────────────

  function startEdit(questionId: string, currentValue: string) {
    setEditingId(questionId)
    setEditValue(currentValue)
  }

  function commitEdit(questionId: string, categoryId: string) {
    onSaveAnswer(questionId, categoryId, editValue)
    setEditingId(null)
  }

  // ── Audio handlers ───────────────────────────────────────

  async function handleSaveAudio(
    questionId: string,
    categoryId: string,
    transcript: string,
    blob: Blob | null,
    replaceText: boolean,
  ) {
    const oldId = answers[questionId]?.audioId
    if (oldId) await removeAudio(oldId)
    const newId = blob ? await addAudio(blob) : undefined
    onSetAudio(questionId, categoryId, newId, new Date().toISOString(), transcript || undefined)
    if (transcript.trim() && editingId === questionId && replaceText) {
      setEditValue(transcript)
    }
  }

  async function handleDeleteAudio(questionId: string, categoryId: string, audioId: string) {
    await removeAudio(audioId)
    onSetAudio(questionId, categoryId, undefined, undefined)
  }

  // ── Delete handlers ──────────────────────────────────────

  function handleDeleteAnswer(questionId: string) {
    if (!window.confirm(t.archiveView.confirmDeleteAnswer)) return
    onDeleteAnswer(questionId)
  }

  function handleDeleteEntry(questionId: string) {
    if (!window.confirm(t.archiveView.confirmDeleteEntry)) return
    onDeleteEntry(questionId)
  }

  // ── Helpers ──────────────────────────────────────────────

  function hasContent(questionId: string) {
    const a = answers[questionId]
    return a && (
      a.value.trim() !== '' ||
      (a.imageIds?.length ?? 0) > 0 ||
      (a.videoIds?.length ?? 0) > 0 ||
      !!a.audioId ||
      !!a.audioTranscript
    )
  }

  function displayDate(answer: Answer): string {
    const raw = answer.eventDate ?? answer.createdAt
    return new Date(raw).toLocaleDateString(locale === 'en' ? 'en-GB' : 'de-DE', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  }

  function wasEdited(answer: Answer): boolean {
    return answer.updatedAt !== answer.createdAt
  }

  // ── Derived lists ────────────────────────────────────────

  const categories = getCategoriesForLocale(locale)
  const categoriesWithAnswers = categories.filter(cat =>
    cat.questions.some(q => hasContent(q.id)),
  )
  const customWithAnswers = customQuestions.filter(q => hasContent(q.id))
  const friendsWithAnswers = friends.filter(f => {
    const fa = friendAnswersByFriendId[f.id]
    return fa && fa.length > 0
  })
  const hasAnything =
    categoriesWithAnswers.length > 0 ||
    customWithAnswers.length > 0 ||
    friendsWithAnswers.length > 0

  // ── Shared edit form ─────────────────────────────────────

  function renderEditForm(questionId: string, categoryId: string) {
    const answer = answers[questionId]
    return (
      <div className="archive-entry__edit-form">
        <textarea
          className="input-textarea"
          rows={3}
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          autoFocus
        />
        <MediaCapture
          imageIds={answer?.imageIds ?? []}
          imageCache={cache}
          videoIds={answer?.videoIds ?? []}
          audioId={answer?.audioId}
          currentValue={editValue}
          onLoadImages={loadImages}
          onAddImage={file => handleAddImage(questionId, categoryId, file)}
          onRemoveImage={imgId => handleRemoveImage(questionId, categoryId, imgId)}
          onAddVideo={file => handleAddVideo(questionId, categoryId, file)}
          onRemoveVideo={videoId => handleRemoveVideo(questionId, categoryId, videoId)}
          onSaveAudio={(transcript, blob, replaceText) =>
            handleSaveAudio(questionId, categoryId, transcript, blob, replaceText)
          }
          onRemoveAudio={() => handleDeleteAudio(questionId, categoryId, answer?.audioId!)}
        />
        <div className="archive-entry__edit-actions">
          <button
            className="btn btn--primary btn--sm"
            onClick={() => commitEdit(questionId, categoryId)}
          >
            {t.archiveView.save}
          </button>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => setEditingId(null)}
          >
            {t.archiveView.cancel}
          </button>
        </div>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────

  return (
    <div className="archive-view">
      <h1 className="sr-only">{t.archiveView.pageTitle}</h1>
      <div className="archive-topbar">
        <button className="btn btn--ghost btn--sm no-print" onClick={onBack}>
          {t.global.back}
        </button>
        <h2 className="archive-title">{t.archiveView.title}</h2>
      </div>

      {!hasAnything && (
        <p className="archive-empty">{t.archiveView.empty}</p>
      )}

      {/* ── Own answers grouped by category ── */}
      {categoriesWithAnswers.map(cat => (
        <section key={cat.id} className="archive-section">
          <h3 className="archive-section-title">
            {cat.emoji} {cat.title}
          </h3>
          {cat.questions
            .filter(q => hasContent(q.id))
            .map(q => (
              <div key={q.id} className="archive-entry">
                <p className="archive-entry__question">{q.text}</p>

                {editingId === q.id
                  ? renderEditForm(q.id, cat.id)
                  : (
                    <>
                      {answers[q.id].value && (
                        <p className="archive-entry__answer">{answers[q.id].value}</p>
                      )}
                      {(answers[q.id].imageIds?.length ?? 0) > 0 && (
                        <ImageAttachment
                          imageIds={answers[q.id].imageIds!}
                          cache={cache}
                          onLoad={loadImages}
                          onRemove={imgId => handleRemoveImage(q.id, cat.id, imgId)}
                        />
                      )}
                      <VideoAttachment
                        videoIds={answers[q.id].videoIds ?? []}
                        readOnly
                      />
                      {answers[q.id].audioId && (
                        <AudioPlayer audioId={answers[q.id].audioId!} />
                      )}
                      <div className="archive-entry__footer">
                        <span className="archive-entry__date">
                          {displayDate(answers[q.id])}
                          {wasEdited(answers[q.id]) && (
                            <span className="archive-entry__edited"> · {t.archiveView.edited}</span>
                          )}
                        </span>
                        <div className="archive-entry__actions no-print">
                          {answers[q.id].audioId && (
                            <button
                              className="archive-entry__delete-btn"
                              onClick={() => handleDeleteAudio(q.id, cat.id, answers[q.id].audioId!)}
                              aria-label={t.archiveView.deleteAudioAriaLabel}
                              title={t.archiveView.deleteAudioAriaLabel}
                            >
                              🎙✕
                            </button>
                          )}
                          <button
                            className="archive-entry__edit-btn"
                            onClick={() => startEdit(q.id, answers[q.id].value)}
                            aria-label={t.archiveView.editAnswerAriaLabel}
                          >
                            ✏️
                          </button>
                          <button
                            className="archive-entry__delete-btn"
                            onClick={() => handleDeleteAnswer(q.id)}
                            aria-label={t.archiveView.deleteAnswerAriaLabel}
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    </>
                  )}
              </div>
            ))}
        </section>
      ))}

      {/* ── Custom & imported entries ── */}
      {customWithAnswers.length > 0 && (
        <section className="archive-section">
          <h3 className="archive-section-title">{t.archiveView.customSectionTitle}</h3>
          {customWithAnswers.map(q => {
            const answer = answers[q.id]
            const src = answer.importSource
            return (
              <div key={q.id} className="archive-entry">
                {src && (
                  <span className="archive-entry__source-badge">
                    {src.platform === 'instagram' ? '📷 Instagram' : '📘 Facebook'}
                  </span>
                )}
                <p className="archive-entry__question">{q.text}</p>

                {editingId === q.id
                  ? renderEditForm(q.id, 'custom')
                  : (
                    <>
                      {answer.value && (
                        <p className="archive-entry__answer">{answer.value}</p>
                      )}
                      {(answer.imageIds?.length ?? 0) > 0 && (
                        <ImageAttachment
                          imageIds={answer.imageIds!}
                          cache={cache}
                          onLoad={loadImages}
                          onRemove={imgId => handleRemoveImage(q.id, 'custom', imgId)}
                        />
                      )}
                      <VideoAttachment
                        videoIds={answer.videoIds ?? []}
                        readOnly
                      />
                      {answer.audioId && (
                        <AudioPlayer audioId={answer.audioId} />
                      )}
                      <div className="archive-entry__footer">
                        <span className="archive-entry__date">
                          {displayDate(answer)}
                          {wasEdited(answer) && (
                            <span className="archive-entry__edited"> · {t.archiveView.edited}</span>
                          )}
                        </span>
                        <div className="archive-entry__actions no-print">
                          {answer.audioId && (
                            <button
                              className="archive-entry__delete-btn"
                              onClick={() => handleDeleteAudio(q.id, 'custom', answer.audioId!)}
                              aria-label={t.archiveView.deleteAudioAriaLabel}
                              title={t.archiveView.deleteAudioAriaLabel}
                            >
                              🎙✕
                            </button>
                          )}
                          <button
                            className="archive-entry__edit-btn"
                            onClick={() => startEdit(q.id, answer.value)}
                            aria-label={t.archiveView.editAnswerAriaLabel}
                          >
                            ✏️
                          </button>
                          <button
                            className="archive-entry__delete-btn"
                            onClick={() => handleDeleteEntry(q.id)}
                            aria-label={t.archiveView.deleteAnswerAriaLabel}
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    </>
                  )}
              </div>
            )
          })}
        </section>
      )}

      {/* ── Friend contributions ── */}
      {friendsWithAnswers.length > 0 && (
        <section className="archive-section archive-section--friends">
          <h3 className="archive-section-title archive-section-title--friends">
            {t.archiveView.friendsSectionTitle}
          </h3>
          {friendsWithAnswers.map(friend => {
            const thisAnswers = friendAnswersByFriendId[friend.id] || []
            return (
              <div key={friend.id} className="friend-contribution">
                <div className="friend-contribution__header">
                  <span className="friend-contribution__name">{friend.name}</span>
                  <span className="friend-contribution__count">
                    {thisAnswers.length} {t.profile.answersLabel}
                  </span>
                </div>
                {thisAnswers.map(a => {
                  const resolvedText = friendQuestionsMap[a.questionId]
                  const questionText =
                    a.questionText ??
                    resolvedText ??
                    t.archiveView.questionNotAvailable
                  return (
                    <div key={a.id} className="archive-entry archive-entry--friend">
                      <p className="archive-entry__question">{questionText}</p>
                      {a.value && <p className="archive-entry__answer">{a.value}</p>}
                      {(a.imageIds?.length ?? 0) > 0 && (
                        <ImageAttachment
                          imageIds={a.imageIds!}
                          cache={cache}
                          onLoad={loadImages}
                        />
                      )}
                      {(a.videoIds?.length ?? 0) > 0 && (
                        <VideoAttachment
                          videoIds={a.videoIds!}
                          readOnly
                        />
                      )}
                      {a.audioId && <AudioPlayer audioId={a.audioId} />}
                      <span className="archive-entry__date">
                        {new Date(a.createdAt).toLocaleDateString(locale === 'en' ? 'en-GB' : 'de-DE')}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </section>
      )}
    </div>
  )
}

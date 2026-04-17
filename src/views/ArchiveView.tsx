import { useState, useEffect, useRef, useMemo } from 'react'
import { CATEGORIES } from '../data/categories'
import { FRIEND_QUESTIONS } from '../data/friendQuestions'
import { ImageAttachment } from '../components/ImageAttachment'
import { VideoAttachment } from '../components/VideoAttachment'
import { AudioPlayer } from '../components/AudioPlayer'
import { AudioRecorder } from '../components/AudioRecorder'
import { useImageStore } from '../hooks/useImageStore'
import { addAudio, removeAudio } from '../hooks/useAudioStore'
import type { Answer, FriendAnswer, Friend, CustomQuestion } from '../types'

interface Props {
  answers: Record<string, Answer>
  friendAnswers: FriendAnswer[]
  friends: Friend[]
  customQuestions: CustomQuestion[]
  profileName: string
  onSaveAnswer: (questionId: string, categoryId: string, value: string) => void
  onSetImages: (questionId: string, categoryId: string, imageIds: string[]) => void
  onSetAudio: (questionId: string, categoryId: string, audioId: string | undefined, audioTranscribedAt: string | undefined) => void
  onDeleteAnswer: (questionId: string) => void
  onDeleteEntry: (questionId: string) => void   // removes custom Q + its answer
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
  onSetAudio,
  onDeleteAnswer,
  onDeleteEntry,
  onBack,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const { cache, loadImages, addImage, removeImage } = useImageStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  // remember which entry the "Add photo" picker was opened for
  const pendingTarget = useRef<{ questionId: string; categoryId: string } | null>(null)

  const friendQuestionsMap = useMemo(() => {
    return Object.fromEntries(FRIEND_QUESTIONS.map(q => [
      q.id,
      q.text.replace(/\{name\}/g, profileName || 'dir')
    ]))
  }, [profileName])

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

  // Pre-load all images (owner answers + friend answers)
  useEffect(() => {
    const ownerIds  = Object.values(answers).flatMap(a => a.imageIds ?? [])
    const friendIds = friendAnswers.flatMap(a => a.imageIds ?? [])
    const allIds    = [...ownerIds, ...friendIds]
    if (allIds.length > 0) loadImages(allIds)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Image handlers ───────────────────────────────────────

  function openImagePicker(questionId: string, categoryId: string) {
    pendingTarget.current = { questionId, categoryId }
    fileInputRef.current?.click()
  }

  async function handlePickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !pendingTarget.current) return
    const { questionId, categoryId } = pendingTarget.current
    const id = await addImage(file)
    const current = answers[questionId]?.imageIds ?? []
    onSetImages(questionId, categoryId, [...current, id])
    e.target.value = ''
    pendingTarget.current = null
  }

  async function handleRemoveImage(questionId: string, categoryId: string, imgId: string) {
    await removeImage(imgId)
    const next = (answers[questionId]?.imageIds ?? []).filter(i => i !== imgId)
    onSetImages(questionId, categoryId, next)
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
    blob: Blob,
  ) {
    const oldId = answers[questionId]?.audioId
    if (oldId) await removeAudio(oldId)
    const newId = await addAudio(blob)
    onSetAudio(questionId, categoryId, newId, new Date().toISOString())
    if (transcript.trim() && editingId === questionId) {
      setEditValue(prev => prev ? `${prev}\n\n${transcript}` : transcript)
    }
  }

  async function handleDeleteAudio(questionId: string, categoryId: string, audioId: string) {
    await removeAudio(audioId)
    onSetAudio(questionId, categoryId, undefined, undefined)
  }

  // ── Delete handlers ──────────────────────────────────────

  function handleDeleteAnswer(questionId: string) {
    if (!window.confirm('Diese Antwort wirklich löschen?')) return
    onDeleteAnswer(questionId)
  }

  function handleDeleteEntry(questionId: string) {
    if (!window.confirm('Diesen Eintrag wirklich löschen?')) return
    onDeleteEntry(questionId)
  }

  // ── Helpers ──────────────────────────────────────────────

  function hasContent(questionId: string) {
    const a = answers[questionId]
    return a && (a.value.trim() !== '' || (a.imageIds?.length ?? 0) > 0)
  }

  function displayDate(answer: Answer): string {
    const raw = answer.eventDate ?? answer.createdAt
    return new Date(raw).toLocaleDateString('de-DE', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  }

  function wasEdited(answer: Answer): boolean {
    return answer.updatedAt !== answer.createdAt
  }

  // ── Derived lists ────────────────────────────────────────

  const categoriesWithAnswers = CATEGORIES.filter(cat =>
    cat.questions.some(q => hasContent(q.id)),
  )
  const customWithAnswers = customQuestions.filter(q => hasContent(q.id))
  const friendsWithAnswers = friends.filter(f => {
    const answers = friendAnswersByFriendId[f.id]
    return answers && answers.length > 0
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
        {/* Images in edit mode */}
        {(answer?.imageIds?.length ?? 0) > 0 && (
          <ImageAttachment
            imageIds={answer.imageIds!}
            cache={cache}
            onLoad={loadImages}
            onRemove={imgId => handleRemoveImage(questionId, categoryId, imgId)}
          />
        )}
        <button
          type="button"
          className="archive-add-image-btn no-print"
          onClick={() => openImagePicker(questionId, categoryId)}
        >
          📷 Foto hinzufügen
        </button>
        {/* Audio in edit mode */}
        <AudioRecorder
          existingAudioId={answer?.audioId}
          onSave={(transcript, blob) =>
            handleSaveAudio(questionId, categoryId, transcript, blob)
          }
          onRemove={answer?.audioId
            ? () => handleDeleteAudio(questionId, categoryId, answer.audioId!)
            : undefined
          }
        />
        <div className="archive-entry__edit-actions">
          <button
            className="btn btn--primary btn--sm"
            onClick={() => commitEdit(questionId, categoryId)}
          >
            Speichern
          </button>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => setEditingId(null)}
          >
            Abbrechen
          </button>
        </div>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────

  return (
    <div className="archive-view">
      {/* Hidden file input shared across all edit forms */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handlePickImage}
      />

      <div className="archive-topbar">
        <button className="btn btn--ghost btn--sm no-print" onClick={onBack}>
          ← Zurück
        </button>
        <h2 className="archive-title">📖 Mein Vermächtnis</h2>
      </div>

      {!hasAnything && (
        <p className="archive-empty">
          Noch keine Antworten gespeichert. Starte mit einer Kategorie!
        </p>
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
                            <span className="archive-entry__edited"> · bearbeitet</span>
                          )}
                        </span>
                        <div className="archive-entry__actions no-print">
                          {answers[q.id].audioId && (
                            <button
                              className="archive-entry__delete-btn"
                              onClick={() => handleDeleteAudio(q.id, cat.id, answers[q.id].audioId!)}
                              aria-label="Aufnahme löschen"
                              title="Aufnahme löschen"
                            >
                              🎙✕
                            </button>
                          )}
                          <button
                            className="archive-entry__edit-btn"
                            onClick={() => startEdit(q.id, answers[q.id].value)}
                            aria-label="Antwort bearbeiten"
                          >
                            ✏️
                          </button>
                          <button
                            className="archive-entry__delete-btn"
                            onClick={() => handleDeleteAnswer(q.id)}
                            aria-label="Antwort löschen"
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
          <h3 className="archive-section-title">✏️ Eigene Fragen &amp; Erinnerungen</h3>
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
                            <span className="archive-entry__edited"> · bearbeitet</span>
                          )}
                        </span>
                        <div className="archive-entry__actions no-print">
                          {answer.audioId && (
                            <button
                              className="archive-entry__delete-btn"
                              onClick={() => handleDeleteAudio(q.id, 'custom', answer.audioId!)}
                              aria-label="Aufnahme löschen"
                              title="Aufnahme löschen"
                            >
                              🎙✕
                            </button>
                          )}
                          <button
                            className="archive-entry__edit-btn"
                            onClick={() => startEdit(q.id, answer.value)}
                            aria-label="Eintrag bearbeiten"
                          >
                            ✏️
                          </button>
                          <button
                            className="archive-entry__delete-btn"
                            onClick={() => handleDeleteEntry(q.id)}
                            aria-label="Eintrag löschen"
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
            👥 Was Freunde über mich sagen
          </h3>
          {friendsWithAnswers.map(friend => {
            const thisAnswers = friendAnswersByFriendId[friend.id] || []
            return (
              <div key={friend.id} className="friend-contribution">
                <div className="friend-contribution__header">
                  <span className="friend-contribution__name">{friend.name}</span>
                  <span className="friend-contribution__count">
                    {thisAnswers.length} Antworten
                  </span>
                </div>
                {thisAnswers.map(a => {
                  const resolvedText = friendQuestionsMap[a.questionId]
                  const questionText =
                    a.questionText ??
                    resolvedText ??
                    'Frage nicht mehr verfügbar'
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
                        {new Date(a.createdAt).toLocaleDateString('de-DE')}
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

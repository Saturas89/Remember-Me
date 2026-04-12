import { useState, useEffect } from 'react'
import { CATEGORIES } from '../data/categories'
import { FRIEND_QUESTIONS } from '../data/friendQuestions'
import { exportAsMarkdown, exportAsEnrichedJSON, downloadFile } from '../utils/export'
import { ImageAttachment } from '../components/ImageAttachment'
import { useImageStore } from '../hooks/useImageStore'
import type { Answer, FriendAnswer, Friend, CustomQuestion, Profile } from '../types'

interface Props {
  profile: Profile | null
  answers: Record<string, Answer>
  friendAnswers: FriendAnswer[]
  friends: Friend[]
  customQuestions: CustomQuestion[]
  profileName: string
  onSaveAnswer: (questionId: string, categoryId: string, value: string) => void
  onSetImages: (questionId: string, categoryId: string, imageIds: string[]) => void
  onBack: () => void
}

export function ArchiveView({
  profile,
  answers,
  friendAnswers,
  friends,
  customQuestions,
  profileName,
  onSaveAnswer,
  onSetImages,
  onBack,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const { cache, loadImages, removeImage } = useImageStore()

  // Pre-load all images referenced by any answer
  useEffect(() => {
    const allIds = Object.values(answers).flatMap(a => a.imageIds ?? [])
    if (allIds.length > 0) loadImages(allIds)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleRemoveImage(questionId: string, categoryId: string, imgId: string) {
    await removeImage(imgId)
    const next = (answers[questionId]?.imageIds ?? []).filter(i => i !== imgId)
    onSetImages(questionId, categoryId, next)
  }

  const exportData = { profile, answers, friends, friendAnswers, customQuestions }
  const safeName = (profile?.name ?? 'lebensarchiv').replace(/\s+/g, '-').toLowerCase()

  function handleMarkdownExport() {
    downloadFile(exportAsMarkdown(exportData), `${safeName}.md`, 'text/markdown')
  }

  function handleJsonExport() {
    downloadFile(exportAsEnrichedJSON(exportData), `${safeName}.json`, 'application/json')
  }

  function startEdit(questionId: string, currentValue: string) {
    setEditingId(questionId)
    setEditValue(currentValue)
  }

  function commitEdit(questionId: string, categoryId: string) {
    onSaveAnswer(questionId, categoryId, editValue)
    setEditingId(null)
  }

  function hasContent(questionId: string) {
    const a = answers[questionId]
    return a && (a.value.trim() !== '' || (a.imageIds?.length ?? 0) > 0)
  }

  const categoriesWithAnswers = CATEGORIES.filter(cat =>
    cat.questions.some(q => hasContent(q.id)),
  )

  const customWithAnswers = customQuestions.filter(q => hasContent(q.id))

  // Group friend answers by friend
  const friendsWithAnswers = friends.filter(f =>
    friendAnswers.some(a => a.friendId === f.id && a.value.trim()),
  )

  const hasAnything =
    categoriesWithAnswers.length > 0 ||
    customWithAnswers.length > 0 ||
    friendsWithAnswers.length > 0

  return (
    <div className="archive-view">
      <div className="archive-topbar">
        <button className="btn btn--ghost btn--sm no-print" onClick={onBack}>
          ← Zurück
        </button>
        <h2 className="archive-title">📖 Mein Lebensarchiv</h2>
        <div className="archive-export-group no-print">
          <button
            className="btn btn--ghost btn--sm"
            onClick={handleMarkdownExport}
            title="Als Markdown-Datei herunterladen (ideal für KI-Tools)"
          >
            📄 .md
          </button>
          <button
            className="btn btn--ghost btn--sm"
            onClick={handleJsonExport}
            title="Als JSON-Datei herunterladen (strukturierter Export)"
          >
            {'{ }'} JSON
          </button>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => window.print()}
            title="Als PDF speichern / Drucken"
          >
            🖨
          </button>
        </div>
      </div>

      {!hasAnything && (
        <p className="archive-empty">
          Noch keine Antworten gespeichert. Starte mit einer Kategorie!
        </p>
      )}

      {/* Own answers grouped by category */}
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

                {editingId === q.id ? (
                  <div className="archive-entry__edit-form">
                    <textarea
                      className="input-textarea"
                      rows={3}
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      autoFocus
                    />
                    <div className="archive-entry__edit-actions">
                      <button
                        className="btn btn--primary btn--sm"
                        onClick={() => commitEdit(q.id, cat.id)}
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
                ) : (
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
                    <div className="archive-entry__footer">
                      <span className="archive-entry__date">
                        {new Date(answers[q.id].updatedAt).toLocaleDateString('de-DE')}
                      </span>
                      <button
                        className="archive-entry__edit-btn no-print"
                        onClick={() => startEdit(q.id, answers[q.id].value)}
                        aria-label="Antwort bearbeiten"
                      >
                        ✎
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
        </section>
      ))}

      {/* Custom question answers */}
      {customWithAnswers.length > 0 && (
        <section className="archive-section">
          <h3 className="archive-section-title">✏️ Eigene Fragen</h3>
          {customWithAnswers.map(q => (
            <div key={q.id} className="archive-entry">
              <p className="archive-entry__question">{q.text}</p>

              {editingId === q.id ? (
                <div className="archive-entry__edit-form">
                  <textarea
                    className="input-textarea"
                    rows={3}
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    autoFocus
                  />
                  <div className="archive-entry__edit-actions">
                    <button
                      className="btn btn--primary btn--sm"
                      onClick={() => commitEdit(q.id, 'custom')}
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
              ) : (
                <>
                  {answers[q.id].value && (
                    <p className="archive-entry__answer">{answers[q.id].value}</p>
                  )}
                  {(answers[q.id].imageIds?.length ?? 0) > 0 && (
                    <ImageAttachment
                      imageIds={answers[q.id].imageIds!}
                      cache={cache}
                      onLoad={loadImages}
                      onRemove={imgId => handleRemoveImage(q.id, 'custom', imgId)}
                    />
                  )}
                  <div className="archive-entry__footer">
                    <span className="archive-entry__date">
                      {new Date(answers[q.id].updatedAt).toLocaleDateString('de-DE')}
                    </span>
                    <button
                      className="archive-entry__edit-btn no-print"
                      onClick={() => startEdit(q.id, answers[q.id].value)}
                      aria-label="Antwort bearbeiten"
                    >
                      ✎
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Friend contributions */}
      {friendsWithAnswers.length > 0 && (
        <section className="archive-section archive-section--friends">
          <h3 className="archive-section-title archive-section-title--friends">
            👥 Was Freunde über mich sagen
          </h3>
          {friendsWithAnswers.map(friend => {
            const thisAnswers = friendAnswers.filter(
              a => a.friendId === friend.id && a.value.trim(),
            )
            return (
              <div key={friend.id} className="friend-contribution">
                <div className="friend-contribution__header">
                  <span className="friend-contribution__name">{friend.name}</span>
                  <span className="friend-contribution__count">
                    {thisAnswers.length} Antworten
                  </span>
                </div>
                {thisAnswers.map(a => {
                  // 1. Use the text stored at import time (already name-resolved)
                  // 2. Fall back to static lookup + name substitution (current IDs)
                  // 3. Last resort: show a placeholder instead of a raw technical ID
                  const q = FRIEND_QUESTIONS.find(fq => fq.id === a.questionId)
                  const questionText =
                    a.questionText ??
                    q?.text.replace(/\{name\}/g, profileName || 'dir') ??
                    'Frage nicht mehr verfügbar'
                  return (
                    <div key={a.id} className="archive-entry archive-entry--friend">
                      <p className="archive-entry__question">{questionText}</p>
                      <p className="archive-entry__answer">{a.value}</p>
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

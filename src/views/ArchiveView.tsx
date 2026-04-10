import { useState } from 'react'
import { CATEGORIES } from '../data/categories'
import { FRIEND_QUESTIONS } from '../data/friendQuestions'
import type { Answer, FriendAnswer, Friend, CustomQuestion } from '../types'

interface Props {
  answers: Record<string, Answer>
  friendAnswers: FriendAnswer[]
  friends: Friend[]
  customQuestions: CustomQuestion[]
  profileName: string
  onSaveAnswer: (questionId: string, categoryId: string, value: string) => void
  onBack: () => void
}

export function ArchiveView({
  answers,
  friendAnswers,
  friends,
  customQuestions,
  profileName,
  onSaveAnswer,
  onBack,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  function startEdit(questionId: string, currentValue: string) {
    setEditingId(questionId)
    setEditValue(currentValue)
  }

  function commitEdit(questionId: string, categoryId: string) {
    onSaveAnswer(questionId, categoryId, editValue)
    setEditingId(null)
  }

  const categoriesWithAnswers = CATEGORIES.filter(cat =>
    cat.questions.some(q => answers[q.id]?.value.trim()),
  )

  const customWithAnswers = customQuestions.filter(q => answers[q.id]?.value.trim())

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
        <button
          className="btn btn--ghost btn--sm no-print"
          onClick={() => window.print()}
          title="Als PDF speichern / Drucken"
        >
          🖨 Drucken
        </button>
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
            .filter(q => answers[q.id]?.value.trim())
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
                    <p className="archive-entry__answer">{answers[q.id].value}</p>
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
                  <p className="archive-entry__answer">{answers[q.id].value}</p>
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
                  const q = FRIEND_QUESTIONS.find(fq => fq.id === a.questionId)
                  const questionText = (q?.text ?? a.questionId).replace(
                    /\{name\}/g,
                    profileName || 'dir',
                  )
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

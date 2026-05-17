import { useState } from 'react'
import type { SandraFlowStrings } from '../../i18n/de/sandraFlow'
import type { ComposedQuestion, SandraAnchor } from '../../types/sandraFlow'

interface Props {
  t: SandraFlowStrings
  anchor: SandraAnchor
  questions: ComposedQuestion[]
  onBack: () => void
  onAddAnother: () => void
  onEdit: (id: string, text: string) => void
  onDelete: (id: string) => void
  onMove: (id: string, delta: 1 | -1) => void
  onSend: () => void
}

export function SandraQuestionListStep({
  t,
  anchor,
  questions,
  onBack,
  onAddAnother,
  onEdit,
  onDelete,
  onMove,
  onSend,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  function startEdit(q: ComposedQuestion) {
    setEditingId(q.id)
    setEditText(q.text)
  }

  function commitEdit() {
    if (!editingId) return
    if (!editText.trim()) return
    onEdit(editingId, editText.trim())
    setEditingId(null)
  }

  function confirmDelete() {
    if (!pendingDeleteId) return
    onDelete(pendingDeleteId)
    setPendingDeleteId(null)
  }

  return (
    <div className="sandra-flow-view">
      <div className="quiz-topbar">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>
          {t.back}
        </button>
      </div>

      <section className="friends-section">
        <h2 className="friends-section-title">
          {t.list.title.replace('{anrede}', anchor.anrede)}
        </h2>

        {questions.length === 0 && (
          <p className="friends-hint">{t.list.emptyHint}</p>
        )}

        <div className="friends-list">
          {questions.map((q, idx) => (
            <div key={q.id} className="friend-card sandra-question-row">
              {editingId === q.id ? (
                <div className="sandra-question-row__edit">
                  <textarea
                    className="input-textarea"
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    rows={3}
                    aria-label={t.list.editAria}
                    autoFocus
                  />
                  <div className="sandra-question-row__actions">
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => setEditingId(null)}
                    >
                      ✕
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={commitEdit}
                      disabled={!editText.trim()}
                    >
                      ✓
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="sandra-question-row__body">
                    <span className="sandra-question-row__text">{q.text}</span>
                    <span className="friends-tag sandra-question-row__chip">
                      {q.group === 'relationship'
                        ? t.trigger.sectionAboutUs
                        : t.trigger.sectionAboutThem.replace('{anrede}', anchor.anrede)}
                    </span>
                  </div>
                  <div className="sandra-question-row__actions">
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => onMove(q.id, -1)}
                      disabled={idx === 0}
                      aria-label={t.list.moveUpAria}
                      title={t.list.moveUpAria}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => onMove(q.id, 1)}
                      disabled={idx === questions.length - 1}
                      aria-label={t.list.moveDownAria}
                      title={t.list.moveDownAria}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => startEdit(q)}
                      aria-label={t.list.editAria}
                      title={t.list.editAria}
                      data-testid={`sandra-list-edit-${q.id}`}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => setPendingDeleteId(q.id)}
                      aria-label={t.list.deleteAria}
                      title={t.list.deleteAria}
                      data-testid={`sandra-list-delete-${q.id}`}
                    >
                      🗑
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="sandra-list-footer">
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={onAddAnother}
          data-testid="sandra-list-add-another"
        >
          {t.list.addAnother}
        </button>
        <button
          type="button"
          className="share-cta-btn"
          onClick={onSend}
          disabled={questions.length === 0}
          data-testid="sandra-list-send"
        >
          {t.list.send.replace('{anrede}', anchor.anrede)}
        </button>
      </div>

      {pendingDeleteId && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          data-testid="sandra-delete-confirm-modal"
        >
          <div className="modal-box">
            <p className="modal-box__title">{t.list.confirmDelete}</p>
            <div className="modal-box__actions">
              <button
                type="button"
                className="btn btn--danger btn--full"
                onClick={confirmDelete}
                data-testid="sandra-delete-confirm-ok"
              >
                {t.list.confirmDeleteConfirm}
              </button>
              <button
                type="button"
                className="btn btn--secondary btn--full"
                onClick={() => setPendingDeleteId(null)}
                data-testid="sandra-delete-confirm-cancel"
              >
                {t.list.confirmDeleteCancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

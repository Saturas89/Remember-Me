import { useState } from 'react'
import { encodeQuestionPack, decodeQuestionPack } from '../utils/sharing'
import type { CustomQuestion, QuestionPack } from '../types'

interface Props {
  customQuestions: CustomQuestion[]
  profileName: string
  getAnswer: (questionId: string) => string
  onSave: (questionId: string, categoryId: string, value: string) => void
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
  onSave,
  onAdd,
  onRemove,
  onImport,
  onBack,
}: Props) {
  const [newText, setNewText] = useState('')
  const [answeringId, setAnsweringId] = useState<string | null>(null)
  const [draftAnswer, setDraftAnswer] = useState('')
  const [shareCode, setShareCode] = useState<string | null>(null)
  const [importCode, setImportCode] = useState('')
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [copied, setCopied] = useState(false)

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

  function handleShare() {
    if (customQuestions.length === 0) return
    const pack: QuestionPack = {
      questions: customQuestions,
      createdBy: profileName || undefined,
    }
    setShareCode(encodeQuestionPack(pack))
  }

  function handleCopy() {
    if (!shareCode) return
    navigator.clipboard.writeText(shareCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleImport() {
    const pack = decodeQuestionPack(importCode.trim())
    if (!pack) {
      setImportMsg({ type: 'error', text: 'Ungültiger Code. Bitte erneut versuchen.' })
      return
    }
    onImport(pack.questions)
    setImportCode('')
    setImportMsg({ type: 'success', text: `${pack.questions.length} Frage(n) importiert.` })
    setTimeout(() => setImportMsg(null), 3000)
  }

  const answeredCount = customQuestions.filter(q => getAnswer(q.id).trim()).length

  return (
    <div className="custom-q-view">
      <img src="/categories/custom-banner.webp" className="quiz-banner" alt="" />
      <div className="archive-topbar">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>
          ← Zurück
        </button>
        <h2 className="archive-title">✏️ Eigene Fragen</h2>
      </div>

      <p className="friends-intro">
        Erstelle deine eigenen Fragen, beantworte sie und teile sie mit anderen.
        {customQuestions.length > 0 && (
          <> {answeredCount}/{customQuestions.length} beantwortet.</>
        )}
      </p>

      {/* Add question */}
      <section className="friends-section">
        <h3 className="friends-section-title">Frage hinzufügen</h3>
        <div className="friends-add-row">
          <input
            className="input-text"
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Deine Frage..."
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
          <h3 className="friends-section-title">Meine Fragen</h3>
          <div className="custom-q-list">
            {customQuestions.map(q => {
              const answer = getAnswer(q.id)
              const isAnswering = answeringId === q.id
              return (
                <div key={q.id} className="custom-q-item">
                  <div className="custom-q-item__header">
                    <p className="custom-q-item__text">{q.text}</p>
                    <button
                      className="btn btn--ghost btn--sm custom-q-delete"
                      onClick={() => onRemove(q.id)}
                      aria-label="Frage löschen"
                    >
                      ✕
                    </button>
                  </div>

                  {isAnswering ? (
                    <div className="custom-q-item__answer-form">
                      <textarea
                        className="input-textarea"
                        rows={3}
                        value={draftAnswer}
                        onChange={e => setDraftAnswer(e.target.value)}
                        autoFocus
                        placeholder="Deine Antwort..."
                        style={{ marginBottom: '0.6rem' }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
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
                      ) : (
                        <span className="custom-q-item__unanswered">Noch nicht beantwortet</span>
                      )}
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={() => startAnswering(q)}
                      >
                        {answer.trim() ? '✎ Bearbeiten' : '+ Antworten'}
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
          <h3 className="friends-section-title">Fragen teilen</h3>
          <p className="friends-hint">
            Generiere einen Code, den andere importieren können, um dieselben Fragen zu beantworten.
          </p>
          {!shareCode ? (
            <button className="btn btn--outline" onClick={handleShare}>
              Code generieren
            </button>
          ) : (
            <div className="invite-box">
              <p className="invite-box__label">Dein Fragen-Code:</p>
              <div className="export-code">{shareCode}</div>
              <div className="invite-box__actions" style={{ marginTop: '0.75rem' }}>
                <button className="btn btn--primary btn--sm" onClick={handleCopy}>
                  {copied ? '✓ Kopiert' : 'Kopieren'}
                </button>
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => setShareCode(null)}
                >
                  Schließen
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Import */}
      <section className="friends-section">
        <h3 className="friends-section-title">Fragen importieren</h3>
        <p className="friends-hint">
          Hast du einen Fragen-Code erhalten? Füge ihn hier ein.
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

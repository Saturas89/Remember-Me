import { CATEGORIES } from '../data/categories'
import type { Answer } from '../types'

interface Props {
  answers: Record<string, Answer>
  onBack: () => void
}

export function ArchiveView({ answers, onBack }: Props) {
  const categoriesWithAnswers = CATEGORIES.filter(cat =>
    cat.questions.some(q => answers[q.id]?.value.trim()),
  )

  return (
    <div className="archive-view">
      <div className="archive-topbar">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>
          ← Zurück
        </button>
        <h2 className="archive-title">📖 Mein Lebensarchiv</h2>
      </div>

      {categoriesWithAnswers.length === 0 ? (
        <p className="archive-empty">Noch keine Antworten gespeichert. Starte mit einer Kategorie!</p>
      ) : (
        categoriesWithAnswers.map(cat => (
          <section key={cat.id} className="archive-section">
            <h3 className="archive-section-title">
              {cat.emoji} {cat.title}
            </h3>
            {cat.questions
              .filter(q => answers[q.id]?.value.trim())
              .map(q => (
                <div key={q.id} className="archive-entry">
                  <p className="archive-entry__question">{q.text}</p>
                  <p className="archive-entry__answer">{answers[q.id].value}</p>
                  <span className="archive-entry__date">
                    {new Date(answers[q.id].updatedAt).toLocaleDateString('de-DE')}
                  </span>
                </div>
              ))}
          </section>
        ))
      )}
    </div>
  )
}

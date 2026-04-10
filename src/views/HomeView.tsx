import { CATEGORIES } from '../data/categories'
import { CategoryCard } from '../components/CategoryCard'

interface Props {
  getCategoryProgress: (categoryId: string, total: number) => number
  onSelectCategory: (categoryId: string) => void
  onOpenArchive: () => void
  profileName: string
}

export function HomeView({ getCategoryProgress, onSelectCategory, onOpenArchive, profileName }: Props) {
  const totalQuestions = CATEGORIES.reduce((s, c) => s + c.questions.length, 0)
  const totalAnswered = CATEGORIES.reduce(
    (s, c) => s + Math.round((getCategoryProgress(c.id, c.questions.length) / 100) * c.questions.length),
    0,
  )
  const overallProgress = Math.round((totalAnswered / totalQuestions) * 100)

  return (
    <div className="home-view">
      <header className="home-header">
        <h1 className="home-title">Remember Me</h1>
        <p className="home-subtitle">
          {profileName
            ? `Hallo, ${profileName} – schön, dass du weiter machst.`
            : 'Halte deine Geschichte fest – für alle, die nach dir kommen.'}
        </p>
        <div className="home-overall">
          <span>{overallProgress}% deiner Geschichte erzählt</span>
          <div className="home-overall-bar">
            <div className="home-overall-fill" style={{ width: `${overallProgress}%` }} />
          </div>
        </div>
      </header>

      <section className="categories-grid">
        {CATEGORIES.map(cat => (
          <CategoryCard
            key={cat.id}
            category={cat}
            progress={getCategoryProgress(cat.id, cat.questions.length)}
            onClick={() => onSelectCategory(cat.id)}
          />
        ))}
      </section>

      {totalAnswered > 0 && (
        <div className="home-archive-hint">
          <button className="btn btn--outline" onClick={onOpenArchive}>
            📖 Mein Lebensarchiv ansehen ({totalAnswered} Antworten)
          </button>
        </div>
      )}
    </div>
  )
}

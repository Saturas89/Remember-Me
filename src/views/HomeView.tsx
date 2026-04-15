import { CATEGORIES } from '../data/categories'
import { CategoryCard } from '../components/CategoryCard'
import { HeroLogo } from '../components/Logo'
import type { Friend, FriendAnswer, CustomQuestion } from '../types'

interface Props {
  profileName: string
  friends: Friend[]
  friendAnswers: FriendAnswer[]
  customQuestions: CustomQuestion[]
  getCategoryProgress: (categoryId: string, total: number) => number
  onSelectCategory: (categoryId: string) => void
  onOpenFaq: () => void
}

export function HomeView({
  profileName,
  friends,
  friendAnswers,
  customQuestions,
  getCategoryProgress,
  onSelectCategory,
  onOpenFaq,
}: Props) {
  const totalQuestions = CATEGORIES.reduce((s, c) => s + c.questions.length, 0)
  const totalAnswered = CATEGORIES.reduce(
    (s, c) =>
      s + Math.round((getCategoryProgress(c.id, c.questions.length) / 100) * c.questions.length),
    0,
  )
  const overallProgress = Math.round((totalAnswered / totalQuestions) * 100)

  void friends
  void friendAnswers

  return (
    <div className="home-view">
      <header className="home-header">
        <button
          type="button"
          className="home-faq-btn"
          onClick={onOpenFaq}
          aria-label="Hilfe & FAQ"
          title="Hilfe & FAQ"
        >
          ?
        </button>
        <HeroLogo />
        {profileName && (
          <p className="home-greeting">Hallo, {profileName}</p>
        )}
        {overallProgress > 0 && (
          <div className="home-overall">
            <span>{overallProgress}% deiner Geschichte erzählt</span>
            <div className="home-overall-bar">
              <div className="home-overall-fill" style={{ width: `${overallProgress}%` }} />
            </div>
          </div>
        )}
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
        {/* Custom questions as a special category card */}
        <button
          type="button"
          className="category-card category-card--custom"
          onClick={() => onSelectCategory('custom')}
        >
          <img src="/categories/custom-preview.svg" className="category-card__image" alt="" />
          <div className="category-card__body">
            <h3 className="category-card__title">Eigene Erinnerung</h3>
            <p className="category-card__desc">
              {customQuestions.length > 0
                ? 'Deine Erinnerungen – teile sie und lass Liebste deine Geschichte ergänzen'
                : 'Was hat dich geprägt? Halte es fest – und lade Liebste ein, deine Geschichte zu bereichern'}
            </p>
          </div>
        </button>
      </section>
    </div>
  )
}

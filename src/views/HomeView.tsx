import { CATEGORIES } from '../data/categories'
import { getCategoriesForLocale } from '../data/categories'
import { useTranslation } from '../locales'
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
  const { t, locale } = useTranslation()
  const categories = getCategoriesForLocale(locale)
  void CATEGORIES
  const totalQuestions = categories.reduce((s, c) => s + c.questions.length, 0)
  const totalAnswered = categories.reduce(
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
          aria-label={t.home.faqAriaLabel}
          title={t.home.faqAriaLabel}
        >
          ?
        </button>
        <HeroLogo />
        <h1 className="sr-only">{t.home.appTitle}</h1>
        {profileName && (
          <p className="home-greeting">{t.home.greeting.replace('{name}', profileName)}</p>
        )}
        {overallProgress > 0 && (
          <div className="home-overall">
            <span>{t.home.progress.replace('{pct}', String(overallProgress))}</span>
            <div className="home-overall-bar">
              <div className="home-overall-fill" style={{ width: `${overallProgress}%` }} />
            </div>
          </div>
        )}
      </header>

      <section className="categories-grid">
        {categories.map(cat => (
          <CategoryCard
            key={cat.id}
            category={cat}
            progress={getCategoryProgress(cat.id, cat.questions.length)}
            onClick={() => onSelectCategory(cat.id)}
          />
        ))}
        <button
          type="button"
          className="category-card category-card--custom"
          onClick={() => onSelectCategory('custom')}
        >
          <img src="/categories/custom-preview.svg" className="category-card__image" alt={t.home.customCatImgAlt} />
          <div className="category-card__body">
            <h3 className="category-card__title">{t.home.customCatTitle}</h3>
            <p className="category-card__desc">
              {customQuestions.length > 0 ? t.home.customCatDesc : t.home.customCatDescEmpty}
            </p>
          </div>
        </button>
      </section>
    </div>
  )
}

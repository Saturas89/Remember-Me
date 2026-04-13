import { ProgressBar } from './ProgressBar'
import type { Category } from '../types'

interface Props {
  category: Category
  progress: number  // 0–100
  onClick: () => void
}

export function CategoryCard({ category, progress, onClick }: Props) {
  const done = progress === 100
  return (
    <button className={`category-card ${done ? 'category-card--done' : ''}`} onClick={onClick}>
      <img src={`/categories/${category.id}-preview.svg`} className="category-card__image" alt="" />
      <div className="category-card__body">
        <h3 className="category-card__title">{category.title}</h3>
        <p className="category-card__desc">{category.description}</p>
        <ProgressBar value={progress} label={`${progress}% beantwortet`} />
      </div>
      {done && <span className="category-card__badge">✓</span>}
    </button>
  )
}

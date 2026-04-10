import { useState } from 'react'
import { QuestionCard } from '../components/QuestionCard'
import { ProgressBar } from '../components/ProgressBar'
import type { Category } from '../types'

interface Props {
  category: Category
  getAnswer: (questionId: string) => string
  onSave: (questionId: string, categoryId: string, value: string) => void
  onBack: () => void
}

export function QuizView({ category, getAnswer, onSave, onBack }: Props) {
  const [index, setIndex] = useState(0)
  const question = category.questions[index]
  const progress = Math.round(((index) / category.questions.length) * 100)

  function handleSave(value: string) {
    onSave(question.id, category.id, value)
  }

  function handleNext() {
    if (index + 1 < category.questions.length) {
      setIndex(i => i + 1)
    } else {
      onBack()
    }
  }

  return (
    <div className="quiz-view">
      <div className="quiz-topbar">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>
          ← Kategorien
        </button>
        <span className="quiz-category-title">
          {category.emoji} {category.title}
        </span>
      </div>

      <ProgressBar value={progress} />

      <QuestionCard
        question={question}
        initialValue={getAnswer(question.id)}
        index={index}
        total={category.questions.length}
        onSave={handleSave}
        onNext={handleNext}
        onPrev={() => setIndex(i => Math.max(0, i - 1))}
        canGoBack={index > 0}
      />
    </div>
  )
}

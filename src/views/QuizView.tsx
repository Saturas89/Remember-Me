import { useState } from 'react'
import { QuestionCard } from '../components/QuestionCard'
import { ProgressBar } from '../components/ProgressBar'
import { useImageStore } from '../hooks/useImageStore'
import type { Category } from '../types'

interface Props {
  category: Category
  getAnswer: (questionId: string) => string
  getAnswerImageIds: (questionId: string) => string[]
  onSave: (questionId: string, categoryId: string, value: string) => void
  onSetImages: (questionId: string, categoryId: string, imageIds: string[]) => void
  onBack: () => void
}

export function QuizView({ category, getAnswer, getAnswerImageIds, onSave, onSetImages, onBack }: Props) {
  const [index, setIndex] = useState(0)
  const { cache, loadImages, addImage, removeImage } = useImageStore()
  const question = category.questions[index]
  const progress = Math.round((index / category.questions.length) * 100)
  const imageIds = getAnswerImageIds(question.id)

  function handleSave(value: string) {
    onSave(question.id, category.id, value)
  }

  async function handleAddImage(file: File) {
    const id = await addImage(file)
    onSetImages(question.id, category.id, [...imageIds, id])
  }

  async function handleRemoveImage(id: string) {
    await removeImage(id)
    onSetImages(question.id, category.id, imageIds.filter(i => i !== id))
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
        imageIds={imageIds}
        imageCache={cache}
        index={index}
        total={category.questions.length}
        onSave={handleSave}
        onLoadImages={loadImages}
        onAddImage={handleAddImage}
        onRemoveImage={handleRemoveImage}
        onNext={handleNext}
        onPrev={() => setIndex(i => Math.max(0, i - 1))}
        canGoBack={index > 0}
      />
    </div>
  )
}

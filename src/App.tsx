import { useState } from 'react'
import { useAnswers } from './hooks/useAnswers'
import { CATEGORIES } from './data/categories'
import { HomeView } from './views/HomeView'
import { QuizView } from './views/QuizView'
import { ArchiveView } from './views/ArchiveView'
import './App.css'

type View = { name: 'home' } | { name: 'quiz'; categoryId: string } | { name: 'archive' }

export default function App() {
  const { profile, answers, saveAnswer, getAnswer, getCategoryProgress } = useAnswers()
  const [view, setView] = useState<View>({ name: 'home' })

  if (view.name === 'quiz') {
    const category = CATEGORIES.find(c => c.id === view.categoryId)
    if (!category) return null
    return (
      <QuizView
        category={category}
        getAnswer={getAnswer}
        onSave={saveAnswer}
        onBack={() => setView({ name: 'home' })}
      />
    )
  }

  if (view.name === 'archive') {
    return (
      <ArchiveView
        answers={answers}
        onBack={() => setView({ name: 'home' })}
      />
    )
  }

  return (
    <HomeView
      getCategoryProgress={getCategoryProgress}
      onSelectCategory={id => setView({ name: 'quiz', categoryId: id })}
      onOpenArchive={() => setView({ name: 'archive' })}
      profileName={profile?.name ?? ''}
    />
  )
}

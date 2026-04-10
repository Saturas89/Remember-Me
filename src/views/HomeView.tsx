import { useState } from 'react'
import { CATEGORIES } from '../data/categories'
import { CategoryCard } from '../components/CategoryCard'
import { HeroLogo } from '../components/Logo'
import { ThemeSwitcher } from '../components/ThemeSwitcher'
import { useTheme } from '../hooks/useTheme'
import type { Friend, FriendAnswer, CustomQuestion } from '../types'

interface Props {
  profileName: string
  friends: Friend[]
  friendAnswers: FriendAnswer[]
  customQuestions: CustomQuestion[]
  getCategoryProgress: (categoryId: string, total: number) => number
  onSelectCategory: (categoryId: string) => void
  onOpenArchive: () => void
  onOpenFriends: () => void
  onOpenProfile: () => void
  onOpenCustomQuestions: () => void
  onSaveName: (name: string) => void
}

export function HomeView({
  profileName,
  friends,
  friendAnswers,
  customQuestions,
  getCategoryProgress,
  onSelectCategory,
  onOpenArchive,
  onOpenFriends,
  onOpenProfile,
  onOpenCustomQuestions,
  onSaveName,
}: Props) {
  const { theme, setTheme } = useTheme()
  const [editingName, setEditingName] = useState(!profileName)
  const [nameInput, setNameInput] = useState(profileName)

  const totalQuestions = CATEGORIES.reduce((s, c) => s + c.questions.length, 0)
  const totalAnswered = CATEGORIES.reduce(
    (s, c) =>
      s + Math.round((getCategoryProgress(c.id, c.questions.length) / 100) * c.questions.length),
    0,
  )
  const overallProgress = Math.round((totalAnswered / totalQuestions) * 100)
  const totalFriendAnswers = friendAnswers.filter(a => a.value.trim()).length

  function handleSaveName() {
    if (!nameInput.trim()) return
    onSaveName(nameInput.trim())
    setEditingName(false)
  }

  return (
    <div className="home-view">
      <header className="home-header">
        {/* Theme switcher top-right */}
        <div className="home-topbar">
          <ThemeSwitcher current={theme} onChange={setTheme} />
        </div>

        {/* Logo */}
        <HeroLogo />

        {/* Profile name */}
        {editingName ? (
          <div className="home-name-setup">
            <p>Wie heißt du? Das hilft beim Einladen von Freunden.</p>
            <div className="home-name-row">
              <input
                className="input-text"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                placeholder="Dein Name..."
                autoFocus
              />
              <button className="btn btn--primary" onClick={handleSaveName} disabled={!nameInput.trim()}>
                Speichern
              </button>
            </div>
          </div>
        ) : (
          <>
            <button className="home-name-btn" onClick={onOpenProfile}>
              {profileName} ✎
            </button>
            {overallProgress > 0 && (
              <div className="home-overall">
                <span>{overallProgress}% deiner Geschichte erzählt</span>
                <div className="home-overall-bar">
                  <div className="home-overall-fill" style={{ width: `${overallProgress}%` }} />
                </div>
              </div>
            )}
          </>
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
      </section>

      <div className="home-actions">
        {totalAnswered > 0 && (
          <button className="btn btn--outline" onClick={onOpenArchive}>
            📖 Mein Archiv ({totalAnswered} Antworten)
          </button>
        )}
        <button className="btn btn--friends" onClick={onOpenFriends}>
          👥 Freunde einladen
          {friends.length > 0 && (
            <span className="friend-badge">{friends.length}</span>
          )}
          {totalFriendAnswers > 0 && (
            <span className="friend-answer-badge">{totalFriendAnswers}</span>
          )}
        </button>
        <button className="btn btn--friends" onClick={onOpenCustomQuestions}>
          ✏️ Eigene Fragen
          {customQuestions.length > 0 && (
            <span className="friend-badge">{customQuestions.length}</span>
          )}
        </button>
      </div>
    </div>
  )
}

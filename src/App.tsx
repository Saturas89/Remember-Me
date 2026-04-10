import { useState } from 'react'
import { useAnswers } from './hooks/useAnswers'
import { CATEGORIES } from './data/categories'
import { parseInviteFromHash } from './utils/sharing'
import { HomeView } from './views/HomeView'
import { QuizView } from './views/QuizView'
import { ArchiveView } from './views/ArchiveView'
import { FriendsView } from './views/FriendsView'
import { FriendAnswerView } from './views/FriendAnswerView'
import './App.css'

type View =
  | { name: 'home' }
  | { name: 'quiz'; categoryId: string }
  | { name: 'archive' }
  | { name: 'friends' }

// Check on load whether this session was opened via an invite link
const inviteFromUrl = parseInviteFromHash()

export default function App() {
  const {
    profile,
    answers,
    friends,
    friendAnswers,
    saveAnswer,
    saveProfile,
    addFriend,
    removeFriend,
    importFriendAnswers,
    getAnswer,
    getCategoryProgress,
  } = useAnswers()

  const [view, setView] = useState<View>({ name: 'home' })

  // If opened via invite link, show the friend answering flow instead of the regular app
  if (inviteFromUrl) {
    return <FriendAnswerView invite={inviteFromUrl} />
  }

  function handleSaveName(name: string) {
    saveProfile({
      name,
      birthYear: profile?.birthYear,
      createdAt: profile?.createdAt ?? new Date().toISOString(),
    })
  }

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
        friendAnswers={friendAnswers}
        friends={friends}
        onBack={() => setView({ name: 'home' })}
      />
    )
  }

  if (view.name === 'friends') {
    return (
      <FriendsView
        profileName={profile?.name ?? ''}
        friends={friends}
        friendAnswers={friendAnswers}
        onAddFriend={addFriend}
        onRemoveFriend={removeFriend}
        onImportAnswers={importFriendAnswers}
        onBack={() => setView({ name: 'home' })}
      />
    )
  }

  return (
    <HomeView
      profileName={profile?.name ?? ''}
      friends={friends}
      friendAnswers={friendAnswers}
      getCategoryProgress={getCategoryProgress}
      onSelectCategory={id => setView({ name: 'quiz', categoryId: id })}
      onOpenArchive={() => setView({ name: 'archive' })}
      onOpenFriends={() => setView({ name: 'friends' })}
      onSaveName={handleSaveName}
    />
  )
}

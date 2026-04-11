import { useState } from 'react'
import { useAnswers } from './hooks/useAnswers'
import { useInstallPrompt } from './hooks/useInstallPrompt'
import { CATEGORIES } from './data/categories'
import { parseInviteFromHash } from './utils/sharing'
import { HomeView } from './views/HomeView'
import { QuizView } from './views/QuizView'
import { ArchiveView } from './views/ArchiveView'
import { FriendsView } from './views/FriendsView'
import { FriendAnswerView } from './views/FriendAnswerView'
import { ProfileView } from './views/ProfileView'
import { CustomQuestionsView } from './views/CustomQuestionsView'
import { InstallBanner } from './components/InstallBanner'
import type { Category } from './types'
import './App.css'

type View =
  | { name: 'home' }
  | { name: 'quiz'; categoryId: string }
  | { name: 'archive' }
  | { name: 'friends' }
  | { name: 'profile' }
  | { name: 'custom-questions' }

// Check on load whether this session was opened via an invite link
const inviteFromUrl = parseInviteFromHash()

export default function App() {
  const {
    profile,
    answers,
    friends,
    friendAnswers,
    customQuestions,
    saveAnswer,
    saveProfile,
    addFriend,
    removeFriend,
    importFriendAnswers,
    addCustomQuestion,
    removeCustomQuestion,
    importCustomQuestions,
    getAnswer,
    getCategoryProgress,
  } = useAnswers()

  const [view, setView] = useState<View>({ name: 'home' })
  const { state: installState, visible: installVisible, triggerInstall, dismiss: dismissInstall } = useInstallPrompt()

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
    // Support virtual 'custom' category built from user's custom questions
    let category: Category | undefined
    if (view.categoryId === 'custom') {
      category = {
        id: 'custom',
        title: 'Eigene Fragen',
        description: 'Von dir erstellte Fragen',
        emoji: '✏️',
        questions: customQuestions.map(q => ({
          id: q.id,
          categoryId: 'custom',
          type: q.type,
          text: q.text,
          helpText: q.helpText,
          options: q.options,
        })),
      }
    } else {
      category = CATEGORIES.find(c => c.id === view.categoryId)
    }
    if (!category) return null
    return (
      <>
        <QuizView
          category={category}
          getAnswer={getAnswer}
          onSave={saveAnswer}
          onBack={() =>
            view.categoryId === 'custom'
              ? setView({ name: 'custom-questions' })
              : setView({ name: 'home' })
          }
        />
        {installVisible && <InstallBanner state={installState} onInstall={triggerInstall} onDismiss={dismissInstall} />}
      </>
    )
  }

  if (view.name === 'archive') {
    return (
      <>
        <ArchiveView
          profile={profile}
          answers={answers}
          friendAnswers={friendAnswers}
          friends={friends}
          customQuestions={customQuestions}
          profileName={profile?.name ?? ''}
          onSaveAnswer={saveAnswer}
          onBack={() => setView({ name: 'home' })}
        />
        {installVisible && <InstallBanner state={installState} onInstall={triggerInstall} onDismiss={dismissInstall} />}
      </>
    )
  }

  if (view.name === 'friends') {
    return (
      <>
        <FriendsView
          profileName={profile?.name ?? ''}
          friends={friends}
          friendAnswers={friendAnswers}
          onAddFriend={addFriend}
          onRemoveFriend={removeFriend}
          onImportAnswers={importFriendAnswers}
          onBack={() => setView({ name: 'home' })}
        />
        {installVisible && <InstallBanner state={installState} onInstall={triggerInstall} onDismiss={dismissInstall} />}
      </>
    )
  }

  if (view.name === 'profile') {
    return (
      <>
        <ProfileView
          profile={profile}
          answers={answers}
          friendCount={friends.length}
          onSave={saveProfile}
          onBack={() => setView({ name: 'home' })}
        />
        {installVisible && <InstallBanner state={installState} onInstall={triggerInstall} onDismiss={dismissInstall} />}
      </>
    )
  }

  if (view.name === 'custom-questions') {
    return (
      <>
        <CustomQuestionsView
          customQuestions={customQuestions}
          profileName={profile?.name ?? ''}
          getAnswer={getAnswer}
          onSave={saveAnswer}
          onAdd={addCustomQuestion}
          onRemove={removeCustomQuestion}
          onImport={importCustomQuestions}
          onBack={() => setView({ name: 'home' })}
        />
        {installVisible && <InstallBanner state={installState} onInstall={triggerInstall} onDismiss={dismissInstall} />}
      </>
    )
  }

  return (
    <>
      <HomeView
        profileName={profile?.name ?? ''}
        friends={friends}
        friendAnswers={friendAnswers}
        customQuestions={customQuestions}
        getCategoryProgress={getCategoryProgress}
        onSelectCategory={id => setView({ name: 'quiz', categoryId: id })}
        onOpenArchive={() => setView({ name: 'archive' })}
        onOpenFriends={() => setView({ name: 'friends' })}
        onOpenProfile={() => setView({ name: 'profile' })}
        onOpenCustomQuestions={() => setView({ name: 'custom-questions' })}
        onSaveName={handleSaveName}
      />
      {installVisible && <InstallBanner state={installState} onInstall={triggerInstall} onDismiss={dismissInstall} />}
    </>
  )
}

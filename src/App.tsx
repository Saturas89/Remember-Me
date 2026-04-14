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
import { ImportView } from './views/ImportView'
import { FaqView } from './views/FaqView'
import { OnboardingView } from './views/OnboardingView'
import { InstallBanner } from './components/InstallBanner'
import { UpdateBanner } from './components/UpdateBanner'
import { BottomNav } from './components/BottomNav'
import { useServiceWorker } from './hooks/useServiceWorker'
import { exportAsMarkdown, exportAsEnrichedJSON, downloadFile } from './utils/export'
import type { Category } from './types'
import './App.css'

type View =
  | { name: 'home' }
  | { name: 'quiz'; categoryId: string }
  | { name: 'archive' }
  | { name: 'friends' }
  | { name: 'profile' }
  | { name: 'custom-questions' }
  | { name: 'import' }
  | { name: 'faq'; from: 'profile' | 'home' }

type MainTab = 'home' | 'archive' | 'custom-questions' | 'friends' | 'profile'

// Check on load whether this session was opened via an invite link
const inviteFromUrl = parseInviteFromHash()

export default function App() {
  const {
    isLoaded,
    profile,
    answers,
    friends,
    friendAnswers,
    customQuestions,
    saveAnswer,
    setAnswerImages,
    setAnswerVideos,
    saveProfile,
    addFriend,
    removeFriend,
    importFriendAnswers,
    addCustomQuestion,
    removeCustomQuestion,
    importCustomQuestions,
    importSocialMediaEntries,
    deleteAnswer,
    setAnswerAudio,
    restoreBackup,
    getAnswer,
    getAnswerImageIds,
    getAnswerVideoIds,
    getAnswerAudioId,
    getCategoryProgress,
  } = useAnswers()

  const exportData = { profile, answers, friends, friendAnswers, customQuestions }
  const safeName = (profile?.name ?? 'lebensarchiv').replace(/\s+/g, '-').toLowerCase()

  function handleExportMarkdown() {
    downloadFile(exportAsMarkdown(exportData), `${safeName}.md`, 'text/markdown')
  }
  function handleExportJson() {
    downloadFile(exportAsEnrichedJSON(exportData), `${safeName}.json`, 'application/json')
  }

  const [view, setView] = useState<View>({ name: 'home' })
  const { state: installState, visible: installVisible, triggerInstall, dismiss: dismissInstall } = useInstallPrompt()
  const { needRefresh, applyUpdate, dismiss: dismissUpdate } = useServiceWorker()

  if (!isLoaded) {
    return null // or a loading spinner if preferred, but null avoids flicker
  }

  // If opened via invite link, show the friend answering flow instead of the regular app
  if (inviteFromUrl) {
    return <FriendAnswerView invite={inviteFromUrl} />
  }

  // First-time open: show onboarding before anything else
  if (!profile) {
    return (
      <>
        <OnboardingView onComplete={saveProfile} onImportBackup={restoreBackup} />
        {installVisible && <InstallBanner state={installState} onInstall={triggerInstall} onDismiss={dismissInstall} />}
        {needRefresh && <UpdateBanner onUpdate={applyUpdate} onDismiss={dismissUpdate} />}
      </>
    )
  }

  function navigate(tab: MainTab) {
    setView({ name: tab } as View)
  }

  const friendsBadge = friendAnswers.filter(a => a.value.trim()).length

  // Bottom nav shown on all main views (not during focused quiz/friend-answer/faq)
  const showNav = view.name !== 'quiz' && view.name !== 'faq'

  if (view.name === 'quiz') {
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
          getAnswerImageIds={getAnswerImageIds}
          getAnswerVideoIds={getAnswerVideoIds}
          getAnswerAudioId={getAnswerAudioId}
          onSave={saveAnswer}
          onSetImages={setAnswerImages}
          onSetVideos={setAnswerVideos}
          onSetAudio={setAnswerAudio}
          onBack={() =>
            view.categoryId === 'custom'
              ? setView({ name: 'custom-questions' })
              : setView({ name: 'home' })
          }
        />
        {installVisible && <InstallBanner state={installState} onInstall={triggerInstall} onDismiss={dismissInstall} />}
        {needRefresh && <UpdateBanner onUpdate={applyUpdate} onDismiss={dismissUpdate} />}
      </>
    )
  }

  return (
    <>
      {view.name === 'archive' && (
        <ArchiveView

          answers={answers}
          friendAnswers={friendAnswers}
          friends={friends}
          customQuestions={customQuestions}
          profileName={profile?.name ?? ''}
          onSaveAnswer={saveAnswer}
          onSetImages={setAnswerImages}
          onSetAudio={setAnswerAudio}
          onDeleteAnswer={deleteAnswer}
          onDeleteEntry={id => { removeCustomQuestion(id); deleteAnswer(id) }}
          onBack={() => setView({ name: 'home' })}
        />
      )}

      {view.name === 'friends' && (
        <FriendsView
          profileName={profile?.name ?? ''}
          friends={friends}
          friendAnswers={friendAnswers}
          onAddFriend={addFriend}
          onRemoveFriend={removeFriend}
          onImportAnswers={importFriendAnswers}
          onBack={() => setView({ name: 'home' })}
        />
      )}

      {view.name === 'profile' && (
        <ProfileView profile={profile}

          answers={answers}
          friendCount={friends.length}
          exportData={exportData}
          safeName={safeName}
          onSave={saveProfile}
          onBack={() => setView({ name: 'home' })}
          onExportMarkdown={handleExportMarkdown}
          onExportJson={handleExportJson}
          onImportBackup={restoreBackup}
          onOpenImport={() => setView({ name: 'import' })}
          onOpenFaq={() => setView({ name: 'faq', from: 'profile' })}
        />
      )}

      {view.name === 'import' && (
        <ImportView
          onImport={importSocialMediaEntries}
          onBack={() => setView({ name: 'profile' })}
          onDone={() => setView({ name: 'archive' })}
        />
      )}

      {view.name === 'custom-questions' && (
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
      )}

      {view.name === 'faq' && (
        <FaqView onBack={() => setView({ name: view.from } as View)} />
      )}

      {view.name === 'home' && (
        <HomeView
          profileName={profile?.name ?? ''}
          friends={friends}
          friendAnswers={friendAnswers}
          customQuestions={customQuestions}
          getCategoryProgress={getCategoryProgress}
          onSelectCategory={id => setView({ name: 'quiz', categoryId: id })}
          onOpenFaq={() => setView({ name: 'faq', from: 'home' })}
        />
      )}

      {showNav && (
        <BottomNav
          current={view.name}
          onNavigate={navigate}
          friendsBadge={friendsBadge}
        />
      )}

      {installVisible && <InstallBanner state={installState} onInstall={triggerInstall} onDismiss={dismissInstall} />}
      {needRefresh && <UpdateBanner onUpdate={applyUpdate} onDismiss={dismissUpdate} />}
    </>
  )
}

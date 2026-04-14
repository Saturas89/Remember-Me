import { useState, useEffect } from 'react'
import { useAnswers } from './hooks/useAnswers'
import { useInstallPrompt } from './hooks/useInstallPrompt'
import { CATEGORIES } from './data/categories'
import {
  isSecureInviteHash,
  isAnswerHash,
  isMemoryShareHash,
  parseSecureInviteFromHash,
  parseAnswerFromHash,
  parseMemoryShareFromHash,
  generateSecureInviteUrl,
} from './utils/secureLink'
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
import { SharedMemoryView } from './views/SharedMemoryView'
import { InstallBanner } from './components/InstallBanner'
import { UpdateBanner } from './components/UpdateBanner'
import { ReminderBanner } from './components/ReminderBanner'
import { BottomNav } from './components/BottomNav'
import { useServiceWorker } from './hooks/useServiceWorker'
import { useReminder } from './hooks/useReminder'
import { exportAsMarkdown, exportAsEnrichedJSON, downloadFile } from './utils/export'
import type { Category, InviteData, AnswerExport, MemorySharePayload } from './types'
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

// Detect URL type synchronously to show a loading state before async parse
const needsAsyncParse = isSecureInviteHash() || isAnswerHash() || isMemoryShareHash()

export default function App() {
  // State for async URL parsing (#mi/ secure invite, #ma/ answer import, #ms/ memory share)
  const [asyncInvite, setAsyncInvite] = useState<InviteData | null>(null)
  const [pendingAnswerImport, setPendingAnswerImport] = useState<AnswerExport | null>(null)
  const [sharedMemory, setSharedMemory] = useState<MemorySharePayload | null>(null)
  const [urlParsing, setUrlParsing] = useState(needsAsyncParse)
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

  // Resolve secure invite / answer-import / memory-share URL asynchronously on first mount
  useEffect(() => {
    if (!needsAsyncParse) return
    if (isSecureInviteHash()) {
      parseSecureInviteFromHash()
        .then(invite => { setAsyncInvite(invite) })
        .finally(() => setUrlParsing(false))
    } else if (isAnswerHash()) {
      parseAnswerFromHash()
        .then(answers => { if (answers) setPendingAnswerImport(answers) })
        .finally(() => setUrlParsing(false))
    } else if (isMemoryShareHash()) {
      parseMemoryShareFromHash()
        .then(payload => { if (payload) setSharedMemory(payload) })
        .finally(() => setUrlParsing(false))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-import answers when an #ma/ URL was opened and state is ready
  useEffect(() => {
    if (!pendingAnswerImport || !isLoaded) return
    importFriendAnswers(pendingAnswerImport)
    setPendingAnswerImport(null)
    window.history.replaceState(null, '', window.location.pathname)
    setView({ name: 'friends' })
  }, [pendingAnswerImport, isLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-warm the permanent invite URL as soon as the profile is known, so
  // by the time the user opens the Freunde tab the encrypted link is already
  // cached in localStorage. If the name changes (or the URL doesn't match),
  // a new one is generated and stored.
  useEffect(() => {
    if (!isLoaded) return
    const name = profile?.name ?? 'mir'
    const STORAGE_KEY = 'remember-me-invite-url'
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as { profileName?: string; url?: string }
        if (parsed.profileName === name && typeof parsed.url === 'string') return
      }
    } catch {
      // fall through and regenerate
    }
    generateSecureInviteUrl({ profileName: name })
      .then(url => {
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ profileName: name, url }),
          )
        } catch {
          // ignore quota errors
        }
      })
      .catch(err => {
        console.error('[App] pre-warm invite URL failed:', err)
      })
  }, [isLoaded, profile?.name])

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
  const { showPrompt: showReminderPrompt, requestPermission: enableReminder, dismissPrompt: dismissReminder } = useReminder()

  if (!isLoaded || urlParsing) {
    return null // avoid flicker while loading or parsing URL
  }

  if (asyncInvite) {
    return <FriendAnswerView invite={asyncInvite} />
  }

  if (sharedMemory) {
    return <SharedMemoryView payload={sharedMemory} />
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
        title: 'Eigene Erinnerungen',
        description: 'Von dir festgehaltene Erinnerungen',
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
          getAnswerImageIds={getAnswerImageIds}
          getAnswerVideoIds={getAnswerVideoIds}
          getAnswerAudioId={getAnswerAudioId}
          onSave={saveAnswer}
          onSetImages={setAnswerImages}
          onSetVideos={setAnswerVideos}
          onSetAudio={setAnswerAudio}
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
          onSelectCategory={id =>
            id === 'custom'
              ? setView({ name: 'custom-questions' })
              : setView({ name: 'quiz', categoryId: id })
          }
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
      {!installVisible && !needRefresh && showReminderPrompt && (
        <ReminderBanner
          visible={showReminderPrompt}
          onEnable={enableReminder}
          onDismiss={dismissReminder}
        />
      )}
    </>
  )
}

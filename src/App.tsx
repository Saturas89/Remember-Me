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
  generatePlainInviteUrl,
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
import { FeatureView } from './views/FeatureView'
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
  | { name: 'feature' }
  | { name: 'custom-questions' }
  | { name: 'import' }
  | { name: 'faq'; from: 'profile' | 'home' }

type MainTab = 'home' | 'friends' | 'archive' | 'feature' | 'profile'

// Detect URL type synchronously to show a loading state before async parse
const needsAsyncParse = isSecureInviteHash() || isAnswerHash() || isMemoryShareHash()

// ── Pathname ↔ View mapping (for Vercel Analytics page tracking) ──────────
function pathToView(pathname: string): View {
  switch (pathname.split('/')[1]) {
    case 'friends': return { name: 'friends' }
    case 'archive': return { name: 'archive' }
    case 'profile': return { name: 'profile' }
    case 'feature': return { name: 'feature' }
    default:        return { name: 'home' }
  }
}

const INVITE_URL_STORAGE_KEY = 'remember-me-invite-url'

function loadCachedInviteUrl(): string {
  try {
    const raw = localStorage.getItem(INVITE_URL_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { url?: string }
      if (typeof parsed.url === 'string') return parsed.url
    }
  } catch {}
  return ''
}

export default function App() {
  // State for async URL parsing (#mi/ secure invite, #ma/ answer import, #ms/ memory share)
  const [asyncInvite, setAsyncInvite] = useState<InviteData | null>(null)
  const [pendingAnswerImport, setPendingAnswerImport] = useState<AnswerExport | null>(null)
  const [sharedMemory, setSharedMemory] = useState<MemorySharePayload | null>(null)
  const [urlParsing, setUrlParsing] = useState(needsAsyncParse)

  // Permanent invite URL – generated once at app open, same link for all friends.
  // Initialized synchronously from localStorage (fast path for returning users),
  // then upgraded to the encrypted URL as soon as the profile name is known.
  const [inviteUrl, setInviteUrl] = useState<string>(loadCachedInviteUrl)
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
    history.replaceState({}, '', '/friends')
    setView({ name: 'friends' })
  }, [pendingAnswerImport, isLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // Generate the permanent invite URL as soon as the profile is known.
  // Sets a plain URL immediately (synchronous), then upgrades to the
  // encrypted URL in the background. Result is cached in localStorage so
  // subsequent visits are instant and the button is ready on first render.
  useEffect(() => {
    if (!isLoaded) return
    const name = profile?.name ?? 'mir'

    // Use cached URL if it already matches the current profile name
    try {
      const raw = localStorage.getItem(INVITE_URL_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as { profileName?: string; url?: string }
        if (parsed.profileName === name && typeof parsed.url === 'string') {
          setInviteUrl(parsed.url)
          return
        }
      }
    } catch {}

    // Instant fallback: plain Base64 URL, no crypto needed
    setInviteUrl(generatePlainInviteUrl({ profileName: name }))

    // Background upgrade to encrypted URL
    generateSecureInviteUrl({ profileName: name })
      .then(url => {
        setInviteUrl(url)
        try {
          localStorage.setItem(INVITE_URL_STORAGE_KEY, JSON.stringify({ profileName: name, url }))
        } catch {}
      })
      .catch(err => {
        console.error('[App] invite URL generation failed:', err)
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

  const [view, setView] = useState<View>(() =>
    needsAsyncParse ? { name: 'home' } : pathToView(window.location.pathname)
  )
  const { state: installState, visible: installVisible, triggerInstall, dismiss: dismissInstall } = useInstallPrompt()
  const { needRefresh, applyUpdate, dismiss: dismissUpdate } = useServiceWorker()
  const { showPrompt: showReminderPrompt, requestPermission: enableReminder, dismissPrompt: dismissReminder } = useReminder()

  // Sync view with browser back/forward navigation
  useEffect(() => {
    const onPopstate = () => setView(pathToView(window.location.pathname))
    window.addEventListener('popstate', onPopstate)
    return () => window.removeEventListener('popstate', onPopstate)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Navigate to a main tab and update the URL so Vercel Analytics tracks the page view
  function goTo(v: View) {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    const paths: Partial<Record<View['name'], string>> = {
      home: '/', friends: '/friends', archive: '/archive', profile: '/profile', feature: '/feature',
    }
    const path = paths[v.name]
    if (path !== undefined) history.pushState({}, '', path)
    setView(v)
  }

  function navigate(tab: MainTab) {
    goTo({ name: tab } as View)
  }

  const friendsBadge = friendAnswers.filter(a => a.value.trim()).length

  // Bottom nav shown on all main views (not during focused quiz/friend-answer)
  const showNav = view.name !== 'quiz'

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
              : goTo({ name: 'home' })
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
          onBack={() => goTo({ name: 'home' })}
        />
      )}

      {view.name === 'friends' && (
        <FriendsView
          profileName={profile?.name ?? ''}
          inviteUrl={inviteUrl}
          friends={friends}
          friendAnswers={friendAnswers}
          onRemoveFriend={removeFriend}
          onBack={() => goTo({ name: 'home' })}
        />
      )}

      {view.name === 'profile' && (
        <ProfileView profile={profile}

          answers={answers}
          friendCount={friends.length}
          exportData={exportData}
          safeName={safeName}
          onSave={saveProfile}
          onBack={() => goTo({ name: 'home' })}
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
          onBack={() => goTo({ name: 'profile' })}
          onDone={() => goTo({ name: 'archive' })}
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
          onBack={() => goTo({ name: 'home' })}
        />
      )}

      {view.name === 'feature' && (
        <FeatureView />
      )}

      {view.name === 'faq' && (
        <FaqView onBack={() => goTo({ name: view.from } as View)} />
      )}

      {view.name === 'home' && (
        <HomeView
          profileName={profile?.name ?? ''}
          friends={friends}
          friendAnswers={friendAnswers}
          customQuestions={customQuestions}
          getCategoryProgress={getCategoryProgress}
          onSelectCategory={id => {
            window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
            if (id === 'custom') setView({ name: 'custom-questions' })
            else setView({ name: 'quiz', categoryId: id })
          }}
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

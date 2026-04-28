import { useState, useEffect } from 'react'
import { useAnswers } from './hooks/useAnswers'
import { useInstallPrompt } from './hooks/useInstallPrompt'
import { CATEGORIES } from './data/categories'
import {
  isSecureInviteHash,
  isAnswerHash,
  isMemoryShareHash,
  isContactHash,
  parseSecureInviteFromHash,
  parseAnswerFromHash,
  parseMemoryShareFromHash,
  parseContactFromHash,
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
import { OnlineSharingIntroView } from './views/OnlineSharingIntroView'
import { OnlineSharingHubView } from './views/OnlineSharingHubView'
import { ContactHandshakeView } from './views/ContactHandshakeView'
import { useOnlineSync } from './hooks/useOnlineSync'

/** True at build time when VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set.
 *  Kept inline here (instead of reusing utils/supabaseClient's helper) so the
 *  main bundle does NOT statically import @supabase/supabase-js – that module
 *  is only reached via dynamic import() from useOnlineSync once the user has
 *  opted in. */
const ONLINE_SHARING_CONFIGURED = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
)
import { SEOHead } from './components/SEOHead'
import { InstallBanner } from './components/InstallBanner'
import { UpdateBanner } from './components/UpdateBanner'
import { ReleaseNotesModal } from './components/ReleaseNotesModal'
import { ReminderBanner } from './components/ReminderBanner'
import { WelcomeBackBanner } from './components/WelcomeBackBanner'
import { BottomNav } from './components/BottomNav'
import { useServiceWorker } from './hooks/useServiceWorker'
import { useReminder } from './hooks/useReminder'
import { useStreak } from './hooks/useStreak'
import { exportAsMarkdown, exportAsEnrichedJSON, downloadFile } from './utils/export'
import { importFile } from './utils/archiveImport'
import type { Category, InviteData, AnswerExport, MemorySharePayload, ContactHandshake } from './types'
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
  | { name: 'online-intro' }
  | { name: 'online-hub' }

type MainTab = 'home' | 'friends' | 'archive' | 'feature' | 'profile'

// Detect URL type synchronously to show a loading state before async parse
const needsAsyncParse = isSecureInviteHash() || isAnswerHash() || isMemoryShareHash()
// #contact/ is parsed synchronously (no crypto, no compression)
const initialContactHandshake = isContactHash() ? parseContactFromHash() : null

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
    onlineSharing,
    saveAnswer,
    setAnswerImages,
    setAnswerVideos,
    saveProfile,
    addFriend,
    removeFriend,
    importFriendAnswers,
    importFriendAnswerZipData,
    addCustomQuestion,
    removeCustomQuestion,
    importCustomQuestions,
    importSocialMediaEntries,
    deleteAnswer,
    setAnswerAudio,
    restoreBackup,
    enableOnlineSharing,
    disableOnlineSharing,
    setOnlineSharing,
    removeOnlineFriends,
    getAnswer,
    getAnswerImageIds,
    getAnswerVideoIds,
    getAnswerAudioId,
    getCategoryProgress,
  } = useAnswers()

  // Pending contact handshake (from URL hash). Parsed synchronously at module
  // load, then held here until the user explicitly accepts in the UI.
  const [pendingContact, setPendingContact] = useState<ContactHandshake | null>(
    initialContactHandshake,
  )

  // Online-sync is a no-op unless the user has opted in. The hook internally
  // dynamic-imports the Supabase client module only when enabled === true.
  const onlineSync = useOnlineSync(onlineSharing, (deviceId, publicKey) => {
    setOnlineSharing({ deviceId, publicKey })
  })

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

  // Enhanced answer saving with streak tracking
  function handleSaveAnswer(questionId: string, categoryId: string, value: string) {
    saveAnswer(questionId, categoryId, value)
    // Record streak and update reminders
    recordAnswer()
    reschedule()
  }

  // Find next unanswered question across all categories
  function findNextQuestion() {
    const categories = CATEGORIES
    for (const category of categories) {
      for (const question of category.questions) {
        if (!getAnswer(question.id)) {
          return { categoryId: category.id, questionId: question.id }
        }
      }
    }
    // Check custom questions
    for (const question of customQuestions) {
      if (!getAnswer(question.id)) {
        return { categoryId: 'custom', questionId: question.id }
      }
    }
    return null
  }

  // Handle welcome back continue button
  function handleWelcomeBackContinue() {
    setShowWelcomeBack(false)
    const next = findNextQuestion()
    if (next) {
      if (next.categoryId === 'custom') {
        goTo({ name: 'custom-questions' })
      } else {
        goTo({ name: 'quiz', categoryId: next.categoryId })
      }
    } else {
      // All questions answered, go to archive
      goTo({ name: 'archive' })
    }
  }

  async function handleImportFriendZip(file: File) {
    const result = await importFile(file)
    if (result.ok && result.friendAnswerPayload) {
      importFriendAnswerZipData(result.friendAnswerPayload)
      return
    }
    // Log so failures are at least diagnosable in the browser console; the UI
    // layer can be wired to a toast later without changing this call-site.
    console.error('[App] friend ZIP import failed:', result.error ?? 'unknown error')
  }

  const [view, setView] = useState<View>(() =>
    needsAsyncParse ? { name: 'home' } : pathToView(window.location.pathname)
  )
  const [showReleaseNotes, setShowReleaseNotes] = useState(false)
  const { state: installState, visible: installVisible, triggerInstall, dismiss: dismissInstall } = useInstallPrompt()
  const { needRefresh, applyUpdate, dismiss: dismissUpdate } = useServiceWorker()
  const { showPrompt: showReminderPrompt, requestPermission: enableReminder, dismissPrompt: dismissReminder, reschedule } = useReminder()
  const { streak, recordAnswer, checkStreakReset } = useStreak()

  // Welcome back banner state
  const [showWelcomeBack, setShowWelcomeBack] = useState(false)
  const [welcomeBackDays, setWelcomeBackDays] = useState(0)

  // Check for welcome back scenario on load
  useEffect(() => {
    if (!isLoaded || !streak.lastAnswerDate) return

    const today = new Date().toISOString().split('T')[0]
    const lastAnswer = new Date(streak.lastAnswerDate + 'T00:00:00')
    const todayDate = new Date(today + 'T00:00:00')
    const daysDiff = Math.floor((todayDate.getTime() - lastAnswer.getTime()) / (24 * 60 * 60 * 1000))

    if (daysDiff >= 3) {
      setWelcomeBackDays(daysDiff)
      setShowWelcomeBack(true)
      // Also check for streak reset
      checkStreakReset()
    }
  }, [isLoaded, streak.lastAnswerDate, checkStreakReset])

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

  if (pendingContact) {
    return (
      <ContactHandshakeView
        handshake={pendingContact}
        profileName={profile?.name ?? ''}
        myDeviceId={onlineSync.deviceId}
        myPublicKey={onlineSync.publicKeyB64}
        enabled={Boolean(onlineSharing?.enabled)}
        onEnable={() => enableOnlineSharing()}
        onAcceptContact={h => {
          addFriend(h.displayName || 'Kontakt', undefined, {
            deviceId: h.deviceId,
            publicKey: h.publicKey,
            linkedAt: new Date().toISOString(),
          })
        }}
        onDismiss={() => {
          setPendingContact(null)
          history.replaceState({}, '', '/friends')
        }}
      />
    )
  }

  // First-time open: show onboarding before anything else
  if (!profile) {
    return (
      <>
        <SEOHead viewName="home" />
        <OnboardingView onComplete={saveProfile} onImportBackup={restoreBackup} />
        {installVisible && <InstallBanner state={installState} onInstall={triggerInstall} onDismiss={dismissInstall} />}
        {needRefresh && <UpdateBanner onUpdate={applyUpdate} onDismiss={dismissUpdate} onViewNotes={() => setShowReleaseNotes(true)} />}
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

  const friendsBadge = friendAnswers.filter(a => a.value.trim() || (a.imageIds?.length ?? 0) > 0 || (a.videoIds?.length ?? 0) > 0 || !!a.audioId).length

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
        <SEOHead viewName="home" />
        <QuizView
          category={category}
          getAnswer={getAnswer}
          getAnswerImageIds={getAnswerImageIds}
          getAnswerVideoIds={getAnswerVideoIds}
          getAnswerAudioId={getAnswerAudioId}
          onSave={handleSaveAnswer}
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
        {needRefresh && <UpdateBanner onUpdate={applyUpdate} onDismiss={dismissUpdate} onViewNotes={() => setShowReleaseNotes(true)} />}
      </>
    )
  }

  return (
    <>
      <SEOHead viewName={view.name} />
      {view.name === 'archive' && (
        <ArchiveView

          answers={answers}
          friendAnswers={friendAnswers}
          friends={friends}
          customQuestions={customQuestions}
          profileName={profile?.name ?? ''}
          onSaveAnswer={handleSaveAnswer}
          onSetImages={setAnswerImages}
          onSetVideos={setAnswerVideos}
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
          onImportZip={handleImportFriendZip}
          onBack={() => goTo({ name: 'home' })}
          onOpenOnlineSharing={() => goTo({ name: onlineSharing?.enabled ? 'online-hub' : 'online-intro' })}
          onlineSharingEnabled={Boolean(onlineSharing?.enabled)}
          onlineSharingConfigured={ONLINE_SHARING_CONFIGURED}
        />
      )}

      {view.name === 'online-intro' && (
        <OnlineSharingIntroView
          configured={ONLINE_SHARING_CONFIGURED}
          onActivate={() => {
            enableOnlineSharing()
            goTo({ name: 'online-hub' })
          }}
          onBack={() => goTo({ name: 'friends' })}
        />
      )}

      {view.name === 'online-hub' && (
        <OnlineSharingHubView
          profileName={profile?.name ?? ''}
          friends={friends}
          answers={answers}
          sync={onlineSync}
          onBack={() => goTo({ name: 'friends' })}
          onDeactivate={async () => {
            const svc = onlineSync.service
            if (svc) {
              try { await svc.deactivateOnlineSharing() } catch (e) { console.error(e) }
            }
            removeOnlineFriends()
            disableOnlineSharing()
            goTo({ name: 'friends' })
          }}
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
          onOpenFaq={() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); setView({ name: 'faq', from: 'profile' }) }}
          onShowReleaseNotes={() => setShowReleaseNotes(true)}
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
          onSave={handleSaveAnswer}
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
          onOpenFaq={() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); setView({ name: 'faq', from: 'home' }) }}
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
      {needRefresh && <UpdateBanner onUpdate={applyUpdate} onDismiss={dismissUpdate} onViewNotes={() => setShowReleaseNotes(true)} />}
      {!installVisible && !needRefresh && !showWelcomeBack && showReminderPrompt && (
        <ReminderBanner
          visible={showReminderPrompt}
          onEnable={enableReminder}
          onDismiss={dismissReminder}
        />
      )}
      {showWelcomeBack && (
        <WelcomeBackBanner
          visible={showWelcomeBack}
          daysAway={welcomeBackDays}
          onContinue={handleWelcomeBackContinue}
          onDismiss={() => setShowWelcomeBack(false)}
        />
      )}
      {showReleaseNotes && <ReleaseNotesModal onClose={() => setShowReleaseNotes(false)} />}
    </>
  )
}

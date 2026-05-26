import { useState, useEffect, useCallback, useMemo } from 'react'
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
  isPersonalQuestionPack,
} from './utils/secureLink'
import { usePendingInviteResponses } from './hooks/usePendingInviteResponses'
import type { QuestionPack } from './types'
import type { PersonalQuestionPack } from './types/sandraFlow'
import { HomeView } from './views/HomeView'
import { QuizView } from './views/QuizView'
import { ArchiveView } from './views/ArchiveView'
import { FriendAnswerView } from './views/FriendAnswerView'
import { ProfileView } from './views/ProfileView'
import { CustomQuestionsView } from './views/CustomQuestionsView'
import { FaqView } from './views/FaqView'
import { ImpressumView } from './views/ImpressumView'
import { OnboardingView } from './views/OnboardingView'
import { SharedMemoryView } from './views/SharedMemoryView'
import { PrivateSyncSetupView } from './views/PrivateSyncSetupView'
import { PrivateSyncHubView } from './views/PrivateSyncHubView'
import { OnlineSharingIntroView } from './views/OnlineSharingIntroView'
import { OnlineSharingHubView } from './views/OnlineSharingHubView'
import { ContactHandshakeView } from './views/ContactHandshakeView'
import { SandraFlowView } from './views/SandraFlowView'
import { LandingView } from './views/LandingView'
import { PersonalPackReceiveView } from './views/PersonalPackReceiveView'
import { DebugPostHogView } from './views/DebugPostHogView'
import { useOnlineSync } from './hooks/useOnlineSync'
import { useAutoShare } from './hooks/useAutoShare'
import { usePrivateSync } from './hooks/usePrivateSync'
import { defaultMediaAdapter } from './utils/privateSyncMediaAdapter'

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
import { ShareMigrationBanner } from './components/ShareMigrationBanner'
import { ReminderBanner } from './components/ReminderBanner'
import { WelcomeBackBanner } from './components/WelcomeBackBanner'
import { BottomNav } from './components/BottomNav'
import { useServiceWorker } from './hooks/useServiceWorker'
import { useReminder } from './hooks/useReminder'
import { useStreak } from './hooks/useStreak'
import { AppModeProvider } from './hooks/useAppMode'
import { exportAsMarkdown, exportAsEnrichedJSON, downloadFile, toSafeFilename } from './utils/export'
import { clearAllData } from './utils/clearAllData'
import { trackTabChanged, trackFeatureOpened } from './lib/analytics'
import type { Category, InviteData, AnswerExport, MemorySharePayload, ContactHandshake } from './types'
import './App.css'

type View =
  | { name: 'home' }
  | { name: 'landing' }
  | { name: 'quiz'; categoryId: string }
  | { name: 'archive' }
  | { name: 'friends' }
  | { name: 'profile' }
  | { name: 'sync' }
  | { name: 'custom-questions' }
  | { name: 'faq'; from: 'profile' | 'home' }
  | { name: 'impressum'; from: 'profile' | 'home' }
  | { name: 'online-intro' }
  | { name: 'online-hub' }
  | { name: 'sandra-flow'; initialStep?: import('./views/SandraFlowView').SandraStep }
  | { name: 'debug' }

type MainTab = 'home' | 'friends' | 'archive' | 'sync' | 'profile'

// /join/CODE: short invite code – payload fetched async from Supabase.
const joinMatch = window.location.pathname.match(/^\/join\/([A-Z0-9]{6})$/i)
const isJoinPath = Boolean(joinMatch)

const needsAsyncParse =
  isJoinPath || isSecureInviteHash() || isAnswerHash() || isMemoryShareHash()

const initialSandraHash = !needsAsyncParse && window.location.hash.startsWith('#/ask')

// ── Pathname ↔ View mapping (for Vercel Analytics page tracking) ──────────
function pathToView(pathname: string): View {
  switch (pathname.split('/')[1]) {
    case 'friends': return { name: 'friends' }
    case 'archive': return { name: 'archive' }
    case 'profile': return { name: 'profile' }
    case 'sync':    return { name: 'sync' }
    case 'debug':   return { name: 'debug' }
    case 'landing': return { name: 'landing' }
    case 'join':    return { name: 'home' }
    default:        return { name: 'home' }
  }
}

// Views that are hidden in Simple Mode (also blocked from deep-links).
const HIDDEN_IN_SIMPLE: ReadonlySet<View['name']> = new Set([
  'friends', 'sync', 'online-intro', 'online-hub', 'custom-questions', 'sandra-flow',
])

export default function App() {
  // State for async URL parsing (#mi/ secure invite, #ma/ answer import, #ms/ memory share, ?qp/ question pack)
  const [asyncInvite, setAsyncInvite] = useState<InviteData | null>(null)
  const [pendingAnswerImport, setPendingAnswerImport] = useState<AnswerExport | null>(null)
  const [sharedMemory, setSharedMemory] = useState<MemorySharePayload | null>(null)
  const [incomingPack, setIncomingPack] = useState<QuestionPack | null>(null)
  const [urlParsing, setUrlParsing] = useState(needsAsyncParse)
  const {
    isLoaded,
    profile,
    answers,
    friends,
    friendAnswers,
    customQuestions,
    onlineSharing,
    privateSync: privateSyncState,
    appMode,
    appState,
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
    importPersonalPackAnswers,
    deleteAnswer,
    setAnswerAudio,
    restoreBackup,
    enableOnlineSharing,
    disableOnlineSharing,
    setOnlineSharing,
    removeOnlineFriends,
    streak: storedStreak,
    saveStreak,
    saveAppMode,
    savePrivateSync,
    mergeRemoteState,
    getAnswer,
    getAnswerImageIds,
    getAnswerVideoIds,
    getAnswerAudioId,
    getCategoryProgress,
  } = useAnswers()
  const isSimple = appMode === 'simple'

  const privateSync = usePrivateSync(
    appState,
    defaultMediaAdapter,
    mergeRemoteState,
    lastSyncAt => {
      const current = appState.privateSync
      if (!current) return
      savePrivateSync({ ...current, lastSyncAt })
    },
  )

  // ContactHandshakeView is shown after the quiz when the invite had a contact.
  const [pendingContact, setPendingContact] = useState<ContactHandshake | null>(null)

  // Contact embedded in the resolved /join/ invite – shown after the quiz.
  const [embeddedContact, setEmbeddedContact] = useState<ContactHandshake | null>(null)

  // Short code from the /join/ URL – threaded to ContactHandshakeView so
  // Ingrid's contact is auto-submitted to Supabase after acceptance.
  const [activeInviteCode, setActiveInviteCode] = useState<string | null>(null)

  // Online-sync is a no-op unless the user has opted in. The hook internally
  // dynamic-imports the Supabase client module only when enabled === true.
  const onlineSync = useOnlineSync(onlineSharing, (deviceId, publicKey) => {
    setOnlineSharing({ deviceId, publicKey })
  })

  // Resolve a human-readable question text for the auto-share hook. Built-in
  // category questions come from CATEGORIES; user-added questions from the
  // customQuestions state. Falls back to the questionId itself so the
  // recipient never sees an empty header.
  const customQuestionsById = useMemo(() => {
    const m = new Map<string, string>()
    for (const q of customQuestions) m.set(q.id, q.text)
    return m
  }, [customQuestions])
  const resolveAnswerQuestionText = useCallback((ans: { questionId: string; categoryId?: string }) => {
    for (const cat of CATEGORIES) {
      const q = cat.questions.find(qq => qq.id === ans.questionId)
      if (q) return q.text
    }
    const custom = customQuestionsById.get(ans.questionId)
    if (custom) return custom
    return ans.questionId
  }, [customQuestionsById])

  // Auto-share (REQ-022): no-op until online sharing is enabled AND there's
  // at least one friend with online.shareAll === true. Idempotent and
  // resumable across mounts.
  useAutoShare({
    answers,
    friends,
    sync: onlineSync,
    ownerName: profile?.name ?? '',
    enabled: Boolean(onlineSharing?.enabled),
    resolveQuestionText: resolveAnswerQuestionText,
  })

  // Poll pending invite codes for Ingrid's response so Sandra auto-adds her.
  usePendingInviteResponses(
    Boolean(onlineSharing?.enabled),
    (name, _inviteCode, online) => addFriend(name, undefined, online),
  )

  // Resolve secure invite / answer-import / memory-share / join-code URL asynchronously on first mount
  useEffect(() => {
    if (!needsAsyncParse) return
    if (isJoinPath && joinMatch) {
      const code = joinMatch[1].toUpperCase()
      import('./utils/inviteService')
        .then(m => m.resolveInviteCode(code))
        .then(({ pack, contact }) => {
          setIncomingPack(pack)
          setEmbeddedContact(contact)
          setActiveInviteCode(code)
          history.replaceState({}, '', '/')
        })
        .catch(() => {
          // Unknown / expired code – clear the path and stay on home.
          history.replaceState({}, '', '/')
        })
        .finally(() => setUrlParsing(false))
    } else if (isSecureInviteHash()) {
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


  const exportData = { profile, answers, friends, friendAnswers, customQuestions }
  const safeName = toSafeFilename(profile?.name ?? '')

  function handleExportMarkdown() {
    const date = new Date().toISOString().split('T')[0]
    downloadFile(exportAsMarkdown(exportData), `storyhold-${safeName}-${date}.md`, 'text/markdown')
  }
  function handleExportJson() {
    const date = new Date().toISOString().split('T')[0]
    downloadFile(exportAsEnrichedJSON(exportData), `storyhold-${safeName}-${date}.json`, 'application/json')
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

  const [view, setView] = useState<View>(() => {
    if (needsAsyncParse) return { name: 'home' }
    if (initialSandraHash) return { name: 'sandra-flow' }
    return pathToView(window.location.pathname)
  })
  const [showReleaseNotes, setShowReleaseNotes] = useState(false)
  // REQ-022 §4.6 one-time migration banner.
  const SHARE_MIGRATION_MARKER = 'rm-share-migration-v213'
  const [showShareMigration, setShowShareMigration] = useState(false)
  useEffect(() => {
    if (!isLoaded) return
    try {
      if (localStorage.getItem(SHARE_MIGRATION_MARKER)) return
      const hasOnlineFriends = friends.some(f => f.online)
      if (!hasOnlineFriends) {
        // Fresh installs / users without legacy connections – pre-set the
        // marker so a future connection doesn't trigger the migration banner.
        localStorage.setItem(SHARE_MIGRATION_MARKER, new Date().toISOString())
        return
      }
      setShowShareMigration(true)
    } catch {
      // localStorage unavailable (private mode etc.) – silently skip.
    }
  }, [isLoaded, friends])
  const dismissShareMigration = useCallback(() => {
    try { localStorage.setItem(SHARE_MIGRATION_MARKER, new Date().toISOString()) } catch { /* noop */ }
    setShowShareMigration(false)
  }, [])
  const { state: installState, visible: installVisible, triggerInstall, dismiss: dismissInstall } = useInstallPrompt()
  const { needRefresh, applyUpdate, dismiss: dismissUpdate } = useServiceWorker()
  const { showPrompt: showReminderPrompt, requestPermission: enableReminder, dismissPrompt: dismissReminder, reschedule } = useReminder()

  // Only show reminder banner after the user has answered at least 3 questions –
  // at that point they've experienced real value and are more likely to allow notifications.
  const answeredCount = Object.values(answers).filter(a =>
    a.value.trim() !== '' ||
    (a.imageIds?.length ?? 0) > 0 ||
    (a.videoIds?.length ?? 0) > 0 ||
    !!a.audioId ||
    !!a.audioTranscript,
  ).length

  const { streak, recordAnswer, checkStreakReset } = useStreak({
    isLoaded,
    answers,
    streak: storedStreak,
    saveStreak,
  })

  // Welcome back banner state
  const WELCOME_BACK_SESSION_KEY = 'rm-welcome-back-shown-this-session'
  const [showWelcomeBack, setShowWelcomeBack] = useState(false)
  // Track per-tab whether the welcome-back banner was already shown so the
  // reminder/permission banner doesn't pop up immediately after dismissal
  // (Ingrid persona, #156).
  const [welcomeBackShownThisSession, setWelcomeBackShownThisSession] = useState(() => {
    try { return sessionStorage.getItem(WELCOME_BACK_SESSION_KEY) === '1' } catch { return false }
  })

  // Check for welcome back scenario on load
  useEffect(() => {
    if (!isLoaded || !streak.lastAnswerDate) return

    const today = new Date().toISOString().split('T')[0]
    const lastAnswer = new Date(streak.lastAnswerDate + 'T00:00:00')
    const todayDate = new Date(today + 'T00:00:00')
    const daysDiff = Math.floor((todayDate.getTime() - lastAnswer.getTime()) / (24 * 60 * 60 * 1000))

    if (daysDiff >= 3) {
      setShowWelcomeBack(true)
      setWelcomeBackShownThisSession(true)
      try { sessionStorage.setItem(WELCOME_BACK_SESSION_KEY, '1') } catch { /* private mode */ }
      // Also check for streak reset
      checkStreakReset()
    }
  }, [isLoaded, streak.lastAnswerDate, checkStreakReset])

  // Sync view with browser back/forward navigation
  useEffect(() => {
    const onPopstate = () => setView(pathToView(window.location.pathname))
    const onHashChange = () => {
      if (window.location.hash.startsWith('#/ask')) {
        setView({ name: 'sandra-flow' })
      }
    }
    window.addEventListener('popstate', onPopstate)
    window.addEventListener('hashchange', onHashChange)
    return () => {
      window.removeEventListener('popstate', onPopstate)
      window.removeEventListener('hashchange', onHashChange)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect hidden routes to home whenever simple mode is active. This
  // covers initial landing on a deep link (/friends, /sync) as well as
  // the user toggling into simple mode while already on a hidden view.
  useEffect(() => {
    if (!isSimple) return
    if (HIDDEN_IN_SIMPLE.has(view.name)) {
      history.replaceState({}, '', '/')
      setView({ name: 'home' })
    }
  }, [isSimple, view.name]) // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect /friends deep-links to the right sub-view
  useEffect(() => {
    if (view.name !== 'friends' || !isLoaded) return
    if (friends.some(f => f.online) || onlineSharing?.enabled) {
      setView({ name: 'online-hub' })
    } else {
      setView({ name: 'online-intro' })
    }
  }, [view.name, isLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // Pull on visibility change (app resumes from background)
  useEffect(() => {
    if (!isLoaded) return
    const onVisible = () => {
      if (document.visibilityState === 'visible' && privateSync.isEnabled) {
        privateSync.syncNow()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [isLoaded, privateSync.isEnabled]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isLoaded || urlParsing) {
    return null // avoid flicker while loading or parsing URL
  }

  if (view.name === 'debug') {
    return <DebugPostHogView />
  }

  if (asyncInvite) {
    return <FriendAnswerView invite={asyncInvite} />
  }

  if (sharedMemory) {
    return <SharedMemoryView payload={sharedMemory} />
  }

  if (incomingPack && isPersonalQuestionPack(incomingPack)) {
    const embedded = embeddedContact
    return (
      <AppModeProvider appMode={appMode} setAppMode={saveAppMode}>
        <PersonalPackReceiveView
          pack={incomingPack as PersonalQuestionPack}
          existingProfileName={profile?.name || undefined}
          onSubmit={(recipientName, answers) => {
            // #261: pre-fill profile name so onboarding doesn't ask again
            if (!profile?.name && recipientName) {
              saveProfile({ name: recipientName, createdAt: new Date().toISOString() })
            }
            // #261: set default mode if not yet chosen to skip mode-choice in onboarding
            if (!appMode) {
              saveAppMode('full')
            }
            // #262: save questions AND answers into the archive
            importPersonalPackAnswers(incomingPack.questions, answers)
            setIncomingPack(null)
            if (embedded) {
              // Sandra invite: after the quiz, hand off to ContactHandshakeView.
              // The invite code is kept in state so Ingrid's contact is
              // auto-submitted to Supabase after acceptance.
              setEmbeddedContact(null)
              setPendingContact(embedded)
              history.replaceState({}, '', '/friends')
            } else {
              history.replaceState({}, '', '/')
              setView({ name: 'archive' })
            }
          }}
          onDismiss={() => {
            setIncomingPack(null)
            setEmbeddedContact(null)
            history.replaceState({}, '', '/')
            setView({ name: 'home' })
          }}
        />
      </AppModeProvider>
    )
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
        onAcceptContact={(h, shareAll) => {
          addFriend(h.displayName || 'Kontakt', undefined, {
            deviceId: h.deviceId,
            publicKey: h.publicKey,
            linkedAt: new Date().toISOString(),
            shareAll,
          })
        }}
        onDismiss={() => {
          setPendingContact(null)
          setActiveInviteCode(null)
          history.replaceState({}, '', '/friends')
        }}
        inviteCode={activeInviteCode ?? undefined}
      />
    )
  }

  // First-time open: show onboarding before anything else.
  // Onboarding now also covers the mode-choice step for users who upgrade
  // from a pre-Simple-Mode version (profile present, appMode missing).
  if (!profile || !appMode) {
    return (
      <AppModeProvider appMode={appMode} setAppMode={saveAppMode}>
        <SEOHead viewName="home" />
        <OnboardingView
          needsModeChoice={!appMode}
          modeOnly={Boolean(profile) && !appMode}
          onChooseMode={saveAppMode}
          onComplete={saveProfile}
          onImportBackup={restoreBackup}
        />
        {installVisible && <InstallBanner state={installState} onInstall={triggerInstall} onDismiss={dismissInstall} />}
        {needRefresh && <UpdateBanner onUpdate={applyUpdate} onDismiss={dismissUpdate} onViewNotes={() => setShowReleaseNotes(true)} />}
      </AppModeProvider>
    )
  }

  // Navigate to a main tab and update the URL so Vercel Analytics tracks the page view
  function goTo(v: View) {
    if (isSimple && HIDDEN_IN_SIMPLE.has(v.name)) {
      v = { name: 'home' }
    }
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    const paths: Partial<Record<View['name'], string>> = {
      home: '/', friends: '/friends', archive: '/archive', profile: '/profile', sync: '/sync',
      'online-hub': '/friends', 'online-intro': '/friends',
    }
    let path = paths[v.name]
    // Quiz lands on its own pseudo-route so deep-link & welcome-back-continue
    // can leave the home URL.
    if (v.name === 'quiz') path = `/quiz/${v.categoryId}`
    if (v.name === 'custom-questions') path = '/custom-questions'
    if (path !== undefined) history.pushState({}, '', path)

    const mainTabs = new Set(['home', 'friends', 'archive', 'profile', 'sync'])
    if (mainTabs.has(v.name)) {
      trackTabChanged(v.name)
    } else {
      trackFeatureOpened(v.name)
    }

    setView(v)
  }

  function navigate(tab: MainTab) {
    if (tab === 'friends') {
      goTo({ name: (friends.some(f => f.online) || onlineSharing?.enabled) ? 'online-hub' : 'online-intro' })
      return
    }
    goTo({ name: tab } as View)
  }

  const friendsBadge = friendAnswers.filter(a => a.value.trim() || (a.imageIds?.length ?? 0) > 0 || (a.videoIds?.length ?? 0) > 0 || !!a.audioId).length
  const FRIENDS_TAB_VIEWS = new Set<View['name']>(['friends', 'online-intro', 'online-hub', 'sandra-flow'])
  const activeTab = FRIENDS_TAB_VIEWS.has(view.name) ? 'friends' : view.name

  // Bottom nav shown on all main views (not during focused quiz/friend-answer/sandra-flow/landing)
  const showNav = view.name !== 'quiz' && view.name !== 'sandra-flow' && view.name !== 'landing'

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
      <AppModeProvider appMode={appMode} setAppMode={saveAppMode}>
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
      </AppModeProvider>
    )
  }

  return (
    <AppModeProvider appMode={appMode} setAppMode={saveAppMode}>
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
        />
      )}

      {view.name === 'online-intro' && (
        <OnlineSharingIntroView
          configured={ONLINE_SHARING_CONFIGURED}
          onInvite={() => {
            enableOnlineSharing()
            goTo({ name: 'sandra-flow', initialStep: 'anchor' })
          }}
        />
      )}

      {view.name === 'online-hub' && (
        <OnlineSharingHubView
          profileName={profile?.name ?? ''}
          friends={friends}
          sync={onlineSync}
          onRemoveContact={(friendId: string) => {
            const friend = friends.find(f => f.id === friendId)
            removeFriend(friendId)
            if (friend?.online?.deviceId && onlineSync.service) {
              onlineSync.service.unshareAllWithFriend(friend.online.deviceId)
                .catch(e => console.error('[removeContact] unshareAllWithFriend failed', e))
              onlineSync.refresh()
                .catch(e => console.error('[removeContact] refresh failed', e))
            }
          }}
          onOpenSandraFlow={() => goTo({ name: 'sandra-flow' })}
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
          onExportMarkdown={handleExportMarkdown}
          onExportJson={handleExportJson}
          onImportBackup={restoreBackup}
          onOpenFaq={() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); setView({ name: 'faq', from: 'profile' }) }}
          onOpenImpressum={() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); setView({ name: 'impressum', from: 'profile' }) }}
          onShowReleaseNotes={() => setShowReleaseNotes(true)}
          onDeleteAllData={async () => {
            if (privateSync.isEnabled) await privateSync.deactivate(true)
            await clearAllData()
            window.location.reload()
          }}
          onOpenDebug={() => setView({ name: 'debug' })}
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
          onOpenSandraFlow={isSimple ? undefined : () => goTo({ name: 'sandra-flow' })}
        />
      )}

      {view.name === 'sync' && (
        privateSyncState
          ? <PrivateSyncHubView
              syncState={privateSyncState}
              sync={privateSync}
              memoriesCount={Object.values(answers).filter(a =>
                a.value.trim() !== '' ||
                (a.imageIds?.length ?? 0) > 0 ||
                (a.videoIds?.length ?? 0) > 0 ||
                !!a.audioId ||
                !!a.audioTranscript,
              ).length}
              onDeactivated={() => savePrivateSync(undefined)}
            />
          : <PrivateSyncSetupView
              onComplete={(providerType, userId) => {
                savePrivateSync({
                  providerType,
                  userId,
                  lastSyncAt: null,
                  status: 'idle',
                  errorMessage: null,
                  encryption: providerType === 'supabase' ? 'recovery-code' : undefined,
                })
                privateSync.syncNow()
              }}
            />
      )}

      {view.name === 'faq' && (
        <FaqView onBack={() => goTo({ name: view.from } as View)} />
      )}

      {view.name === 'impressum' && (
        <ImpressumView onBack={() => goTo({ name: view.from } as View)} />
      )}

      {view.name === 'sandra-flow' && (
        <SandraFlowView
          profileName={profile?.name ?? ''}
          onlineSharingConfigured={ONLINE_SHARING_CONFIGURED}
          onlineSharingEnabled={Boolean(onlineSharing?.enabled)}
          myDeviceId={onlineSync.deviceId}
          myPublicKey={onlineSync.publicKeyB64}
          onEnableOnlineSharing={() => enableOnlineSharing()}
          initialStep={view.initialStep}
          onBack={() => {
            if (window.location.hash.startsWith('#/ask')) {
              history.replaceState({}, '', '/')
            }
            goTo({ name: 'home' })
          }}
        />
      )}

      {view.name === 'landing' && (
        <LandingView onStart={() => goTo({ name: 'home' })} />
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
          current={activeTab}
          onNavigate={navigate}
          friendsBadge={friendsBadge}
        />
      )}

      {installVisible && <InstallBanner state={installState} onInstall={triggerInstall} onDismiss={dismissInstall} />}
      {needRefresh && <UpdateBanner onUpdate={applyUpdate} onDismiss={dismissUpdate} onViewNotes={() => setShowReleaseNotes(true)} />}
      {showShareMigration && !installVisible && !needRefresh && (
        <ShareMigrationBanner
          onOpenContacts={() => {
            dismissShareMigration()
            goTo({ name: 'online-hub' })
          }}
          onDismiss={dismissShareMigration}
        />
      )}
      {!installVisible && !needRefresh && !showShareMigration && !showWelcomeBack && !welcomeBackShownThisSession && showReminderPrompt && answeredCount >= 3 && (
        <ReminderBanner
          visible={showReminderPrompt}
          onEnable={enableReminder}
          onDismiss={dismissReminder}
        />
      )}
      {showWelcomeBack && (
        <WelcomeBackBanner
          visible={showWelcomeBack}
          memoriesCount={Object.values(answers).filter(a =>
            a.value.trim() !== '' ||
            (a.imageIds?.length ?? 0) > 0 ||
            (a.videoIds?.length ?? 0) > 0 ||
            !!a.audioId ||
            !!a.audioTranscript,
          ).length}
          onContinue={handleWelcomeBackContinue}
          onDismiss={() => setShowWelcomeBack(false)}
        />
      )}
      {showReleaseNotes && <ReleaseNotesModal onClose={() => setShowReleaseNotes(false)} />}
    </AppModeProvider>
  )
}

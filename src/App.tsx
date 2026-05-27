import { useEffect, useCallback, useMemo } from 'react'
import { useAnswers } from './hooks/useAnswers'
import { useInstallPrompt } from './hooks/useInstallPrompt'
import { CATEGORIES } from './data/categories'
import { isPersonalQuestionPack } from './lib/sandraFlow/packBuilder'
import { usePendingInviteResponses } from './hooks/usePendingInviteResponses'
import type { PersonalQuestionPack } from './types/sandraFlow'
import { useUrlParsing } from './hooks/useUrlParsing'
import { useBanners } from './hooks/useBanners'
import { useNavigation } from './hooks/useNavigation'
import type { View } from './hooks/useNavigation'
import { HomeView } from './views/HomeView'
import { QuizView } from './views/QuizView'
import { ArchiveView } from './views/ArchiveView'
import { ProfileView } from './views/ProfileView'
import { CustomQuestionsView } from './views/CustomQuestionsView'
import { FaqView } from './views/FaqView'
import { ImpressumView } from './views/ImpressumView'
import { OnboardingView } from './views/OnboardingView'
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
import type { Category } from './types'
import './App.css'

/** Returns true when an answer has any meaningful content (text, media, or transcript). */
function hasContent(a: { value: string; imageIds?: string[]; videoIds?: string[]; audioId?: string | null; audioTranscript?: string | null }): boolean {
  return (
    a.value.trim() !== '' ||
    (a.imageIds?.length ?? 0) > 0 ||
    (a.videoIds?.length ?? 0) > 0 ||
    !!a.audioId ||
    !!a.audioTranscript
  )
}

export default function App() {
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
    addCustomQuestion,
    removeCustomQuestion,
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

  // ── Navigation ──────────────────────────────────────────────────────────

  const { view, setView, goTo, navigate, showNav, activeTab } = useNavigation({
    isSimple,
    isLoaded,
    friends,
    onlineSharing,
  })

  // ── URL parsing ─────────────────────────────────────────────────────────

  const {
    incomingPack,
    setIncomingPack,
    embeddedContact,
    setEmbeddedContact,
    activeInviteCode,
    setActiveInviteCode,
    pendingContact,
    setPendingContact,
    urlParsing,
  } = useUrlParsing()

  // ── Banner state ────────────────────────────────────────────────────────

  const { streak, recordAnswer, checkStreakReset } = useStreak({
    isLoaded,
    answers,
    streak: storedStreak,
    saveStreak,
  })

  const {
    showShareMigration,
    dismissShareMigration,
    showReleaseNotes,
    setShowReleaseNotes,
    showWelcomeBack,
    setShowWelcomeBack,
    welcomeBackShownThisSession,
    reminderBannerGate,
  } = useBanners({ isLoaded, friends, streak, checkStreakReset })

  const { state: installState, visible: installVisible, triggerInstall, dismiss: dismissInstall } = useInstallPrompt()
  const { needRefresh, applyUpdate, dismiss: dismissUpdate } = useServiceWorker()
  const { showPrompt: showReminderPrompt, requestPermission: enableReminder, dismissPrompt: dismissReminder, reschedule } = useReminder()

  // Auto-share (REQ-022): no-op until online sharing is enabled AND there's
  // at least one friend with online.shareAll === true. Idempotent and
  // resumable across mounts.
  const { lastError: autoShareError } = useAutoShare({
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

  // ── Derived values ──────────────────────────────────────────────────────

  const answeredCount = Object.values(answers).filter(hasContent).length
  const friendsBadge = friendAnswers.filter(a => a.value.trim() || (a.imageIds?.length ?? 0) > 0 || (a.videoIds?.length ?? 0) > 0 || !!a.audioId).length

  const exportData = { profile, answers, friends, friendAnswers, customQuestions }
  const safeName = toSafeFilename(profile?.name ?? '')

  // ── Handlers ────────────────────────────────────────────────────────────

  function handleExportMarkdown() {
    const date = new Date().toISOString().split('T')[0]
    downloadFile(exportAsMarkdown(exportData), `storyhold-${safeName}-${date}.md`, 'text/markdown')
  }
  function handleExportJson() {
    const date = new Date().toISOString().split('T')[0]
    downloadFile(exportAsEnrichedJSON(exportData), `storyhold-${safeName}-${date}.json`, 'application/json')
  }

  function handleSaveAnswer(questionId: string, categoryId: string, value: string) {
    saveAnswer(questionId, categoryId, value)
    recordAnswer()
    reschedule()
  }

  function findNextQuestion() {
    for (const category of CATEGORIES) {
      for (const question of category.questions) {
        if (!getAnswer(question.id)) {
          return { categoryId: category.id, questionId: question.id }
        }
      }
    }
    for (const question of customQuestions) {
      if (!getAnswer(question.id)) {
        return { categoryId: 'custom', questionId: question.id }
      }
    }
    return null
  }

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
      goTo({ name: 'archive' })
    }
  }

  // ── Early exits ─────────────────────────────────────────────────────────

  if (!isLoaded || urlParsing) {
    return null // avoid flicker while loading or parsing URL
  }

  if (view.name === 'debug') {
    return <DebugPostHogView />
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
        {installVisible && answeredCount >= 3 && <InstallBanner state={installState} onInstall={triggerInstall} onDismiss={dismissInstall} />}
        {needRefresh && <UpdateBanner onUpdate={applyUpdate} onDismiss={dismissUpdate} onViewNotes={() => setShowReleaseNotes(true)} />}
      </AppModeProvider>
    )
  }

  // ── Quiz view (full-screen, no bottom nav) ───────────────────────────────

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
        {installVisible && answeredCount >= 3 && <InstallBanner state={installState} onInstall={triggerInstall} onDismiss={dismissInstall} />}
        {needRefresh && <UpdateBanner onUpdate={applyUpdate} onDismiss={dismissUpdate} onViewNotes={() => setShowReleaseNotes(true)} />}
      </AppModeProvider>
    )
  }

  // ── Main shell ──────────────────────────────────────────────────────────

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
          autoShareError={autoShareError}
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
        <ProfileView
          profile={profile}
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
          onBack={() => goTo({ name: 'home' })}
          onOpenSandraFlow={isSimple ? undefined : () => goTo({ name: 'sandra-flow' })}
        />
      )}

      {view.name === 'sync' && (
        privateSyncState
          ? <PrivateSyncHubView
              syncState={privateSyncState}
              sync={privateSync}
              memoriesCount={Object.values(answers).filter(hasContent).length}
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
          onBack={() => goTo({ name: 'home' })}
        />
      )}

      {view.name === 'landing' && (
        <LandingView onStart={() => goTo({ name: 'home' })} />
      )}

      {view.name === 'home' && (
        <HomeView
          profileName={profile?.name ?? ''}
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

      {installVisible && answeredCount >= 3 && <InstallBanner state={installState} onInstall={triggerInstall} onDismiss={dismissInstall} />}
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
      {!installVisible && !needRefresh && !showShareMigration && !showWelcomeBack && !welcomeBackShownThisSession && showReminderPrompt && reminderBannerGate && (
        <ReminderBanner
          visible={showReminderPrompt}
          onEnable={enableReminder}
          onDismiss={dismissReminder}
        />
      )}
      {showWelcomeBack && (
        <WelcomeBackBanner
          visible={showWelcomeBack}
          memoriesCount={Object.values(answers).filter(hasContent).length}
          onContinue={handleWelcomeBackContinue}
          onDismiss={() => setShowWelcomeBack(false)}
        />
      )}
      {showReleaseNotes && <ReleaseNotesModal onClose={() => setShowReleaseNotes(false)} />}
    </AppModeProvider>
  )
}

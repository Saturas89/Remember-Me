import { useState, useEffect, useRef, useCallback } from 'react'
import { answerHasContent } from '../lib/answerContent'
import type { AppState, SyncProviderType, SyncStatus } from '../types'
import type { SyncProvider, MediaStoreAccessor } from '../utils/privateSyncProvider'
import { SyncError } from '../utils/privateSyncProvider'

const DEBOUNCE_MS = 30_000
const RETRY_DELAY_MS = 60_000
const MAX_RETRIES = 3

type SyncErrorCode = 'auth' | 'network' | 'quota' | 'decrypt' | 'unknown'

// sessionStorage flag set by GoogleDriveProvider.signIn() before its OAuth
// redirect. The Setup view consumes it on its own mount; here we mirror that
// for the Hub case, where the user re-authenticates from an already-configured
// install and lands back on /sync without ever entering the wizard again.
const GDRIVE_OAUTH_PENDING_KEY = 'rm-gdrive-oauth-pending'

/** Diff-summary of the most recent successful sync — drives the Hub's
 *  activity banner (#177) so Sandra can see that the sync actually moved
 *  data without leaking content ("Lesefenster, kein CCTV"). */
export interface SyncActivity {
  at: string
  addedOwnAnswers: number
  addedFriendAnswers: number
  addedFriends: number
}

export interface UsePrivateSyncReturn {
  isEnabled: boolean
  providerType: SyncProviderType | null
  status: SyncStatus
  lastSyncAt: string | null
  errorMessage: string | null
  errorCode: SyncErrorCode | null
  /** Summary of the most recent sync diff (null when nothing changed yet or
   *  before the first successful sync of this session). */
  lastSyncActivity: SyncActivity | null
  /** Caller-controlled dismiss of the activity banner. */
  dismissSyncActivity(): void
  syncNow(): Promise<void>
  reauthenticate(): Promise<void>
  setup(provider: SyncProviderType): Promise<void>
  deactivate(deleteRemote?: boolean): Promise<void>
}

export function usePrivateSync(
  appState: AppState,
  mediaStore: MediaStoreAccessor,
  onStateMerged: (merged: AppState) => void,
  onSyncSuccess?: (lastSyncAt: string) => void,
): UsePrivateSyncReturn {
  const [status, setStatus] = useState<SyncStatus>(
    appState.privateSync?.status ?? 'idle',
  )
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(
    appState.privateSync?.lastSyncAt ?? null,
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(
    appState.privateSync?.errorMessage ?? null,
  )
  const [errorCode, setErrorCode] = useState<SyncErrorCode | null>(null)
  // #177 – cache the most recent diff summary so the Hub can flash a
  // transient "X neue Antworten" banner. Reset to null after dismiss /
  // after auto-timeout.
  const [lastSyncActivity, setLastSyncActivity] = useState<SyncActivity | null>(null)

  const providerRef = useRef<SyncProvider | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCountRef = useRef(0)
  const syncingRef = useRef(false)
  const isMountedRef = useRef(true)
  const oauthResumeAttemptedRef = useRef(false)

  useEffect(() => {
    return () => { isMountedRef.current = false }
  }, [])

  const providerType = appState.privateSync?.providerType ?? null

  const getProvider = useCallback(async (): Promise<SyncProvider | null> => {
    if (!providerType) return null
    if (providerRef.current?.type === providerType) return providerRef.current

    if (providerType === 'google-drive') {
      const { GoogleDriveProvider } = await import('../utils/googleDriveProvider')
      providerRef.current = new GoogleDriveProvider(appState.privateSync?.userId)
    } else if (providerType === 'onedrive') {
      const { OneDriveProvider } = await import('../utils/oneDriveProvider')
      providerRef.current = new OneDriveProvider(appState.privateSync?.userId)
    } else {
      const { SupabaseSyncProvider } = await import('../utils/supabaseSyncProvider')
      providerRef.current = new SupabaseSyncProvider(appState.privateSync?.userId)
    }
    return providerRef.current
  }, [providerType, appState.privateSync?.userId])

  const runSync = useCallback(async () => {
    if (syncingRef.current) return
    // headless WebKit reports `navigator.onLine === false` and the
    // property cannot be overridden via Object.defineProperty on Safari
    // (non-configurable), so the E2E suite would otherwise be unable to
    // exercise the sync pipeline at all. VITE_E2E covers the local dev
    // suite; the localStorage marker covers real-DB nightly runs against
    // the production bundle (where VITE_E2E is compiled to 'false').
    const isE2ESession = import.meta.env.VITE_E2E === 'true'
      || (typeof localStorage !== 'undefined' && localStorage.getItem('traffic_type') === 'e2e')
    if (!navigator.onLine && !isE2ESession) return
    const provider = await getProvider()
    if (!provider) return

    syncingRef.current = true
    if (isMountedRef.current) setStatus('syncing')

    try {
      // Pull first so a freshly-logged-in device gets the existing remote
      // snapshot before pushing. Without this, a new device's empty local
      // state overwrites all data from other devices (push-first would
      // upsert an empty envelope with the same envelopeVersion, erasing it).
      const result = await provider.pull(appState, mediaStore)
      // Push the merged state (or local state when no remote row exists yet).
      const stateToPush = result ? result.merged : appState
      await provider.push(stateToPush, mediaStore)
      if (result) onStateMerged(result.merged)

      retryCountRef.current = 0
      const now = new Date().toISOString()
      // #177 – compute a privacy-safe diff summary for the Hub banner.
      // Pull-result.merged contains the post-merge appState; comparing key
      // sets against the pre-pull appState gives "added since last sync".
      // Inhalts-Filter spiegelt die Logik aus useAnswers/getCategoryProgress,
      // damit leere Antwort-Skelette nicht als "neu" gezählt werden.
      if (result && isMountedRef.current) {
        const beforeAnswers = new Set(Object.keys(appState.answers))
        const beforeFriends = new Set((appState.friends ?? []).map(f => f.id))
        const beforeFriendAnswers = new Set((appState.friendAnswers ?? []).map(a => a.id))
        let addedOwnAnswers = 0
        for (const [id, a] of Object.entries(result.merged.answers)) {
          if (beforeAnswers.has(id)) continue
          if (answerHasContent(a)) addedOwnAnswers++
        }
        const addedFriendAnswers = (result.merged.friendAnswers ?? [])
          .filter(a => !beforeFriendAnswers.has(a.id))
          .length
        const addedFriends = (result.merged.friends ?? [])
          .filter(f => !beforeFriends.has(f.id))
          .length
        if (addedOwnAnswers + addedFriendAnswers + addedFriends > 0) {
          setLastSyncActivity({
            at: now,
            addedOwnAnswers,
            addedFriendAnswers,
            addedFriends,
          })
        }
      }
      if (isMountedRef.current) {
        setStatus('success')
        setLastSyncAt(now)
        setErrorMessage(null)
        setErrorCode(null)
        setTimeout(() => { if (isMountedRef.current) setStatus('idle') }, 3_000)
      }
      onSyncSuccess?.(now)
    } catch (err) {
      retryCountRef.current++
      const isSyncErr = err instanceof SyncError
      const msg = isSyncErr ? err.message : 'Unbekannter Sync-Fehler'
      const code: SyncErrorCode = isSyncErr ? err.code : 'unknown'
      if (isMountedRef.current) {
        setStatus('error')
        setErrorMessage(msg)
        setErrorCode(code)
      }
      // Auth errors require user intervention (re-login). Auto-retrying just
      // burns timers and keeps showing the same error — skip the retry loop
      // and let the user trigger reauthenticate() from the UI instead.
      if (code !== 'auth' && retryCountRef.current < MAX_RETRIES) {
        setTimeout(() => runSync(), RETRY_DELAY_MS)
      }
    } finally {
      syncingRef.current = false
    }
  }, [appState, mediaStore, getProvider, onStateMerged, onSyncSuccess])

  // Debounced auto-push on state changes. Depends only on user-data fields so
  // that persisting privateSync metadata (lastSyncAt) after a successful sync
  // doesn't re-trigger the timer and create a sync loop.
  useEffect(() => {
    if (!providerType) return
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      runSync()
    }, DEBOUNCE_MS)
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    appState.answers,
    appState.friends,
    appState.friendAnswers,
    appState.customQuestions,
    appState.profile,
    providerType,
  ])

  // Resume an in-flight Google Drive OAuth redirect when the Hub view is the
  // landing target (i.e. the user re-authenticated from the already-configured
  // install). The Setup view has its own resume effect for the first-time
  // setup case; here providerType !== null so the two paths don't collide.
  useEffect(() => {
    if (providerType !== 'google-drive') return
    if (oauthResumeAttemptedRef.current) return
    if (typeof sessionStorage === 'undefined') return
    if (!sessionStorage.getItem(GDRIVE_OAUTH_PENDING_KEY)) return
    oauthResumeAttemptedRef.current = true
    ;(async () => {
      const provider = await getProvider()
      if (!provider || !provider.resumeFromOAuth) return
      try {
        const resumed = await provider.resumeFromOAuth()
        if (resumed) {
          retryCountRef.current = 0
          await runSync()
        } else if (isMountedRef.current) {
          setStatus('error')
          setErrorMessage('Google-Authentifizierung fehlgeschlagen')
          setErrorCode('auth')
        }
      } catch (err) {
        if (!isMountedRef.current) return
        const isSyncErr = err instanceof SyncError
        setStatus('error')
        setErrorMessage(isSyncErr ? err.message : 'Anmeldung fehlgeschlagen')
        setErrorCode(isSyncErr ? err.code : 'auth')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerType])

  const syncNow = useCallback(async () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    retryCountRef.current = 0
    await runSync()
  }, [runSync])

  // E2E bridge: Playwright deterministically triggers a sync without going
  // through the wizard or the 30s auto-debounce, and reads the hook's
  // internal status / error so a failing test can pin down whether sync
  // never started, threw, or completed. Gated by VITE_E2E so neither hook
  // is visible in production builds.
  //
  // Status fields are read through refs that update on every render so
  // __rmSyncStatus always returns the latest value — capturing them in a
  // useEffect closure leaves the test reading stale "syncing" state when
  // the actual status has already advanced to "error" / "success".
  const statusRef = useRef(status)
  const errorMessageRef = useRef(errorMessage)
  const errorCodeRef = useRef(errorCode)
  const lastSyncAtRef = useRef(lastSyncAt)
  statusRef.current = status
  errorMessageRef.current = errorMessage
  errorCodeRef.current = errorCode
  lastSyncAtRef.current = lastSyncAt
  useEffect(() => {
    if (import.meta.env.VITE_E2E !== 'true') return
    if (typeof window === 'undefined') return
    // Defer binding until state hydration finishes — `providerType` derives
    // from `appState.privateSync?.providerType`, which is null until
    // useAnswers' loadStoredState resolves. Binding earlier would expose
    // a runSync closure that no-ops on `if (!provider) return` because
    // getProvider also sees providerType=null.
    if (!providerType) return
    type Bridge = {
      __rmSyncNow?: () => Promise<void>
      __rmSyncStatus?: () => { status: SyncStatus; errorMessage: string | null; errorCode: SyncErrorCode | null; lastSyncAt: string | null }
    }
    const w = window as Window & Bridge
    w.__rmSyncNow = syncNow
    w.__rmSyncStatus = () => ({
      status: statusRef.current,
      errorMessage: errorMessageRef.current,
      errorCode: errorCodeRef.current,
      lastSyncAt: lastSyncAtRef.current,
    })
  }, [syncNow, providerType])

  const reauthenticate = useCallback(async () => {
    const provider = await getProvider()
    if (!provider) return
    if (isMountedRef.current) {
      setStatus('syncing')
      setErrorMessage(null)
      setErrorCode(null)
    }
    try {
      // Google: full-page redirect — the promise never resolves; resume runs
      // on the next mount via the useEffect above.
      // OneDrive: popup login — resolves once the popup closes and the token
      // is persisted, so we can immediately follow up with a sync.
      await provider.signIn()
      retryCountRef.current = 0
      await runSync()
    } catch (err) {
      if (!isMountedRef.current) return
      const isSyncErr = err instanceof SyncError
      setStatus('error')
      setErrorMessage(isSyncErr ? err.message : 'Anmeldung fehlgeschlagen')
      setErrorCode(isSyncErr ? err.code : 'auth')
    }
  }, [getProvider, runSync])

  const setup = useCallback(async (_provider: SyncProviderType) => {
    // Setup is handled by PrivateSyncSetupView; this is a no-op placeholder
    // that the wizard calls after writing to AppState directly.
  }, [])

  const deactivate = useCallback(async (deleteRemote = false) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    const provider = await getProvider()
    if (provider) await provider.deactivate(deleteRemote)
    providerRef.current = null
    if (isMountedRef.current) {
      setStatus('idle')
      setLastSyncAt(null)
      setErrorMessage(null)
      setErrorCode(null)
      setLastSyncActivity(null)
    }
  }, [getProvider])

  const dismissSyncActivity = useCallback(() => {
    setLastSyncActivity(null)
  }, [])

  return {
    isEnabled: providerType !== null,
    providerType,
    status,
    lastSyncAt,
    errorMessage,
    errorCode,
    lastSyncActivity,
    dismissSyncActivity,
    syncNow,
    reauthenticate,
    setup,
    deactivate,
  }
}

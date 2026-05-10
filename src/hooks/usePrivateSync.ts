import { useState, useEffect, useRef, useCallback } from 'react'
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

export interface UsePrivateSyncReturn {
  isEnabled: boolean
  providerType: SyncProviderType | null
  status: SyncStatus
  lastSyncAt: string | null
  errorMessage: string | null
  errorCode: SyncErrorCode | null
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
    // exercise the sync pipeline at all. The VITE_E2E gate keeps the
    // production guard intact for real users.
    if (!navigator.onLine && import.meta.env.VITE_E2E !== 'true') return
    const provider = await getProvider()
    if (!provider) return

    syncingRef.current = true
    if (isMountedRef.current) setStatus('syncing')

    try {
      await provider.push(appState, mediaStore)
      const result = await provider.pull(appState, mediaStore)
      if (result) onStateMerged(result.merged)

      retryCountRef.current = 0
      const now = new Date().toISOString()
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
  }, [syncNow])

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
    }
  }, [getProvider])

  return {
    isEnabled: providerType !== null,
    providerType,
    status,
    lastSyncAt,
    errorMessage,
    errorCode,
    syncNow,
    reauthenticate,
    setup,
    deactivate,
  }
}

import { useState, useEffect, useRef, useCallback } from 'react'
import type { AppState, SyncProviderType, SyncStatus } from '../types'
import type { SyncProvider, MediaStoreAccessor } from '../utils/privateSyncProvider'
import { SyncError } from '../utils/privateSyncProvider'

const DEBOUNCE_MS = 5_000
const RETRY_DELAY_MS = 30_000
const MAX_RETRIES = 3

export interface UsePrivateSyncReturn {
  isEnabled: boolean
  providerType: SyncProviderType | null
  status: SyncStatus
  lastSyncAt: string | null
  errorMessage: string | null
  syncNow(): Promise<void>
  setup(provider: SyncProviderType): Promise<void>
  deactivate(deleteRemote?: boolean): Promise<void>
}

export function usePrivateSync(
  appState: AppState,
  mediaStore: MediaStoreAccessor,
  onStateMerged: (merged: AppState) => void,
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

  const providerRef = useRef<SyncProvider | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCountRef = useRef(0)
  const syncingRef = useRef(false)
  const isMountedRef = useRef(true)

  useEffect(() => {
    return () => { isMountedRef.current = false }
  }, [])

  const providerType = appState.privateSync?.providerType ?? null

  const getProvider = useCallback(async (): Promise<SyncProvider | null> => {
    if (!providerType) return null
    if (providerRef.current?.type === providerType) return providerRef.current

    if (providerType === 'google-drive') {
      const { GoogleDriveProvider } = await import('../utils/googleDriveProvider')
      providerRef.current = new GoogleDriveProvider()
    } else if (providerType === 'onedrive') {
      const { OneDriveProvider } = await import('../utils/oneDriveProvider')
      providerRef.current = new OneDriveProvider()
    } else {
      const { SupabaseSyncProvider } = await import('../utils/supabaseSyncProvider')
      providerRef.current = new SupabaseSyncProvider(appState.privateSync?.userId)
    }
    return providerRef.current
  }, [providerType, appState.privateSync?.userId])

  const runSync = useCallback(async () => {
    if (syncingRef.current) return
    if (!navigator.onLine) return
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
        setTimeout(() => { if (isMountedRef.current) setStatus('idle') }, 3_000)
      }
    } catch (err) {
      retryCountRef.current++
      const msg = err instanceof SyncError ? err.message : 'Unbekannter Sync-Fehler'
      if (isMountedRef.current) {
        setStatus('error')
        setErrorMessage(msg)
      }
      if (retryCountRef.current < MAX_RETRIES) {
        setTimeout(() => runSync(), RETRY_DELAY_MS)
      }
    } finally {
      syncingRef.current = false
    }
  }, [appState, mediaStore, getProvider, onStateMerged])

  // Debounced auto-push on state changes
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
  }, [appState, providerType])

  const syncNow = useCallback(async () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    await runSync()
  }, [runSync])

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
    }
  }, [getProvider])

  return {
    isEnabled: providerType !== null,
    providerType,
    status,
    lastSyncAt,
    errorMessage,
    syncNow,
    setup,
    deactivate,
  }
}

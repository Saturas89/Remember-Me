import { useCallback, useEffect, useRef, useState } from 'react'
import type { OnlineSharingState, SharedMemory, Annotation } from '../types'

// Type of the dynamically-loaded service module. We list only the pieces
// the hook actually uses so a missing or unconfigured backend doesn't break
// type checking.
type SharingServiceModule = typeof import('../utils/sharingService')

export interface OnlineSyncAPI {
  ready: boolean
  error: string | null
  deviceId: string | null
  publicKeyB64: string | null
  memories: SharedMemory[]
  annotations: Annotation[]
  /** Refresh the incoming feed. */
  refresh: () => Promise<void>
  /** Async-loaded service module so callers (views) can invoke operations
   *  without triggering another dynamic import. Null until `ready`. */
  service: SharingServiceModule | null
}

/**
 * Online-sync hook.
 *
 * Guard-pattern: when `onlineSharing.enabled !== true` this hook does
 * NOTHING – no dynamic import, no network, no IndexedDB touch. Callers can
 * safely mount it unconditionally; the behaviour degrades to a no-op for
 * offline-only users.
 */
export function useOnlineSync(
  onlineSharing: OnlineSharingState | undefined,
  onRegistered?: (deviceId: string, publicKeyB64: string) => void,
): OnlineSyncAPI {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [publicKeyB64, setPublicKeyB64] = useState<string | null>(null)
  const [memories, setMemories] = useState<SharedMemory[]>([])
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const serviceRef = useRef<SharingServiceModule | null>(null)
  const onRegisteredRef = useRef(onRegistered)
  onRegisteredRef.current = onRegistered

  const refresh = useCallback(async () => {
    const svc = serviceRef.current
    if (!svc) return
    try {
      const { memories, annotations } = await svc.fetchIncomingShares()
      setMemories(memories)
      setAnnotations(annotations)
    } catch (e) {
      setError((e as Error).message ?? 'sync failed')
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    if (!onlineSharing?.enabled) {
      // Reset state in case the user just deactivated sharing.
      setReady(false)
      setDeviceId(null)
      setPublicKeyB64(null)
      setMemories([])
      setAnnotations([])
      serviceRef.current = null
      return
    }

    ;(async () => {
      try {
        // Dynamic import ⇒ supabase-js + sharingService only ship to clients
        // that actually opt in to online sharing.
        const svc = await import('../utils/sharingService')
        if (cancelled) return
        serviceRef.current = svc

        const session = await svc.bootstrapSession()
        if (cancelled) return

        setDeviceId(session.deviceId)
        setPublicKeyB64(session.publicKeyB64)
        onRegisteredRef.current?.(session.deviceId, session.publicKeyB64)
        setReady(true)

        const incoming = await svc.fetchIncomingShares()
        if (cancelled) return
        setMemories(incoming.memories)
        setAnnotations(incoming.annotations)
      } catch (e) {
        if (cancelled) return
        setError((e as Error).message ?? 'online sharing unavailable')
      }
    })()

    return () => { cancelled = true }
  }, [onlineSharing?.enabled])

  return {
    ready,
    error,
    deviceId,
    publicKeyB64,
    memories,
    annotations,
    refresh,
    service: serviceRef.current,
  }
}

import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Wraps the vite-plugin-pwa service worker registration hook.
 * `needRefresh` becomes true when a new service worker is waiting to activate.
 * Call `applyUpdate()` to trigger skipWaiting + page reload.
 * Call `dismiss()` to hide the notification without updating (banner won't
 * reappear until the next page load that finds a waiting SW).
 */
export function useServiceWorker() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  function applyUpdate() {
    updateServiceWorker(true)
  }

  function dismiss() {
    setNeedRefresh(false)
  }

  return { needRefresh, applyUpdate, dismiss }
}

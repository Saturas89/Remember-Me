import { useEffect, useState } from 'react'
import { Analytics } from '@vercel/analytics/react'

// ── Route pattern ──────────────────────────────────────
// Groups dynamic segments so Vercel Analytics reports one entry per feature
// template (e.g. "/feature/[id]") instead of one per concrete URL.
function routeFor(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean)
  if (segments[0] === 'feature' && segments.length >= 2) {
    return '/feature/[id]'
  }
  return pathname || '/'
}

// ── Module-level history patch ─────────────────────────
// Patched once on import, before any React render. This guarantees that every
// history.pushState/replaceState call – including those App-level useEffects
// trigger before <AnalyticsTracker /> mounts – notifies the subscribers.
const subscribers = new Set<() => void>()
const notify = (): void => {
  for (const fn of subscribers) fn()
}

if (typeof window !== 'undefined') {
  const originalPush = window.history.pushState
  const originalReplace = window.history.replaceState

  window.history.pushState = function patchedPushState(...args) {
    const result = originalPush.apply(this, args as Parameters<typeof window.history.pushState>)
    notify()
    return result
  }
  window.history.replaceState = function patchedReplaceState(...args) {
    const result = originalReplace.apply(this, args as Parameters<typeof window.history.replaceState>)
    notify()
    return result
  }

  window.addEventListener('popstate', notify)
  // Safari fires hashchange but not always popstate – cover both.
  window.addEventListener('hashchange', notify)
}

// ── Path tracker ───────────────────────────────────────
function useCurrentPath(): string {
  const [path, setPath] = useState(() =>
    typeof window === 'undefined' ? '/' : window.location.pathname || '/'
  )

  useEffect(() => {
    const sync = (): void => setPath(window.location.pathname || '/')
    subscribers.add(sync)
    sync()
    return () => {
      subscribers.delete(sync)
    }
  }, [])

  return path
}

// ── Public tracker component ───────────────────────────
export function AnalyticsTracker() {
  const path = useCurrentPath()
  // Providing both `route` and `path` switches Vercel Analytics into manual
  // mode and fires a pageview every time either value changes – exactly what
  // we want for bottom-nav tab switches and the /feature/[id] sub-navigation.
  return <Analytics route={routeFor(path)} path={path} />
}

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

// ── Path tracker ───────────────────────────────────────
// React state is synced with window.location.pathname. We patch
// history.pushState / history.replaceState so that every client-side
// navigation (tab switch in BottomNav, feature detail open/close) is
// observed – the native History API does not dispatch events for these
// calls, which is why Vercel Analytics missed them out of the box.
function useCurrentPath(): string {
  const [path, setPath] = useState(() =>
    typeof window === 'undefined' ? '/' : window.location.pathname || '/'
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    const sync = () => setPath(window.location.pathname || '/')

    const originalPush = window.history.pushState
    const originalReplace = window.history.replaceState

    window.history.pushState = function patchedPushState(...args) {
      const result = originalPush.apply(this, args as Parameters<typeof window.history.pushState>)
      sync()
      return result
    }
    window.history.replaceState = function patchedReplaceState(...args) {
      const result = originalReplace.apply(this, args as Parameters<typeof window.history.replaceState>)
      sync()
      return result
    }

    window.addEventListener('popstate', sync)
    // Safari fires a hashchange but not always popstate – track both to be safe.
    window.addEventListener('hashchange', sync)

    // Initial sync in case something changed between render and effect.
    sync()

    return () => {
      window.history.pushState = originalPush
      window.history.replaceState = originalReplace
      window.removeEventListener('popstate', sync)
      window.removeEventListener('hashchange', sync)
    }
  }, [])

  return path
}

// ── Public tracker component ───────────────────────────
export function AnalyticsTracker() {
  const path = useCurrentPath()
  // Providing both `route` and `path` disables the Vercel auto-tracker and
  // fires a pageview every time either value changes – exactly what we want
  // for bottom-nav tab switches and the /feature/[id] sub-navigation.
  return <Analytics route={routeFor(path)} path={path} />
}

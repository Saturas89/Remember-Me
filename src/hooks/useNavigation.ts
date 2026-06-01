// ── Navigation ────────────────────────────────────────────────────────────
//
// Owns the active View state, browser history, and the goTo / navigate helpers.
// Also houses three navigation-related effects:
//
//  popstate / hashchange   Keeps the React view in sync with the browser's
//                          back/forward buttons and hash changes.
//  Simple Mode redirect    Forces hidden views (sync, friends, …) to home when
//                          the user is in Simple Mode.
//  Friends redirect        Sends a bare 'friends' view name to the correct
//                          sub-view (online-hub vs online-intro) once state loads.
//
// The View and MainTab types live here since this module is the canonical owner
// of the view state machine.

import { useState, useEffect } from 'react'
import { needsAsyncParse } from './useUrlParsing'
import { trackTabChanged, trackFeatureOpened } from '../lib/analytics'
import type { Friend } from '../types'

// ── Types ────────────────────────────────────────────────────────────────

export type View =
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
  | { name: 'sandra-flow'; initialStep?: import('../views/SandraFlowView').SandraStep }
  | { name: 'debug' }

export type MainTab = 'home' | 'friends' | 'archive' | 'sync' | 'profile'

// ── Module-level helpers ──────────────────────────────────────────────────

/** Views that are hidden and redirected to home in Simple Mode. */
export const HIDDEN_IN_SIMPLE: ReadonlySet<View['name']> = new Set([
  'friends', 'sync', 'online-intro', 'online-hub', 'custom-questions', 'sandra-flow',
])

/** Maps a pathname to the corresponding View (for Vercel Analytics page tracking). */
export function pathToView(pathname: string): View {
  switch (pathname.split('/')[1]) {
    case 'friends': return { name: 'friends' }
    case 'archive': return { name: 'archive' }
    case 'profile': return { name: 'profile' }
    case 'sync':    return { name: 'sync' }
    case 'debug':   return { name: 'debug' }
    case 'landing': return { name: 'landing' }
    case 'ask':     return { name: 'sandra-flow' }
    case 'join':    return { name: 'home' }
    default:        return { name: 'home' }
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────

interface UseNavigationOptions {
  isSimple: boolean
  isLoaded: boolean
  friends: Friend[]
  onlineSharing: { enabled?: boolean } | undefined
}

export interface NavigationState {
  view: View
  setView: (v: View) => void
  goTo: (v: View) => void
  navigate: (tab: MainTab) => void
  showNav: boolean
  activeTab: View['name']
}

export function useNavigation({
  isSimple,
  isLoaded,
  friends,
  onlineSharing,
}: UseNavigationOptions): NavigationState {
  const [view, setView] = useState<View>(() => {
    if (needsAsyncParse) return { name: 'home' }
    return pathToView(window.location.pathname)
  })

  // Sync view with browser back/forward navigation
  useEffect(() => {
    const onPopstate = () => setView(pathToView(window.location.pathname))
    window.addEventListener('popstate', onPopstate)
    return () => window.removeEventListener('popstate', onPopstate)
  }, [])

  // Redirect hidden routes to home whenever simple mode is active.
  // Covers initial landing on a deep link (/friends, /sync) as well as
  // the user toggling into simple mode while already on a hidden view.
  useEffect(() => {
    if (!isSimple) return
    if (HIDDEN_IN_SIMPLE.has(view.name)) {
      history.replaceState({}, '', '/')
      setView({ name: 'home' })
    }
  }, [isSimple, view.name])

  // Redirect /friends deep-links to the correct sub-view
  useEffect(() => {
    if (view.name !== 'friends' || !isLoaded) return
    if (friends.some(f => f.online) || onlineSharing?.enabled) {
      setView({ name: 'online-hub' })
    } else {
      setView({ name: 'online-intro' })
    }
  }, [view.name, isLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Navigate to a view and push a history entry for Vercel Analytics. */
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

  /** Navigate to a main tab, resolving 'friends' to the correct sub-view. */
  function navigate(tab: MainTab) {
    if (tab === 'friends') {
      goTo({ name: (friends.some(f => f.online) || onlineSharing?.enabled) ? 'online-hub' : 'online-intro' })
      return
    }
    goTo({ name: tab } as View)
  }

  const FRIENDS_TAB_VIEWS = new Set<View['name']>(['friends', 'online-intro', 'online-hub', 'sandra-flow'])
  const activeTab = FRIENDS_TAB_VIEWS.has(view.name) ? 'friends' : view.name

  // Bottom nav is shown on all main views except focused flows
  const showNav = view.name !== 'quiz' && view.name !== 'sandra-flow' && view.name !== 'landing'

  return { view, setView, goTo, navigate, showNav, activeTab }
}

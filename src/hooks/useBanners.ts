// ── Banner orchestration ──────────────────────────────────────────────────
//
// Manages all overlay/banner states that are independent of the main view:
//
//  ShareMigration  One-time notice for users with legacy online connections
//                  (v2.13 share model migration, REQ-022).
//  ReleaseNotes    What's-new modal triggered after an app update.
//  WelcomeBack     Re-engagement banner shown when user returns after ≥3 days.
//  reminderGate    Gate flag for the push-notification opt-in banner – only
//                  true when the user was absent for ≥1 day (prevents showing
//                  on the very first session).

import { useState, useEffect, useCallback } from 'react'
import type { Friend } from '../types'

// ── Module-level constants ────────────────────────────────────────────────

const SHARE_MIGRATION_MARKER = 'rm-share-migration-v213'
const WELCOME_BACK_SESSION_KEY = 'rm-welcome-back-shown-this-session'

// ── Hook ─────────────────────────────────────────────────────────────────

interface UseBannersOptions {
  isLoaded: boolean
  friends: Friend[]
  streak: { lastAnswerDate: string | null }
  checkStreakReset: () => void
}

export interface BannerState {
  showShareMigration: boolean
  dismissShareMigration: () => void
  showReleaseNotes: boolean
  setShowReleaseNotes: (show: boolean) => void
  showWelcomeBack: boolean
  setShowWelcomeBack: (show: boolean) => void
  /** True once the welcome-back banner was shown in this tab session, used to
   *  prevent the reminder banner from immediately replacing it (#156). */
  welcomeBackShownThisSession: boolean
  /** Gate for the push-notification opt-in banner: absent ≥1 day. */
  reminderBannerGate: boolean
}

export function useBanners({
  isLoaded,
  friends,
  streak,
  checkStreakReset,
}: UseBannersOptions): BannerState {
  const [showReleaseNotes, setShowReleaseNotes] = useState(false)
  const [showShareMigration, setShowShareMigration] = useState(false)
  const [showWelcomeBack, setShowWelcomeBack] = useState(false)
  const [welcomeBackShownThisSession, setWelcomeBackShownThisSession] = useState(() => {
    try { return sessionStorage.getItem(WELCOME_BACK_SESSION_KEY) === '1' } catch { return false }
  })

  // Share migration banner: one-time notice for users with legacy connections.
  // Fresh installs pre-set the marker so a future first connection doesn't
  // trigger the banner unnecessarily.
  useEffect(() => {
    if (!isLoaded) return
    try {
      if (localStorage.getItem(SHARE_MIGRATION_MARKER)) return
      const hasOnlineFriends = friends.some(f => f.online)
      if (!hasOnlineFriends) {
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

  // Welcome back banner: show when the user returns after ≥3 days absence.
  // Also resets the streak if the gap broke it.
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
      checkStreakReset()
    }
  }, [isLoaded, streak.lastAnswerDate, checkStreakReset])

  // Reminder banner gate: only show the push-notification opt-in after ≥1 day
  // of absence. Showing it on the very first session creates no perceived value.
  const daysSinceLastAnswer = streak.lastAnswerDate
    ? Math.floor(
        (Date.now() - new Date(streak.lastAnswerDate + 'T00:00:00').getTime()) /
          (24 * 60 * 60 * 1000),
      )
    : null
  const reminderBannerGate = daysSinceLastAnswer !== null && daysSinceLastAnswer >= 1

  return {
    showShareMigration,
    dismissShareMigration,
    showReleaseNotes,
    setShowReleaseNotes,
    showWelcomeBack,
    setShowWelcomeBack,
    welcomeBackShownThisSession,
    reminderBannerGate,
  }
}

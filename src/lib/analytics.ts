/**
 * PostHog wrapper – cookie-less, EU Cloud, no autocapture.
 *
 * All functions are safe no-ops when VITE_POSTHOG_KEY is not set.
 * Call initPostHog() once at app startup before any track* calls.
 */
import posthog from 'posthog-js'

export function initPostHog(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined
  if (!key) return
  posthog.init(key, {
    api_host: 'https://eu.i.posthog.com',
    ui_host: 'https://eu.posthog.com',
    // No cookies, no localStorage – fresh anonymous id per session
    persistence: 'memory',
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    // IP disabled by default on EU Cloud, make it explicit
    ip: false,
  })
}

// ── Quiz ────────────────────────────────────────────────────────────────────

export function trackQuizStarted(categoryId: string, questionCount: number): void {
  posthog.capture('quiz_started', { category_id: categoryId, question_count: questionCount })
}

export function trackQuizCompleted(categoryId: string, questionCount: number): void {
  posthog.capture('quiz_completed', { category_id: categoryId, question_count: questionCount })
}

export function trackQuizAbandoned(categoryId: string, atQuestion: number, questionCount: number): void {
  posthog.capture('quiz_abandoned', {
    category_id: categoryId,
    at_question: atQuestion,
    question_count: questionCount,
  })
}

export function trackQuizMediaAdded(categoryId: string, mediaType: 'image' | 'video' | 'audio'): void {
  posthog.capture('quiz_media_added', { category_id: categoryId, media_type: mediaType })
}

// ── Onboarding ───────────────────────────────────────────────────────────────

export function trackOnboardingStarted(): void {
  posthog.capture('onboarding_started')
}

export function trackOnboardingCompleted(importedBackup: boolean): void {
  posthog.capture('onboarding_completed', { imported_backup: importedBackup })
}

// ── Navigation ───────────────────────────────────────────────────────────────

export function trackTabChanged(tab: string): void {
  posthog.capture('tab_changed', { tab })
}

export function trackFeatureOpened(feature: string): void {
  posthog.capture('feature_opened', { feature })
}

// ── Session ──────────────────────────────────────────────────────────────────

export function trackSessionStarted(returningUser: boolean): void {
  posthog.capture('session_started', { returning_user: returningUser })
}

// ── Share & Friends ──────────────────────────────────────────────────────────

export function trackShareInitiated(method: 'local-zip' | 'online-link' | 'online-qr' | 'sandra-flow'): void {
  posthog.capture('share_initiated', { method })
}

export function trackOnlineSharingActivated(): void {
  posthog.capture('online_sharing_activated')
}

// Lazy-loads supabaseClient (only when the user actually submits feedback) so
// the offline code path never touches @supabase/supabase-js — same opt-in
// contract that sharingService obeys. Static imports of supabaseClient are
// rejected by src/utils/optin.test.ts.

export interface FeedbackPayload {
  rating: number
  comment?: string
}

export type FeedbackResult =
  | { ok: true }
  | { ok: false; reason: 'not-configured' | 'network' | 'unknown'; error?: string }

export async function submitFeedback(payload: FeedbackPayload): Promise<FeedbackResult> {
  const { getSupabaseClient, isOnlineSharingConfigured } = await import('./supabaseClient')

  if (!isOnlineSharingConfigured()) {
    return { ok: false, reason: 'not-configured' }
  }

  const comment = payload.comment?.trim()
  const row = {
    rating: payload.rating,
    comment: comment && comment.length > 0 ? comment.slice(0, 500) : null,
  }

  try {
    const supabase = getSupabaseClient()
    const { error } = await supabase.from('feedback_submissions').insert(row)
    if (error) return { ok: false, reason: 'unknown', error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: 'network', error: e instanceof Error ? e.message : String(e) }
  }
}

const SUBMITTED_AT_KEY = 'rm-feedback-submitted-at'
const ACK_WINDOW_MS = 60 * 24 * 60 * 60 * 1000 // 60 days

export function markFeedbackSubmitted(now = new Date()): void {
  try { localStorage.setItem(SUBMITTED_AT_KEY, now.toISOString()) } catch { /* storage may be blocked */ }
}

export function feedbackRecentlySubmitted(now = new Date()): boolean {
  try {
    const raw = localStorage.getItem(SUBMITTED_AT_KEY)
    if (!raw) return false
    const ts = Date.parse(raw)
    if (Number.isNaN(ts)) return false
    return now.getTime() - ts < ACK_WINDOW_MS
  } catch {
    return false
  }
}

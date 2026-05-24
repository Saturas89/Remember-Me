// ── Supabase-backed invite codes for short Sandra-invite links ───────────────
//
// Sandra creates a short code that maps to her question pack + contact
// handshake. Ingrid resolves the code via Supabase SELECT. After Ingrid
// accepts, she writes her own contact back (UPDATE response). Sandra polls
// periodically and auto-adds Ingrid as a friend when the response appears.
//
// All operations call ensureAnonymousSession() first so RLS policies
// (authenticated role) work even for first-time users without online sharing.

import { getSupabaseClient, ensureAnonymousSession } from './supabaseClient'
import type { ContactHandshake, QuestionPack } from '../types'

// Unambiguous alphabet: no O/0/I/1/8/B/L – readable on paper and over the phone.
const INVITE_ALPHABET = 'ACDEFGHJKMNPQRTVWXYZ234679'

function generateInviteCode(): string {
  const arr = new Uint8Array(6)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => INVITE_ALPHABET[b % INVITE_ALPHABET.length]).join('')
}

export interface InvitePayload {
  pack: QuestionPack
  contact: ContactHandshake
}

/**
 * Creates an invite in Supabase and returns the short URL.
 * Sandra's device must already have an authenticated session.
 */
export async function createInviteAndGetUrl(pack: QuestionPack, contact: ContactHandshake): Promise<string> {
  await ensureAnonymousSession()
  const supabase = getSupabaseClient()
  const code = generateInviteCode()
  const payload: InvitePayload = { pack, contact }
  const { error } = await supabase.from('invites').insert({ code, payload })
  if (error) throw new Error('invite-create-failed')
  const origin = import.meta.env.VITE_E2E === 'true' ? window.location.origin : 'https://storyhold.app'
  return `${origin}/join/${code}`
}

/**
 * Resolves a short invite code to its payload.
 * Safe to call without prior online-sharing opt-in (creates anon session).
 */
export async function resolveInviteCode(code: string): Promise<InvitePayload> {
  await ensureAnonymousSession()
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('invites')
    .select('payload')
    .eq('code', code.toUpperCase())
    .single()
  if (error || !data) throw new Error('invite-not-found')
  return data.payload as InvitePayload
}

/**
 * Ingrid writes her contact info into the invite row.
 * Silently ignored if already responded (Supabase RLS prevents overwrite).
 */
export async function submitInviteResponse(code: string, responder: ContactHandshake): Promise<void> {
  await ensureAnonymousSession()
  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('invites')
    .update({ response: responder })
    .eq('code', code.toUpperCase())
  if (error) throw new Error('invite-response-failed')
}

/**
 * Sandra polls this to check whether Ingrid has accepted.
 * Returns null when no response yet.
 */
export async function pollInviteResponse(code: string): Promise<ContactHandshake | null> {
  const supabase = getSupabaseClient()
  const { data } = await supabase
    .from('invites')
    .select('response')
    .eq('code', code.toUpperCase())
    .single()
  return (data?.response as ContactHandshake | null) ?? null
}

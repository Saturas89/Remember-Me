// ── URL Parsing ─────────────────────────────────────────────────────────────
//
// Detects and asynchronously resolves special entry-point URLs on first mount:
//
//  /join/CODE      Short invite code → resolves pack + optional contact from
//                  Supabase (Sandra invite flow).
//  #mi/…           Secure invite hash → opens FriendAnswerView for Ingrid.
//  #ma/…           Answer import hash → auto-imports into archive.
//  #ms/…           Memory share hash → opens SharedMemoryView.
//  #/ask           Sandra compose hash → navigates to SandraFlowView.
//
// All detection constants are evaluated once at module load so they're stable
// across React renders and can be used for the initial view decision.

import { useState, useEffect } from 'react'
import {
  isSecureInviteHash,
  isAnswerHash,
  isMemoryShareHash,
  parseSecureInviteFromHash,
  parseAnswerFromHash,
  parseMemoryShareFromHash,
} from '../utils/secureLink'
import type { QuestionPack, InviteData, AnswerExport, MemorySharePayload, ContactHandshake } from '../types'

// ── Module-level detection (evaluated once at import time) ─────────────────

const joinMatch = window.location.pathname.match(/^\/join\/([A-Z0-9]{6})$/i)
const isJoinPath = Boolean(joinMatch)

/** True when the current URL requires an async parse before the app renders. */
export const needsAsyncParse =
  isJoinPath || isSecureInviteHash() || isAnswerHash() || isMemoryShareHash()

/** True when a #/ask hash is present (and no other async URL overrides it). */
export const initialSandraHash = !needsAsyncParse && window.location.hash.startsWith('#/ask')

// ── Hook ──────────────────────────────────────────────────────────────────

interface UseUrlParsingOptions {
  /** Signals that app state is loaded and pending imports can be processed. */
  isLoaded: boolean
  /** Imports Ingrid's answers from an #ma/ payload into the local archive. */
  importFriendAnswers: (data: AnswerExport) => void
  /** Called after a successful #ma/ import so the router can navigate to /friends. */
  onFriendAnswersImported: () => void
}

export interface UrlParsingState {
  /** Set when the URL is a #mi/ secure invite – renders FriendAnswerView. */
  asyncInvite: InviteData | null
  /** Set when the URL is a #ms/ memory share – renders SharedMemoryView. */
  sharedMemory: MemorySharePayload | null
  /** Set when the URL is a /join/ or personal-pack payload. */
  incomingPack: QuestionPack | null
  setIncomingPack: (p: QuestionPack | null) => void
  /** Optional contact handshake embedded in a /join/ invite. */
  embeddedContact: ContactHandshake | null
  setEmbeddedContact: (c: ContactHandshake | null) => void
  /** Short invite code from /join/CODE, threaded to ContactHandshakeView. */
  activeInviteCode: string | null
  setActiveInviteCode: (c: string | null) => void
  /** Pending contact to confirm after Ingrid finishes the personal-pack quiz. */
  pendingContact: ContactHandshake | null
  setPendingContact: (c: ContactHandshake | null) => void
  /** True while the URL is still being parsed – blocks rendering to avoid flicker. */
  urlParsing: boolean
}

export function useUrlParsing({
  isLoaded,
  importFriendAnswers,
  onFriendAnswersImported,
}: UseUrlParsingOptions): UrlParsingState {
  const [asyncInvite, setAsyncInvite] = useState<InviteData | null>(null)
  const [pendingAnswerImport, setPendingAnswerImport] = useState<AnswerExport | null>(null)
  const [sharedMemory, setSharedMemory] = useState<MemorySharePayload | null>(null)
  const [incomingPack, setIncomingPack] = useState<QuestionPack | null>(null)
  const [urlParsing, setUrlParsing] = useState(needsAsyncParse)
  const [pendingContact, setPendingContact] = useState<ContactHandshake | null>(null)
  const [embeddedContact, setEmbeddedContact] = useState<ContactHandshake | null>(null)
  const [activeInviteCode, setActiveInviteCode] = useState<string | null>(null)

  // Resolve async URL payloads on first mount
  useEffect(() => {
    if (!needsAsyncParse) return
    if (isJoinPath && joinMatch) {
      const code = joinMatch[1].toUpperCase()
      import('../utils/inviteService')
        .then(m => m.resolveInviteCode(code))
        .then(({ pack, contact }) => {
          setIncomingPack(pack)
          setEmbeddedContact(contact)
          setActiveInviteCode(code)
          history.replaceState({}, '', '/')
        })
        .catch(() => {
          // Unknown / expired code – clear the path and stay on home.
          history.replaceState({}, '', '/')
        })
        .finally(() => setUrlParsing(false))
    } else if (isSecureInviteHash()) {
      parseSecureInviteFromHash()
        .then(invite => { setAsyncInvite(invite) })
        .finally(() => setUrlParsing(false))
    } else if (isAnswerHash()) {
      parseAnswerFromHash()
        .then(answers => { if (answers) setPendingAnswerImport(answers) })
        .finally(() => setUrlParsing(false))
    } else if (isMemoryShareHash()) {
      parseMemoryShareFromHash()
        .then(payload => { if (payload) setSharedMemory(payload) })
        .finally(() => setUrlParsing(false))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-import answers when an #ma/ URL was opened and state is ready
  useEffect(() => {
    if (!pendingAnswerImport || !isLoaded) return
    importFriendAnswers(pendingAnswerImport)
    setPendingAnswerImport(null)
    history.replaceState({}, '', '/friends')
    onFriendAnswersImported()
  }, [pendingAnswerImport, isLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    asyncInvite,
    sharedMemory,
    incomingPack,
    setIncomingPack,
    embeddedContact,
    setEmbeddedContact,
    activeInviteCode,
    setActiveInviteCode,
    pendingContact,
    setPendingContact,
    urlParsing,
  }
}

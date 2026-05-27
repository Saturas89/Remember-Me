// ── URL Parsing ─────────────────────────────────────────────────────────────
//
// Detects and asynchronously resolves special entry-point URLs on first mount:
//
//  /join/CODE      Short invite code → resolves pack + optional contact from
//                  Supabase (Sandra invite flow).
//
// All detection constants are evaluated once at module load so they're stable
// across React renders and can be used for the initial view decision.

import { useState, useEffect } from 'react'
import type { QuestionPack, ContactHandshake } from '../types'

// ── Module-level detection (evaluated once at import time) ─────────────────

const joinMatch = window.location.pathname.match(/^\/join\/([A-Z0-9]{6})$/i)
const isJoinPath = Boolean(joinMatch)

/** True when the current URL requires an async parse before the app renders. */
export const needsAsyncParse = isJoinPath

// ── Hook ──────────────────────────────────────────────────────────────────

export interface UrlParsingState {
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

export function useUrlParsing(): UrlParsingState {
  const [incomingPack, setIncomingPack] = useState<QuestionPack | null>(null)
  const [urlParsing, setUrlParsing] = useState(needsAsyncParse)
  const [pendingContact, setPendingContact] = useState<ContactHandshake | null>(null)
  const [embeddedContact, setEmbeddedContact] = useState<ContactHandshake | null>(null)
  const [activeInviteCode, setActiveInviteCode] = useState<string | null>(null)

  // Resolve async URL payloads on first mount
  useEffect(() => {
    if (!isJoinPath || !joinMatch) return
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return {
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

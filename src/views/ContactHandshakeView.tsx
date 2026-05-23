import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '../locales'
import type { ContactHandshake } from '../types'

/** Waiting-state milestones for the contact-handshake (#165). After 3 s we
 *  add a reassuring time hint; after 10 s a retry; after 30 s a clearer
 *  failure message. */
const HANDSHAKE_HINT_MS = 3_000
const HANDSHAKE_RETRY_MS = 10_000
const HANDSHAKE_TIMEOUT_MS = 30_000

interface Props {
  handshake: ContactHandshake
  profileName: string
  /** Current device's online identity. Null until the online-sync session
   *  is ready. */
  myDeviceId: string | null
  myPublicKey: string | null
  enabled: boolean
  onEnable: () => void
  /** Called once when the handshake auto-accepts AND again whenever the
   *  user flips the share-all checkbox after acceptance. */
  onAcceptContact: (h: ContactHandshake, shareAll: boolean) => void
  onDismiss: () => void
  /** When set (Sandra-invite flow), Ingrid's contact is automatically written
   *  back to Supabase after acceptance so Sandra auto-adds her. */
  inviteCode?: string
}

/**
 * Shown after Ingrid finishes the Sandra quiz. Establishes the bidirectional
 * Family Mode connection:
 *   1. Adds Sandra as a local friend (via onAcceptContact).
 *   2. Writes Ingrid's own contact to the invite row in Supabase so Sandra
 *      can auto-add her via usePendingInviteResponses polling.
 */
export function ContactHandshakeView({
  handshake,
  profileName,
  myDeviceId,
  myPublicKey,
  enabled,
  onEnable,
  onAcceptContact,
  onDismiss,
  inviteCode,
}: Props) {
  const { t } = useTranslation()
  const c = t.contactHandshake
  const [accepted, setAccepted] = useState(false)
  // REQ-022 §4.2: binary opt-in. Default checked so Ingrid never needs to
  // think about it. Late toggles re-call onAcceptContact, which the parent
  // upserts into friend.online.shareAll.
  const [shareAllOptIn, setShareAllOptIn] = useState(true)
  const lastAcceptedShareAllRef = useRef<boolean | null>(null)

  // Persona-led waiting feedback (#165) — track how long the
  // "enabled && !myDeviceId" connecting state has lingered.
  const [waitElapsed, setWaitElapsed] = useState(0)
  const isWaiting = enabled && !myDeviceId
  useEffect(() => {
    if (!isWaiting) {
      setWaitElapsed(0)
      return
    }
    const start = Date.now()
    const interval = setInterval(() => setWaitElapsed(Date.now() - start), 500)
    return () => clearInterval(interval)
  }, [isWaiting])

  // Auto-accept once online sharing is ready. Idempotent and re-fires on
  // shareAllOptIn changes after acceptance (REQ-022 FR-22.5).
  useEffect(() => {
    if (!enabled) return
    if (accepted && lastAcceptedShareAllRef.current === shareAllOptIn) return
    onAcceptContact(handshake, shareAllOptIn)
    lastAcceptedShareAllRef.current = shareAllOptIn
    if (!accepted) setAccepted(true)
  }, [enabled, accepted, handshake, onAcceptContact, shareAllOptIn])

  // After acceptance, silently write Ingrid's contact back to the invite row
  // so Sandra auto-adds her via usePendingInviteResponses.
  useEffect(() => {
    if (!accepted || !inviteCode || !myDeviceId || !myPublicKey) return
    const responder: ContactHandshake = {
      $type: 'remember-me-contact',
      version: 1,
      deviceId: myDeviceId,
      publicKey: myPublicKey,
      displayName: profileName,
    }
    import('../utils/inviteService')
      .then(m => m.submitInviteResponse(inviteCode, responder))
      .catch(() => { /* silent – Sandra pollt beim nächsten Mal erneut */ })
  }, [accepted, inviteCode, myDeviceId, myPublicKey, profileName])

  return (
    <div className="friends-view">
      <div className="quiz-topbar">
        <button className="btn btn--ghost btn--sm" onClick={onDismiss}>{c.cancel}</button>
        <h2 className="archive-title">{c.title}</h2>
      </div>

      <section className="friends-section">
        <p className="friends-hint">
          <strong>{handshake.displayName || c.introTextDefaultName}</strong>{c.introTextSuffix}
        </p>

        {!enabled && (
          <>
            <p className="friends-hint">{c.notEnabledHint}</p>
            <button className="share-cta-btn" onClick={onEnable}>
              {c.enableButton}
            </button>
          </>
        )}

        {enabled && !myDeviceId && (
          <div className="contact-handshake__waiting">
            <p className="friends-hint">{c.connecting}</p>
            {waitElapsed >= HANDSHAKE_HINT_MS && waitElapsed < HANDSHAKE_TIMEOUT_MS && (
              <p className="friends-hint">{c.connectingHint}</p>
            )}
            {waitElapsed >= HANDSHAKE_RETRY_MS && waitElapsed < HANDSHAKE_TIMEOUT_MS && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={onEnable}
                data-testid="contact-handshake-retry"
              >
                {c.connectingRetry}
              </button>
            )}
            {waitElapsed >= HANDSHAKE_TIMEOUT_MS && (
              <p className="friends-hint friends-hint--warn">{c.connectingTimeout}</p>
            )}
          </div>
        )}

        {enabled && myDeviceId && (
          <>
            <p className="friends-hint">
              {c.savedHint.replace('{name}', handshake.displayName || c.savedHintDefaultName)}
            </p>

            <label className="online-consent" data-testid="contact-handshake-shareall">
              <input
                type="checkbox"
                checked={shareAllOptIn}
                onChange={e => setShareAllOptIn(e.target.checked)}
              />
              <span>
                <strong>
                  {c.shareAllOptInLabel.replace('{name}', handshake.displayName || c.savedHintDefaultName)}
                </strong>
                <br />
                <small className="friends-hint">
                  {c.shareAllOptInHint.replace('{name}', handshake.displayName || c.savedHintDefaultName)}
                </small>
              </span>
            </label>

            <button
              className="btn btn--ghost btn--sm"
              style={{ marginTop: '0.75rem' }}
              onClick={onDismiss}
            >
              {c.doneButton}
            </button>
          </>
        )}
      </section>
    </div>
  )
}

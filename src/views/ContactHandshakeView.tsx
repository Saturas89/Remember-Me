import { useEffect, useMemo, useRef, useState } from 'react'
import { generateContactUrl, shareOrCopy } from '../utils/secureLink'
import { generateShareCard } from '../utils/shareCard'
import { useTranslation } from '../locales'
import type { ContactHandshake } from '../types'

interface Props {
  handshake: ContactHandshake
  profileName: string
  /** Current device's online identity – shown so the user can complete the
   *  handshake by sending their own link back. Null until the online-sync
   *  session is ready. */
  myDeviceId: string | null
  myPublicKey: string | null
  enabled: boolean
  onEnable: () => void
  onAcceptContact: (h: ContactHandshake) => void
  onDismiss: () => void
}

/**
 * Shown when the app opens with a #contact/… URL. Lets the user
 *   1. understand who wants to connect,
 *   2. enable online sharing if they haven't already,
 *   3. confirm adding the contact,
 *   4. share their own handshake link back so the connection is bidirectional.
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
}: Props) {
  const { t } = useTranslation()
  const c = t.contactHandshake
  const [accepted, setAccepted] = useState(false)
  const [copied, setCopied] = useState(false)
  const shareCardRef = useRef<File | null>(null)

  const myLink = useMemo(() => {
    if (!myDeviceId || !myPublicKey) return ''
    const mine: ContactHandshake = {
      $type: 'remember-me-contact',
      version: 1,
      deviceId: myDeviceId,
      publicKey: myPublicKey,
      displayName: profileName,
    }
    return generateContactUrl(mine)
  }, [myDeviceId, myPublicKey, profileName])

  useEffect(() => {
    if (!myLink || !profileName) return
    fetch('/pwa-192x192.png')
      .then(r => r.blob())
      .then(b => generateShareCard(b, {
        title: c.shareCardTitleWithName.replace('{name}', profileName),
        subtitle: c.shareCardSubtitle,
      }))
      .then(f => { shareCardRef.current = f })
      .catch(() => {})
  }, [myLink, profileName, c.shareCardTitleWithName, c.shareCardSubtitle])

  // Auto-accept once online sharing is ready (the user already consented by
  // clicking "Aktivieren" in the intro). This is idempotent.
  useEffect(() => {
    if (enabled && !accepted) {
      onAcceptContact(handshake)
      setAccepted(true)
    }
  }, [enabled, accepted, handshake, onAcceptContact])

  const shareBack = async () => {
    if (!myLink) return
    const card = shareCardRef.current
    if (card && typeof navigator.share === 'function' && navigator.canShare?.({ files: [card] })) {
      const text = `${c.shareBackText.replace('{name}', profileName)}\n\n${myLink}`
      try {
        await navigator.share({ files: [card], title: c.shareSheetTitle, text })
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
      }
    }
    const sent = await shareOrCopy({
      title: c.shareSheetTitle,
      text: c.shareBackText.replace('{name}', profileName),
      url: myLink,
    })
    if (!sent) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

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
          <p className="friends-hint">{c.connecting}</p>
        )}

        {enabled && myDeviceId && (
          <>
            <p className="friends-hint">
              {c.savedHint.replace('{name}', handshake.displayName || c.savedHintDefaultName)}
            </p>
            <button className="share-cta-btn" onClick={shareBack}>
              {copied ? c.shareBackCopied : c.shareBackButton}
            </button>
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

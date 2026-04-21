import { useEffect, useMemo, useState } from 'react'
import { generateContactUrl, shareOrCopy } from '../utils/secureLink'
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
  const [accepted, setAccepted] = useState(false)
  const [copied, setCopied] = useState(false)

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
    const sent = await shareOrCopy({
      title: 'Remember Me – Online-Kontakt',
      text: `${profileName} möchte sich mit dir verknüpfen. Öffne diesen Link:`,
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
        <button className="btn btn--ghost btn--sm" onClick={onDismiss}>Abbrechen</button>
        <h2 className="archive-title">Kontakt verknüpfen</h2>
      </div>

      <section className="friends-section">
        <p className="friends-hint">
          <strong>{handshake.displayName || 'Jemand'}</strong> möchte sich mit
          dir für Online-Erinnerungen verknüpfen.
        </p>

        {!enabled && (
          <>
            <p className="friends-hint">
              Dafür musst du Online-Teilen in Remember Me einmalig aktivieren.
              Deine bestehenden Antworten bleiben weiterhin nur auf deinem
              Gerät.
            </p>
            <button className="share-cta-btn" onClick={onEnable}>
              Online-Teilen einrichten
            </button>
          </>
        )}

        {enabled && !myDeviceId && (
          <p className="friends-hint">Verbinde mit Server …</p>
        )}

        {enabled && myDeviceId && (
          <>
            <p className="friends-hint">
              {handshake.displayName || 'Der Kontakt'} wurde in deiner
              Kontaktliste gespeichert (verschlüsselter Public-Key + Geräte-ID).
              Damit ihr euch gegenseitig Erinnerungen schicken könnt, schicke
              jetzt auch deinen Link zurück:
            </p>
            <button className="share-cta-btn" onClick={shareBack}>
              {copied ? 'Link kopiert ✓' : 'Meinen Link zurück senden'}
            </button>
            <button
              className="btn btn--ghost btn--sm"
              style={{ marginTop: '0.75rem' }}
              onClick={onDismiss}
            >
              Fertig
            </button>
          </>
        )}
      </section>
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { FriendCard } from '../components/FriendCard'
import type { Friend, FriendAnswer } from '../types'

interface Props {
  profileName: string
  inviteUrl: string
  friends: Friend[]
  friendAnswers: FriendAnswer[]
  onRemoveFriend: (id: string) => void
  onImportZip: (file: File) => void
  onBack: () => void
}

export function FriendsView({
  profileName,
  inviteUrl,
  friends,
  friendAnswers,
  onRemoveFriend,
  onImportZip,
  onBack,
}: Props) {
  const [isSharing, setIsSharing] = useState(false)
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const zipInputRef = useRef<HTMLInputElement>(null)
  // Pre-load the app icon so it can be included in the share as a file.
  // WhatsApp on iOS only shows the message text when a file is attached;
  // for URL-only shares it renders just the link preview and ignores text.
  const logoBlobRef = useRef<Blob | null>(null)
  useEffect(() => {
    fetch('/pwa-192x192.png')
      .then(r => r.blob())
      .then(b => { logoBlobRef.current = b })
      .catch(() => {})
  }, [])

  // Auto-clear the "Kopiert!" / "Fehler" status after a moment.
  useEffect(() => {
    if (shareStatus === 'idle') return
    const t = setTimeout(() => setShareStatus('idle'), 2500)
    return () => clearTimeout(t)
  }, [shareStatus])

  function buildText(url: string) {
    return `Ich möchte meine Lebensgeschichte für immer festhalten – und deine Erinnerungen an mich sind ein unverzichtbarer Teil davon. Würdest du kurz ein paar Fragen über mich beantworten? Das wäre ein unvergessliches Geschenk 💛\n\n${url}`
  }

  // Synchronous share handler: Safari requires navigator.share() to be called
  // directly inside the click gesture (no awaits before the call).
  function handleShare() {
    if (isSharing) return

    const url   = inviteUrl
    const text  = buildText(url)
    const name  = profileName.trim()
    const title = name ? `${name}s Lebensarchiv` : 'Mein Lebensarchiv'
    setIsSharing(true)

    // Mirror the ZIP-share pattern: share the icon as a file so WhatsApp iOS
    // treats this as a "message with attachment" and shows the full text.
    const blob = logoBlobRef.current
    if (blob && typeof navigator.share === 'function') {
      const logoFile = new File([blob], 'remember-me.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [logoFile] })) {
        navigator
          .share({ files: [logoFile], title, text })
          .then(() => setIsSharing(false))
          .catch(err => {
            setIsSharing(false)
            if ((err as Error).name !== 'AbortError') fallbackShare(text)
          })
        return
      }
    }

    // Fallback: text-only share (no separate url field — mirrors ZIP text)
    if (typeof navigator.share === 'function') {
      navigator
        .share({ title, text })
        .then(() => setIsSharing(false))
        .catch(err => {
          setIsSharing(false)
          if ((err as Error).name !== 'AbortError') fallbackShare(text)
        })
    } else {
      fallbackShare(text)
      setIsSharing(false)
    }
  }

  function fallbackShare(text: string) {
    navigator.clipboard
      ?.writeText(text)
      .then(() => setShareStatus('copied'))
      .catch(() => setShareStatus('error'))
  }

  return (
    <div className="friends-view">
      <div className="quiz-topbar">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>
          ← Zurück
        </button>
        <h2 className="archive-title">Erinnerung einsammeln</h2>
      </div>

      {/* Permanent share link */}
      <section className="friends-section">
        <h3 className="friends-section-title">Dein Einladungslink</h3>
        {!profileName && (
          <p className="friends-hint friends-hint--warn">
            Tipp: Gib deinen Namen auf der Startseite ein, damit die Einladung personalisiert ist.
          </p>
        )}
        <p className="friends-hint">
          Lade Freunde und Familie ein, ihre Erinnerungen an dich festzuhalten.
          Teile den Link beliebig oft – jede Person gibt ihren Namen ein, wählt eine Kategorie
          und schickt dir die Antworten zurück. Sie werden automatisch in deinem persönlichen
          Lebensarchiv gespeichert.
        </p>

        <div className="friends-share">
          <button
            className={`share-cta-btn${shareStatus === 'copied' ? ' share-cta-btn--success' : shareStatus === 'error' ? ' share-cta-btn--error' : ''}`}
            onClick={handleShare}
            disabled={isSharing}
          >
            {isSharing ? (
              <><span className="share-cta-btn__spinner" aria-hidden="true" />Wird geöffnet…</>
            ) : shareStatus === 'copied' ? (
              '✓ Nachricht kopiert!'
            ) : shareStatus === 'error' ? (
              '⚠ Nochmal versuchen'
            ) : (
              '📤 Link teilen'
            )}
          </button>
        </div>
      </section>

      {/* Friends list – entries are auto-created when answers come in */}
      {friends.length > 0 && (
        <section className="friends-section">
          <h3 className="friends-section-title">
            Erinnerungen von ({friends.length})
          </h3>
          <div className="friends-list">
            {friends.map(f => (
              <FriendCard
                key={f.id}
                friend={f}
                answers={friendAnswers.filter(a => a.friendId === f.id)}
                onRemove={() => onRemoveFriend(f.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ZIP import for friends who attached photos / audio / video */}
      <section className="friends-section">
        <h3 className="friends-section-title">Erinnerungen mit Anhängen empfangen</h3>
        <p className="friends-hint">
          Hat ein Freund Fotos, Aufnahmen oder Videos mitgeschickt? Öffne die Datei hier und sie landen in deinem Archiv.
        </p>
        <button
          className="btn btn--ghost btn--sm"
          onClick={() => zipInputRef.current?.click()}
        >
          🎁 Erinnerungen öffnen
        </button>
        <input
          ref={zipInputRef}
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          style={{ display: 'none' }}
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) onImportZip(file)
            e.target.value = ''
          }}
        />
      </section>
    </div>
  )
}

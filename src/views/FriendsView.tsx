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

  // Auto-clear the "Kopiert!" / "Fehler" status after a moment.
  useEffect(() => {
    if (shareStatus === 'idle') return
    const t = setTimeout(() => setShareStatus('idle'), 2500)
    return () => clearTimeout(t)
  }, [shareStatus])

  function buildShareData(url: string) {
    return {
      title: 'Mein persönliches Lebensarchiv',
      text: 'Hallo! Ich erstelle gerade mein persönliches Lebensarchiv mit Erinnerungen und würde mich sehr freuen, wenn du ein paar Fragen über mich beantwortest. Deine Erinnerungen werden ein unvergesslicher Teil davon. 💛',
      url,
    }
  }

  // Synchronous share handler: Safari requires navigator.share() to be called
  // directly inside the click gesture (no awaits before the call).
  function handleShare() {
    if (isSharing) return

    const url = inviteUrl
    const shareData = buildShareData(url)
    setIsSharing(true)

    if (typeof navigator.share === 'function') {
      navigator
        .share(shareData)
        .then(() => {
          setIsSharing(false)
        })
        .catch(err => {
          setIsSharing(false)
          if ((err as Error).name === 'AbortError') return
          // Non-abort error – fall back to clipboard copy.
          navigator.clipboard
            ?.writeText(url)
            .then(() => setShareStatus('copied'))
            .catch(() => setShareStatus('error'))
        })
    } else {
      navigator.clipboard
        .writeText(url)
        .then(() => setShareStatus('copied'))
        .catch(() => setShareStatus('error'))
        .finally(() => setIsSharing(false))
    }
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
              '✓ Link kopiert!'
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

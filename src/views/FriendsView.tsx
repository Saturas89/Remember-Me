import { useState, useEffect } from 'react'
import { FriendCard } from '../components/FriendCard'
import type { Friend, FriendAnswer } from '../types'

interface Props {
  profileName: string
  inviteUrl: string
  friends: Friend[]
  friendAnswers: FriendAnswer[]
  onAddFriend: (name: string) => void
  onRemoveFriend: (id: string) => void
  onBack: () => void
}

export function FriendsView({
  profileName,
  inviteUrl,
  friends,
  friendAnswers,
  onAddFriend,
  onRemoveFriend,
  onBack,
}: Props) {
  const [isSharing, setIsSharing] = useState(false)
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const [pendingName, setPendingName] = useState('')

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

  function handleAddPending(e: React.FormEvent) {
    e.preventDefault()
    const name = pendingName.trim()
    if (!name) return
    const alreadyPending = friends.some(
      f =>
        f.name.trim().toLowerCase() === name.toLowerCase() &&
        !friendAnswers.some(a => a.friendId === f.id),
    )
    if (!alreadyPending) onAddFriend(name)
    setPendingName('')
  }

  const pendingFriends = friends.filter(f => !friendAnswers.some(a => a.friendId === f.id))
  const answeredFriends = friends.filter(f => friendAnswers.some(a => a.friendId === f.id))

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

      {/* Track who the link was sent to */}
      <section className="friends-section">
        <h3 className="friends-section-title">Link gesendet an…</h3>
        <p className="friends-hint">
          Trage ein, an wen du den Link geschickt hast. Offene Anfragen werden im Tab-Badge angezeigt.
        </p>
        <form className="friends-add-form" onSubmit={handleAddPending}>
          <input
            className="friends-add-input"
            type="text"
            placeholder="Name der Person"
            value={pendingName}
            onChange={e => setPendingName(e.target.value)}
            maxLength={80}
          />
          <button className="btn btn--primary btn--sm" type="submit" disabled={!pendingName.trim()}>
            Hinzufügen
          </button>
        </form>
      </section>

      {/* Pending friends – sent invite, no answer yet */}
      {pendingFriends.length > 0 && (
        <section className="friends-section">
          <h3 className="friends-section-title">
            Ausstehend ({pendingFriends.length})
          </h3>
          <div className="friends-list">
            {pendingFriends.map(f => (
              <FriendCard
                key={f.id}
                friend={f}
                answers={[]}
                onRemove={() => onRemoveFriend(f.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Friends who have already answered */}
      {answeredFriends.length > 0 && (
        <section className="friends-section">
          <h3 className="friends-section-title">
            Erinnerungen von ({answeredFriends.length})
          </h3>
          <div className="friends-list">
            {answeredFriends.map(f => (
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
    </div>
  )
}

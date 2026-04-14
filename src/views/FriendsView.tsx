import { useState, useEffect, useRef } from 'react'
import { FriendCard } from '../components/FriendCard'
import { generateSecureInviteUrl } from '../utils/secureLink'
import { decodeAnswerExport } from '../utils/sharing'
import { FRIEND_TOPICS } from '../data/friendQuestions'
import type { Friend, FriendAnswer, AnswerExport } from '../types'

interface Props {
  profileName: string
  friends: Friend[]
  friendAnswers: FriendAnswer[]
  onAddFriend: (name: string, id?: string) => Friend
  onRemoveFriend: (id: string) => void
  onImportAnswers: (data: AnswerExport) => void
  onBack: () => void
}

function newFriendId(): string {
  return `friend-${Date.now()}-${crypto.randomUUID()}`
}

export function FriendsView({
  profileName,
  friends,
  friendAnswers,
  onAddFriend,
  onRemoveFriend,
  onImportAnswers,
  onBack,
}: Props) {
  const [newName, setNewName] = useState('')
  const [selectedTopicId, setSelectedTopicId] = useState(FRIEND_TOPICS[0].id)

  // Stable friend ID for the current draft – resets after each invite is sent
  const pendingId = useRef(newFriendId())

  // Live invite link state
  const [liveUrl, setLiveUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  // Import fallback
  const [importCode, setImportCode] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState(false)

  // Regenerate URL whenever name or topic changes – no debounce so the link
  // is visible and shareable as soon as a name is entered.
  useEffect(() => {
    if (!newName.trim()) {
      setLiveUrl(null)
      setGenerateError(null)
      setIsGenerating(false)
      return
    }
    let cancelled = false
    setIsGenerating(true)
    setGenerateError(null)
    generateSecureInviteUrl({
      profileName: profileName || 'mir',
      friendId: pendingId.current,
      topicId: selectedTopicId,
    })
      .then(url => {
        if (cancelled) return
        setLiveUrl(url)
        setIsGenerating(false)
      })
      .catch(err => {
        if (cancelled) return
        console.error('[FriendsView] generateSecureInviteUrl failed:', err)
        setGenerateError('Einladungslink konnte nicht erstellt werden.')
        setIsGenerating(false)
      })
    return () => {
      cancelled = true
    }
  }, [newName, selectedTopicId, profileName])

  async function ensureLiveUrl(): Promise<string | null> {
    if (liveUrl) return liveUrl
    try {
      setIsGenerating(true)
      setGenerateError(null)
      const url = await generateSecureInviteUrl({
        profileName: profileName || 'mir',
        friendId: pendingId.current,
        topicId: selectedTopicId,
      })
      setLiveUrl(url)
      return url
    } catch (err) {
      console.error('[FriendsView] generateSecureInviteUrl failed:', err)
      setGenerateError('Einladungslink konnte nicht erstellt werden.')
      return null
    } finally {
      setIsGenerating(false)
    }
  }

  function resetDraft() {
    setNewName('')
    setLiveUrl(null)
    setGenerateError(null)
    pendingId.current = newFriendId()
  }

  function buildShareData(url: string) {
    const topic = FRIEND_TOPICS.find(t => t.id === selectedTopicId) ?? FRIEND_TOPICS[0]
    return {
      title: 'Erinnerung einsammeln',
      text: `${profileName || 'Jemand'} möchte deine Erinnerungen festhalten – ${topic.emoji} ${topic.title}`,
      url,
    }
  }

  // IMPORTANT: this must be a synchronous function. Safari requires that
  // navigator.share() is invoked directly within the user gesture (click)
  // handler – any `await` before the call breaks the gesture and Safari
  // rejects with NotAllowedError, after which the clipboard fallback also
  // fails silently. So when we already have `liveUrl`, we call share()
  // synchronously and handle the promise resolution afterwards.
  function handleShare() {
    if (isSharing || !newName.trim()) return

    if (liveUrl) {
      const url = liveUrl
      const name = newName.trim()
      const shareData = buildShareData(url)

      onAddFriend(name, pendingId.current)
      setIsSharing(true)

      if (typeof navigator.share === 'function') {
        // SYNCHRONOUS call – preserves Safari user gesture.
        navigator
          .share(shareData)
          .then(() => {
            setIsSharing(false)
            resetDraft()
          })
          .catch(err => {
            setIsSharing(false)
            if ((err as Error).name === 'AbortError') {
              // User dismissed the share sheet – keep the draft so they can retry.
              return
            }
            // Non-abort error (e.g. share permission denied) – copy to clipboard
            // as a fallback and still reset the draft.
            navigator.clipboard?.writeText(url).catch(() => {})
            resetDraft()
          })
      } else {
        // No Web Share API – copy to clipboard. Call synchronously so the
        // user gesture is preserved for Safari's clipboard permission too.
        navigator.clipboard
          .writeText(url)
          .catch(() => {})
          .finally(() => {
            setIsSharing(false)
            resetDraft()
          })
      }
      return
    }

    // URL not ready yet – generate it, then fall back to clipboard copy.
    // (navigator.share would fail here in Safari because of the await.)
    void shareAfterGenerate()
  }

  async function shareAfterGenerate() {
    const url = await ensureLiveUrl()
    if (!url) return
    const name = newName.trim()
    if (!name) return
    onAddFriend(name, pendingId.current)
    setIsSharing(true)
    try {
      await navigator.clipboard.writeText(url)
    } catch (err) {
      console.error('[FriendsView] clipboard.writeText failed:', err)
    } finally {
      setIsSharing(false)
      resetDraft()
    }
  }

  // Called from FriendCard "Einladen" – generates a fresh URL for an existing
  // friend. Because the URL must be generated first (async), Safari's Web
  // Share API will reject NotAllowedError here; we copy to clipboard instead.
  async function handleReinvite(friendId: string) {
    const url = await generateSecureInviteUrl({
      profileName: profileName || 'mir',
      friendId,
      topicId: selectedTopicId,
    })
    try {
      await navigator.clipboard.writeText(url)
    } catch (err) {
      console.error('[FriendsView] clipboard.writeText failed:', err)
    }
  }

  function handleImport() {
    setImportError(null)
    setImportSuccess(false)
    const data = decodeAnswerExport(importCode)
    if (!data) {
      setImportError('Ungültiger Code. Bitte kopiere den Code vollständig.')
      return
    }
    onImportAnswers(data)
    setImportSuccess(true)
    setImportCode('')
  }

  const topic = FRIEND_TOPICS.find(t => t.id === selectedTopicId) ?? FRIEND_TOPICS[0]

  return (
    <div className="friends-view">
      <div className="quiz-topbar">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>
          ← Zurück
        </button>
        <h2 className="archive-title">Erinnerung einsammeln</h2>
      </div>

      <p className="friends-intro">
        Lade Freunde und Familie ein, ihre Erinnerungen an dich festzuhalten.
        Ihre Antworten werden Teil deines persönlichen Lebensarchivs.
      </p>

      {/* Add friend + topic */}
      <section className="friends-section">
        <h3 className="friends-section-title">Erinnerung anfragen bei</h3>
        {!profileName && (
          <p className="friends-hint friends-hint--warn">
            Tipp: Gib deinen Namen auf der Startseite ein, damit die Einladung personalisiert ist.
          </p>
        )}
        <div className="friends-add-row">
          <input
            className="input-text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Name der Person…"
            onKeyDown={e => e.key === 'Enter' && handleShare()}
          />
        </div>

        <p className="friends-topic-label">Welche Erinnerungen soll sie oder er teilen?</p>
        <div className="friends-topic-grid">
          {FRIEND_TOPICS.map(t => (
            <button
              key={t.id}
              type="button"
              className={`friend-topic-card ${selectedTopicId === t.id ? 'friend-topic-card--active' : ''}`}
              onClick={() => setSelectedTopicId(t.id)}
            >
              <span className="friend-topic-card__emoji">{t.emoji}</span>
              <span className="friend-topic-card__title">{t.title}</span>
              <span className="friend-topic-card__desc">{t.description}</span>
            </button>
          ))}
        </div>

        {/* Share button – appears as soon as a name is entered */}
        {newName.trim() && (
          <div className="invite-preview">
            <div className="invite-preview__chip">
              {topic.emoji} {topic.title} · 5 Fragen
            </div>

            {generateError && (
              <p className="import-msg import-msg--error">{generateError}</p>
            )}

            <button
              className="btn btn--primary share-btn"
              onClick={handleShare}
              disabled={isSharing}
            >
              {isSharing ? (
                <span className="share-btn__spinner">Wird geöffnet…</span>
              ) : isGenerating && !liveUrl ? (
                <span className="share-btn__spinner">Einladung wird erstellt…</span>
              ) : (
                'Erinnerung teilen'
              )}
            </button>
          </div>
        )}
      </section>

      {/* Friends list */}
      {friends.length > 0 && (
        <section className="friends-section">
          <h3 className="friends-section-title">Eingeladene Personen ({friends.length})</h3>
          <div className="friends-list">
            {friends.map(f => (
              <FriendCard
                key={f.id}
                friend={f}
                answers={friendAnswers.filter(a => a.friendId === f.id)}
                onInvite={() => handleReinvite(f.id)}
                onRemove={() => onRemoveFriend(f.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Manual import fallback */}
      <section className="friends-section">
        <h3 className="friends-section-title">Antwort-Code eingeben</h3>
        <p className="friends-hint">
          Hat jemand dir einen Antwortcode geschickt? Füge ihn hier ein:
        </p>
        <textarea
          className="input-textarea"
          value={importCode}
          onChange={e => {
            setImportCode(e.target.value)
            setImportError(null)
            setImportSuccess(false)
          }}
          placeholder="Antwortcode hier einfügen…"
          rows={3}
        />
        {importError && <p className="import-msg import-msg--error">{importError}</p>}
        {importSuccess && (
          <p className="import-msg import-msg--success">Erinnerungen erfolgreich hinzugefügt!</p>
        )}
        <button
          className="btn btn--primary"
          onClick={handleImport}
          disabled={!importCode.trim()}
        >
          Importieren
        </button>
      </section>
    </div>
  )
}

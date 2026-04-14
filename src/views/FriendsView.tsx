import { useState, useEffect, useRef } from 'react'
import { FriendCard } from '../components/FriendCard'
import { generateSecureInviteUrl, shareOrCopy } from '../utils/secureLink'
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

  // Regenerate URL whenever name or topic changes (debounced 350 ms)
  useEffect(() => {
    if (!newName.trim()) {
      setLiveUrl(null)
      setGenerateError(null)
      return
    }
    setIsGenerating(true)
    setGenerateError(null)
    const timer = setTimeout(() => {
      generateSecureInviteUrl({
        profileName: profileName || 'mir',
        friendId: pendingId.current,
        topicId: selectedTopicId,
      })
        .then(url => { setLiveUrl(url); setIsGenerating(false) })
        .catch(err => {
          console.error('[FriendsView] generateSecureInviteUrl failed:', err)
          setGenerateError('Einladungslink konnte nicht erstellt werden.')
          setIsGenerating(false)
        })
    }, 350)
    return () => clearTimeout(timer)
  }, [newName, selectedTopicId, profileName])

  async function handleShare() {
    if (!liveUrl || isSharing) return
    onAddFriend(newName.trim(), pendingId.current)

    const topic = FRIEND_TOPICS.find(t => t.id === selectedTopicId) ?? FRIEND_TOPICS[0]
    setIsSharing(true)
    try {
      await shareOrCopy({
      title: 'Erinnerung einsammeln',
      text: `${profileName || 'Jemand'} möchte deine Erinnerungen festhalten – ${topic.emoji} ${topic.title}`,
      url: liveUrl,
    })
    } finally {
      setIsSharing(false)
    }

    // Reset for next friend
    setNewName('')
    setLiveUrl(null)
    setGenerateError(null)
    pendingId.current = newFriendId()
  }

  // Called from FriendCard "Einladen" – generates fresh URL for existing friend
  async function handleReinvite(friendId: string) {
    const topic = FRIEND_TOPICS.find(t => t.id === selectedTopicId) ?? FRIEND_TOPICS[0]
    const url = await generateSecureInviteUrl({
      profileName: profileName || 'mir',
      friendId,
      topicId: selectedTopicId,
    })
    await shareOrCopy({
      title: 'Erinnerung einsammeln',
      text: `${profileName || 'Jemand'} möchte deine Erinnerungen festhalten – ${topic.emoji} ${topic.title}`,
      url,
    })
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
            {generateError ? (
              <p className="import-msg import-msg--error">{generateError}</p>
            ) : (
              <button
                className="btn btn--primary share-btn"
                onClick={handleShare}
                disabled={isGenerating || isSharing || !liveUrl}
              >
                {isGenerating ? (
                  <span className="share-btn__spinner">Einladung wird erstellt…</span>
                ) : isSharing ? (
                  <span className="share-btn__spinner">Wird geöffnet…</span>
                ) : (
                  'Erinnerung teilen'
                )}
              </button>
            )}
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

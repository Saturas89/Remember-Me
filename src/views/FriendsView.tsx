import { useState } from 'react'
import { FriendCard } from '../components/FriendCard'
import { generateSecureInviteUrl, shareOrCopy } from '../utils/secureLink'
import { decodeAnswerExport } from '../utils/sharing'
import { FRIEND_TOPICS } from '../data/friendQuestions'
import type { Friend, FriendAnswer, AnswerExport } from '../types'

interface Props {
  profileName: string
  friends: Friend[]
  friendAnswers: FriendAnswer[]
  onAddFriend: (name: string) => Friend
  onRemoveFriend: (id: string) => void
  onImportAnswers: (data: AnswerExport) => void
  onBack: () => void
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

  // Invite state
  const [isGenerating, setIsGenerating] = useState(false)
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null)
  const [fallbackTopicLabel, setFallbackTopicLabel] = useState('')
  const [copied, setCopied] = useState(false)

  // Import fallback
  const [importCode, setImportCode] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState(false)

  async function handleAdd() {
    if (!newName.trim() || isGenerating) return
    const friend = onAddFriend(newName.trim())
    setNewName('')
    await triggerShare(profileName || 'mir', friend.id, selectedTopicId)
  }

  async function triggerShare(name: string, friendId: string, topicId: string) {
    const topic = FRIEND_TOPICS.find(t => t.id === topicId) ?? FRIEND_TOPICS[0]
    setIsGenerating(true)
    setFallbackUrl(null)
    try {
      const url = await generateSecureInviteUrl({ profileName: name, friendId, topicId })
      const didShare = await shareOrCopy({
        title: 'Erinnerung einsammeln',
        text: `${name} möchte deine Erinnerungen an sie oder ihn festhalten – ${topic.emoji} ${topic.title}`,
        url,
      })
      if (!didShare) {
        // Web Share not available or was cancelled → show copy fallback
        setFallbackUrl(url)
        setFallbackTopicLabel(`${topic.emoji} ${topic.title}`)
        setCopied(false)
      }
    } finally {
      setIsGenerating(false)
    }
  }

  function handleCopy(url: string) {
    navigator.clipboard.writeText(url).then(() => setCopied(true))
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
            placeholder="Name der Person..."
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
        </div>

        <p className="friends-topic-label">Welche Erinnerungen soll sie oder er teilen?</p>
        <div className="friends-topic-grid">
          {FRIEND_TOPICS.map(topic => (
            <button
              key={topic.id}
              type="button"
              className={`friend-topic-card ${selectedTopicId === topic.id ? 'friend-topic-card--active' : ''}`}
              onClick={() => setSelectedTopicId(topic.id)}
            >
              <span className="friend-topic-card__emoji">{topic.emoji}</span>
              <span className="friend-topic-card__title">{topic.title}</span>
              <span className="friend-topic-card__desc">{topic.description}</span>
            </button>
          ))}
        </div>

        <button
          className="btn btn--primary share-btn"
          onClick={handleAdd}
          disabled={!newName.trim() || isGenerating}
          style={{ marginTop: '1rem' }}
        >
          {isGenerating ? (
            <span className="share-btn__spinner">Einladung wird erstellt…</span>
          ) : (
            'Erinnerung teilen'
          )}
        </button>
      </section>

      {/* Copy fallback – shown when Web Share API is unavailable */}
      {fallbackUrl && (
        <div className="invite-box">
          <p className="invite-box__label">
            Kopiere diesen Link und schicke ihn per WhatsApp, iMessage oder E-Mail:
          </p>
          <div className="invite-box__topic-chip">{fallbackTopicLabel} · 5 Fragen</div>
          <div className="invite-box__url">{fallbackUrl}</div>
          <div className="invite-box__actions">
            <button
              className={`btn btn--primary btn--sm ${copied ? 'btn--success' : ''}`}
              onClick={() => handleCopy(fallbackUrl)}
            >
              {copied ? '✓ Kopiert!' : '📋 Link kopieren'}
            </button>
            <button className="btn btn--ghost btn--sm" onClick={() => setFallbackUrl(null)}>
              Schließen
            </button>
          </div>
        </div>
      )}

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
                onInvite={() => triggerShare(profileName || 'mir', f.id, selectedTopicId)}
                onRemove={() => onRemoveFriend(f.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Manual import fallback – for users who received a code instead of a link */}
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
          placeholder="Antwortcode hier einfügen..."
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

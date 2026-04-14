import { useState } from 'react'
import { FriendCard } from '../components/FriendCard'
import { generateInviteUrl, decodeAnswerExport } from '../utils/sharing'
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
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [inviteTopicLabel, setInviteTopicLabel] = useState('')
  const [copied, setCopied] = useState(false)
  const [importCode, setImportCode] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState(false)

  function handleAdd() {
    if (!newName.trim()) return
    const friend = onAddFriend(newName)
    showInvite(profileName || 'mir', friend.id, selectedTopicId)
    setNewName('')
  }

  function showInvite(name: string, friendId: string, topicId: string) {
    const topic = FRIEND_TOPICS.find(t => t.id === topicId) ?? FRIEND_TOPICS[0]
    setInviteUrl(generateInviteUrl(name, friendId, topicId))
    setInviteTopicLabel(`${topic.emoji} ${topic.title}`)
    setCopied(false)
  }

  async function handleShare(url: string) {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Beantworte Fragen über mich!',
          text: 'Hey! Beantworte bitte ein paar Fragen über mich in der Remember Me App.',
          url,
        })
      } catch {
        // Nutzer hat abgebrochen oder Fehler – ignorieren
      }
    } else {
      navigator.clipboard.writeText(url).then(() => setCopied(true))
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

  return (
    <div className="friends-view">
      <div className="quiz-topbar">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>
          ← Zurück
        </button>
        <h2 className="archive-title">👥 Freunde einladen</h2>
      </div>

      <p className="friends-intro">
        Lade Freunde und Familie ein, Fragen über dich zu beantworten.
        Ihre Antworten erscheinen in deinem Lebensarchiv.
      </p>

      {/* Add friend */}
      <section className="friends-section">
        <h3 className="friends-section-title">Neuen Freund hinzufügen</h3>
        {!profileName && (
          <p className="friends-hint friends-hint--warn">
            Tipp: Gib deinen Namen auf der Startseite ein, damit der Einladungslink personalisiert ist.
          </p>
        )}
        <div className="friends-add-row">
          <input
            className="input-text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Name des Freundes / der Freundin..."
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
        </div>

        {/* Topic selector */}
        <p className="friends-topic-label">Thema der Fragen:</p>
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
          className="btn btn--primary"
          onClick={handleAdd}
          disabled={!newName.trim()}
          style={{ marginTop: '1rem' }}
        >
          Hinzufügen &amp; Einladung erstellen
        </button>
      </section>

      {/* Invite URL */}
      {inviteUrl && (
        <div className="invite-box">
          <p className="invite-box__label">
            Teile den Einladungslink mit deinem Freund – er öffnet die App direkt im Antwortmodus:
          </p>
          <div className="invite-box__topic-chip">{inviteTopicLabel} · 5 Fragen</div>
          <div className="invite-box__actions">
            <button
              className={`btn btn--primary btn--sm ${copied ? 'btn--success' : ''}`}
              onClick={() => handleShare(inviteUrl)}
            >
              {copied ? '✓ Kopiert!' : '🔗 Teilen'}
            </button>
            <button className="btn btn--ghost btn--sm" onClick={() => setInviteUrl(null)}>
              Schließen
            </button>
          </div>
        </div>
      )}

      {/* Friends list */}
      {friends.length > 0 && (
        <section className="friends-section">
          <h3 className="friends-section-title">Eingeladene Freunde ({friends.length})</h3>
          <div className="friends-list">
            {friends.map(f => (
              <FriendCard
                key={f.id}
                friend={f}
                answers={friendAnswers.filter(a => a.friendId === f.id)}
                onInvite={() => showInvite(profileName || 'mir', f.id, selectedTopicId)}
                onRemove={() => onRemoveFriend(f.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Import answers */}
      <section className="friends-section">
        <h3 className="friends-section-title">Antworten importieren</h3>
        <p className="friends-hint">
          Dein Freund hat die Fragen beantwortet und dir einen Code geschickt? Füge ihn hier ein:
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
        {importSuccess && <p className="import-msg import-msg--success">Antworten erfolgreich importiert!</p>}
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

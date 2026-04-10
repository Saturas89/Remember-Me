import { useState } from 'react'
import { FriendCard } from '../components/FriendCard'
import { generateInviteUrl, decodeAnswerExport } from '../utils/sharing'
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
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [importCode, setImportCode] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState(false)

  function handleAdd() {
    if (!newName.trim()) return
    const friend = onAddFriend(newName)
    showInvite(profileName || 'mir', friend.id)
    setNewName('')
  }

  function showInvite(name: string, friendId: string) {
    setInviteUrl(generateInviteUrl(name, friendId))
    setCopied(false)
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
          <button className="btn btn--primary" onClick={handleAdd} disabled={!newName.trim()}>
            Hinzufügen & Link erstellen
          </button>
        </div>
      </section>

      {/* Invite URL */}
      {inviteUrl && (
        <div className="invite-box">
          <p className="invite-box__label">
            Sende diesen Link an deinen Freund – er öffnet die App direkt im Antwortmodus:
          </p>
          <div className="invite-box__url">{inviteUrl}</div>
          <div className="invite-box__actions">
            <button
              className={`btn btn--primary btn--sm ${copied ? 'btn--success' : ''}`}
              onClick={() => handleCopy(inviteUrl)}
            >
              {copied ? '✓ Kopiert!' : '📋 Link kopieren'}
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
                onInvite={() => showInvite(profileName || 'mir', f.id)}
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

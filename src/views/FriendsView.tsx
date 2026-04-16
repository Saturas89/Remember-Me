import { useState, useEffect } from 'react'
import { FriendCard } from '../components/FriendCard'
import { decodeAnswerExport } from '../utils/sharing'
import { parseAnswerFromUrl } from '../utils/secureLink'
import type { Friend, FriendAnswer, AnswerExport } from '../types'

interface Props {
  profileName: string
  inviteUrl: string
  friends: Friend[]
  friendAnswers: FriendAnswer[]
  onRemoveFriend: (id: string) => void
  onImportAnswers: (data: AnswerExport) => void
  onBack: () => void
}

export function FriendsView({
  profileName,
  inviteUrl,
  friends,
  friendAnswers,
  onRemoveFriend,
  onImportAnswers,
  onBack,
}: Props) {
  const [isSharing, setIsSharing] = useState(false)
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>('idle')

  // Import fallback
  const [importCode, setImportCode] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState(false)

  // Auto-clear the "Kopiert!" / "Fehler" status after a moment.
  useEffect(() => {
    if (shareStatus === 'idle') return
    const t = setTimeout(() => setShareStatus('idle'), 2500)
    return () => clearTimeout(t)
  }, [shareStatus])

  function buildShareData(url: string) {
    const name = profileName || 'Ich'
    return {
      title: `${name} möchte deine Erinnerungen`,
      text: `Hallo! ${name} baut gerade ein persönliches Lebensarchiv und würde sich sehr freuen, wenn du ein paar Fragen beantwortest – es dauert nur 5 Minuten. Deine Erinnerungen werden ein unvergesslicher Teil davon. 💛`,
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


  async function handleImport() {
    setImportError(null)
    setImportSuccess(false)
    const raw = importCode.trim()

    // If the pasted text looks like a share link, try URL parsing first
    if (raw.includes('#ma/') || raw.includes('#ma-plain/')) {
      const data = await parseAnswerFromUrl(raw)
      if (data) {
        onImportAnswers(data)
        setImportSuccess(true)
        setImportCode('')
        return
      }
    }

    // Fallback: treat as plain Base64 code
    const data = decodeAnswerExport(raw)
    if (!data) {
      setImportError('Ungültiger Code oder Link. Bitte kopiere ihn vollständig.')
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
          und schickt dir die Antworten zurück. Sie werden Teil deines persönlichen Lebensarchivs.
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

      {/* Manual import fallback */}
      <section className="friends-section">
        <h3 className="friends-section-title">Antwort-Link oder Code eingeben</h3>
        <p className="friends-hint">
          Hat jemand dir einen Antwort-Link oder Code geschickt? Füge ihn hier ein:
        </p>
        <textarea
          className="input-textarea"
          value={importCode}
          onChange={e => {
            setImportCode(e.target.value)
            setImportError(null)
            setImportSuccess(false)
          }}
          placeholder="Antwort-Link oder Code hier einfügen…"
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

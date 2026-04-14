import { useState, useEffect } from 'react'
import { FriendCard } from '../components/FriendCard'
import {
  generatePlainInviteUrl,
  generateSecureInviteUrl,
} from '../utils/secureLink'
import { decodeAnswerExport } from '../utils/sharing'
import type { Friend, FriendAnswer, AnswerExport } from '../types'

interface Props {
  profileName: string
  friends: Friend[]
  friendAnswers: FriendAnswer[]
  onRemoveFriend: (id: string) => void
  onImportAnswers: (data: AnswerExport) => void
  onBack: () => void
}

const INVITE_URL_STORAGE_KEY = 'remember-me-invite-url'

interface StoredInvite {
  profileName: string
  url: string
}

function loadStoredInvite(): StoredInvite | null {
  try {
    const raw = localStorage.getItem(INVITE_URL_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredInvite>
    if (typeof parsed.profileName === 'string' && typeof parsed.url === 'string') {
      return { profileName: parsed.profileName, url: parsed.url }
    }
  } catch {
    // ignore corrupt data
  }
  return null
}

function storeInvite(data: StoredInvite): void {
  try {
    localStorage.setItem(INVITE_URL_STORAGE_KEY, JSON.stringify(data))
  } catch {
    // ignore quota errors – the link will simply regenerate next time
  }
}

export function FriendsView({
  profileName,
  friends,
  friendAnswers,
  onRemoveFriend,
  onImportAnswers,
  onBack,
}: Props) {
  const effectiveName = profileName || 'mir'

  // Permanent, reusable invite link – one for all friends.
  //
  // Initialized synchronously on first render so the Share- and Copy-buttons
  // are clickable immediately. Order of preference:
  //   1. Cached URL from localStorage matching the current profile name.
  //   2. Plain-base64 URL computed synchronously – guaranteed to work in any
  //      browser, any context.
  // The secure (AES-GCM + deflate) URL, if the browser supports it, is
  // upgraded asynchronously in the background and replaces the plain one.
  const [inviteUrl, setInviteUrl] = useState<string>(() => {
    const stored = loadStoredInvite()
    if (stored && stored.profileName === effectiveName) return stored.url
    return generatePlainInviteUrl({ profileName: effectiveName })
  })

  const [isSharing, setIsSharing] = useState(false)
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>('idle')

  // Import fallback
  const [importCode, setImportCode] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState(false)

  // Upgrade to the secure (encrypted + compressed) URL in the background and
  // cache it so subsequent visits are instant. If encryption isn't available
  // in this browser, `generateSecureInviteUrl` itself returns the plain URL –
  // still worth caching so both paths end up persisted.
  useEffect(() => {
    const stored = loadStoredInvite()
    if (stored && stored.profileName === effectiveName) {
      // Already cached – make sure state reflects it (e.g. when name changed).
      setInviteUrl(stored.url)
      return
    }

    let cancelled = false
    generateSecureInviteUrl({ profileName: effectiveName })
      .then(url => {
        if (cancelled) return
        setInviteUrl(url)
        storeInvite({ profileName: effectiveName, url })
      })
      .catch(err => {
        // Plain fallback is already displayed – log and move on.
        console.error('[FriendsView] generateSecureInviteUrl failed:', err)
      })
    return () => {
      cancelled = true
    }
  }, [effectiveName])

  // Auto-clear the "Kopiert!" / "Fehler" status after a moment.
  useEffect(() => {
    if (shareStatus === 'idle') return
    const t = setTimeout(() => setShareStatus('idle'), 2500)
    return () => clearTimeout(t)
  }, [shareStatus])

  function buildShareData(url: string) {
    return {
      title: 'Erinnerung einsammeln',
      text: `${profileName || 'Jemand'} möchte deine Erinnerungen festhalten – teile deine Geschichte.`,
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

      {/* Permanent share link */}
      <section className="friends-section">
        <h3 className="friends-section-title">Dein Einladungslink</h3>
        {!profileName && (
          <p className="friends-hint friends-hint--warn">
            Tipp: Gib deinen Namen auf der Startseite ein, damit die Einladung personalisiert ist.
          </p>
        )}
        <p className="friends-hint">
          Ein Link für alle. Teile ihn beliebig oft – jede Person gibt selbst ihren
          Namen ein und wählt eine Kategorie. Die Antworten schickt sie dir per
          Share-Button zurück.
        </p>

        <div className="invite-box">
          <p className="invite-box__label">Dein persönlicher Einladungslink</p>
          <div className="invite-box__url">{inviteUrl}</div>
          <div className="invite-box__actions">
            <button
              className={`btn share-btn ${shareStatus === 'copied' ? 'btn--success share-btn--copied' : 'btn--primary'}`}
              onClick={handleShare}
              disabled={isSharing}
            >
              {isSharing ? (
                <span className="share-btn__spinner">Wird geöffnet…</span>
              ) : shareStatus === 'copied' ? (
                '✓ Link kopiert!'
              ) : shareStatus === 'error' ? (
                '⚠ Nochmal versuchen'
              ) : (
                '📤 Link teilen'
              )}
            </button>
          </div>
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

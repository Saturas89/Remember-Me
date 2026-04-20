import { useState, useEffect, useRef } from 'react'
import { FriendCard } from '../components/FriendCard'
import { useTranslation } from '../locales'
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
  const { t } = useTranslation()
  const [isSharing, setIsSharing] = useState(false)
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const zipInputRef = useRef<HTMLInputElement>(null)
  const logoBlobRef = useRef<Blob | null>(null)

  useEffect(() => {
    fetch('/pwa-192x192.png')
      .then(r => r.blob())
      .then(b => { logoBlobRef.current = b })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (shareStatus === 'idle') return
    const timer = setTimeout(() => setShareStatus('idle'), 2500)
    return () => clearTimeout(timer)
  }, [shareStatus])

  function buildText(url: string) {
    return t.friends.shareMessage.replace('{url}', url)
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
      <h1 className="sr-only">{t.friends.pageTitle}</h1>
      <div className="quiz-topbar">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>
          {t.global.back}
        </button>
        <h2 className="archive-title">{t.friends.topbarTitle}</h2>
      </div>

      <section className="friends-section">
        <h3 className="friends-section-title">{t.friends.inviteLinkHeading}</h3>
        {!profileName && (
          <p className="friends-hint friends-hint--warn">{t.friends.inviteHintNoName}</p>
        )}
        <p className="friends-hint">{t.friends.inviteHint}</p>

        <div className="friends-share">
          <button
            className={`share-cta-btn${shareStatus === 'copied' ? ' share-cta-btn--success' : shareStatus === 'error' ? ' share-cta-btn--error' : ''}`}
            onClick={handleShare}
            disabled={isSharing}
          >
            {isSharing ? (
              <><span className="share-cta-btn__spinner" aria-hidden="true" />{t.friends.opening}</>
            ) : shareStatus === 'copied' ? (
              t.friends.messageCopied
            ) : shareStatus === 'error' ? (
              t.friends.copyRetry
            ) : (
              t.friends.shareCta
            )}
          </button>
        </div>
      </section>

      {friends.length > 0 && (
        <section className="friends-section">
          <h3 className="friends-section-title">
            {t.friends.friendsFromHeading.replace('{n}', String(friends.length))}
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

      <section className="friends-section">
        <h3 className="friends-section-title">{t.friends.attachmentsHeading}</h3>
        <p className="friends-hint">{t.friends.attachmentsHint}</p>
        <button
          className="btn btn--ghost btn--sm"
          onClick={() => zipInputRef.current?.click()}
        >
          {t.friends.openGift}
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

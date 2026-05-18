import { useRef } from 'react'
import { FriendCard } from '../components/FriendCard'
import { useTranslation } from '../locales'
import { useSandraFlowStrings } from '../i18n/sandraFlow'
import type { Friend, FriendAnswer } from '../types'

interface Props {
  friends: Friend[]
  friendAnswers: FriendAnswer[]
  onRemoveFriend: (id: string) => void
  onImportZip: (file: File) => void
  onBack: () => void
  /** Open the online-sharing hub (or intro if not yet opted in). */
  onOpenOnlineSharing?: () => void
  /** True when the user has already opted in to online sharing. */
  onlineSharingEnabled?: boolean
  /** True when the build has Supabase configured. */
  onlineSharingConfigured?: boolean
  /** Navigate to the Sandra-first invite flow (`#/ask`). */
  onOpenSandraFlow?: () => void
}

export function FriendsView({
  friends,
  friendAnswers,
  onRemoveFriend,
  onImportZip,
  onBack,
  onOpenOnlineSharing,
  onlineSharingEnabled,
  onlineSharingConfigured,
  onOpenSandraFlow,
}: Props) {
  const { t } = useTranslation()
  const sandraT = useSandraFlowStrings()
  const zipInputRef = useRef<HTMLInputElement>(null)

  const onlineFriends = friends.filter(f => f.online)

  return (
    <div className="friends-view">
      <h1 className="sr-only">{t.friends.pageTitle}</h1>
      <div className="quiz-topbar">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>
          {t.global.back}
        </button>
        <h2 className="archive-title">{t.friends.topbarTitle}</h2>
      </div>

      <p className="friends-intro">{t.friends.intro}</p>

      {/* Primary: Sandra-flow invite entry */}
      <section className="friends-section">
        <h3 className="friends-section-title">{sandraT.entryCard.title}</h3>
        <p className="friends-hint">{sandraT.entryCard.desc}</p>
        {onOpenSandraFlow && (
          <button
            type="button"
            className="share-cta-btn"
            onClick={onOpenSandraFlow}
            data-testid="sandra-entry-cta"
          >
            {sandraT.entryCard.cta}
          </button>
        )}
      </section>

      {/* Connected memories hub — shown once Supabase is configured */}
      {onlineSharingConfigured && onOpenOnlineSharing && (
        <section className="friends-section">
          <h3 className="friends-section-title">{t.friends.connectedHeading}</h3>
          {onlineSharingEnabled && onlineFriends.length > 0 ? (
            <div className="friends-list">
              {onlineFriends.map(f => (
                <FriendCard
                  key={f.id}
                  friend={f}
                  answers={friendAnswers.filter(a => a.friendId === f.id)}
                  onRemove={() => onRemoveFriend(f.id)}
                />
              ))}
            </div>
          ) : (
            <p className="friends-hint">{t.friends.connectedEmptyHint}</p>
          )}
          <button
            className="share-cta-btn"
            onClick={onOpenOnlineSharing}
            data-testid="open-online-sharing"
          >
            {t.friends.connectedCta}
          </button>
        </section>
      )}

      {/* Legacy one-time friend answers (existing data) */}
      {friends.filter(f => !f.online).length > 0 && (
        <section className="friends-section">
          <h3 className="friends-section-title">
            {t.friends.friendsFromHeading.replace('{n}', String(friends.filter(f => !f.online).length))}
          </h3>
          <div className="friends-list">
            {friends.filter(f => !f.online).map(f => (
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

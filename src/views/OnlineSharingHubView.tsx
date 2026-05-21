import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from '../locales'
import type { Translations } from '../locales/types'
import type {
  Friend,
  SharedMemory,
  Annotation,
  AnnotationBody,
} from '../types'
import type { OnlineSyncAPI } from '../hooks/useOnlineSync'
import type { Recipient } from '../utils/shareEncryption'

/** Map a raw sync error.message string to a friendly, persona-safe text from
 *  the locale block. Tackles #168 — the Sandra-family-manager persona
 *  reported that the unfiltered `{h.syncErrorPrefix}{sync.error}` rendered
 *  stack-trace-ish messages directly to Mama. */
function friendlySyncError(
  raw: string,
  h: Translations['onlineSharingHub'],
): string {
  const r = raw.toLowerCase()
  if (/network|offline|failed to fetch|connection|ecconn/i.test(r)) return h.syncErrorOffline
  if (/auth|unauthor|401|403|jwt|token/i.test(r))                  return h.syncErrorAuth
  if (/quota|storage|413|too large|payload/i.test(r))              return h.syncErrorQuota
  if (/conflict|409|version|stale/i.test(r))                       return h.syncErrorConflict
  return h.syncErrorGeneric
}

interface Props {
  profileName: string
  friends: Friend[]
  sync: OnlineSyncAPI
  onBack: () => void
  onDeactivate: () => void
  onRemoveContact: (friendId: string) => void
  /** Open the Sandra-flow as the canonical entry for new connections
   *  (REQ-022 FR-22.17 / FR-22.23). */
  onOpenSandraFlow: () => void
  }

type Tab = 'feed' | 'contacts' | 'settings'

/**
 * The post-opt-in control surface for online sharing.
 *
 * Flow (REQ-022):
 *  • 0 contacts → OnboardingScreen with a single Sandra-flow CTA
 *  • ≥1 contacts → Three-tab hub: Feed · Kontakte · Einstellungen
 *
 * The legacy "Teilen" tab (manual memory picker) is gone – per-friend
 * auto-share runs from useAutoShare in App.tsx instead.
 */
export function OnlineSharingHubView({
  profileName,
  friends,
  sync,
  onBack,
  onDeactivate,
  onRemoveContact,
  onOpenSandraFlow,
}: Props) {
  const { t } = useTranslation()
  const h = t.onlineSharingHub
  const [tab, setTab] = useState<Tab>('feed')
  const onlineFriends = useMemo(() => friends.filter(f => f.online), [friends])
  const hasContacts = onlineFriends.length > 0
  const anySharing = useMemo(
    () => onlineFriends.some(f => f.online?.shareAll === true),
    [onlineFriends],
  )

  return (
    <div className="friends-view">
      <div className="quiz-topbar">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>{h.back}</button>
        <h2 className="archive-title">{h.title}</h2>
      </div>

      {sync.error && (
        <section className="friends-section">
          <p className="friends-hint friends-hint--warn">
            {friendlySyncError(sync.error, h)}
          </p>
          <button
            className="btn btn--ghost btn--sm"
            onClick={sync.retryBootstrap}
          >
            {h.syncErrorRetry}
          </button>
          {/* The raw error.message is kept as a collapsed <details> so
              technically inclined users (or bug reporters) can still grab it
              without scaring the Senior persona on first sight. */}
          <details className="sync-error-details">
            <summary className="friends-hint">{h.syncErrorDetailsToggle}</summary>
            <p className="friends-hint sync-error-details__raw">
              {h.syncErrorPrefix}{sync.error}
            </p>
          </details>
        </section>
      )}

      {!sync.ready && !sync.error && (
        <section className="friends-section">
          <p className="friends-hint">{h.connecting}</p>
        </section>
      )}

      {sync.ready && !hasContacts && (
        <OnboardingScreen
          onDeactivate={onDeactivate}
          onOpenSandraFlow={onOpenSandraFlow}
        />
      )}

      {sync.ready && hasContacts && (
        <>
          <nav className="online-tabs" role="tablist">
            <TabButton active={tab === 'feed'} onClick={() => setTab('feed')}>
              {h.tabs.feed} {sync.memories.length > 0 && (
                <span className="online-tab-badge">{sync.memories.length}</span>
              )}
            </TabButton>
            <TabButton active={tab === 'contacts'} onClick={() => setTab('contacts')}>
              {h.tabs.contacts}
            </TabButton>
            <TabButton active={tab === 'settings'} onClick={() => setTab('settings')}>
              {h.tabs.settings}
            </TabButton>
          </nav>

          {tab === 'feed' && (
            <FeedTab
              memories={sync.memories}
              annotations={sync.annotations}
              profileName={profileName}
              sync={sync}
              onlineFriends={onlineFriends}
              anySharing={anySharing}
              onGoToContacts={() => setTab('contacts')}
            />
          )}
          {tab === 'contacts' && (
            <ContactsTab
              onlineFriends={onlineFriends}
              onRemoveContact={onRemoveContact}
              onOpenSandraFlow={onOpenSandraFlow}
            />
          )}
          {tab === 'settings' && (
            <SettingsTab onDeactivate={onDeactivate} />
          )}
        </>
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      className={`online-tab${active ? ' online-tab--active' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

// ── Onboarding (0 contacts) ──────────────────────────────────────────────────

function OnboardingScreen({
  onDeactivate,
  onOpenSandraFlow,
}: {
  onDeactivate: () => void
  onOpenSandraFlow: () => void
}) {
  const { t } = useTranslation()
  const o = t.onlineSharingHub.onboarding
  const [showSettings, setShowSettings] = useState(false)

  return (
    <section className="friends-section online-onboarding">
      <div className="online-onboarding__icon">🔗</div>

      <h3 className="friends-section-title">{o.heading}</h3>

      <p className="friends-hint">{o.hint}</p>

      <button
        className="share-cta-btn"
        onClick={onOpenSandraFlow}
        data-testid="onboarding-open-sandra"
      >
        {o.sandraFlowCta}
      </button>

      <ul className="online-onboarding__steps">
        <li>{o.step1}</li>
        <li>{o.step2}</li>
        <li>{o.step3}</li>
      </ul>

      <button
        className="btn btn--ghost btn--sm online-onboarding__settings-btn"
        onClick={() => setShowSettings(s => !s)}
      >
        {showSettings ? o.settingsClose : o.settingsOpen}
      </button>

      {showSettings && <SettingsTab onDeactivate={onDeactivate} />}
    </section>
  )
}

// ── Feed ────────────────────────────────────────────────────────────────────

function FeedTab({
  memories,
  annotations,
  profileName,
  sync,
  onlineFriends,
  anySharing,
  onGoToContacts,
}: {
  memories: SharedMemory[]
  annotations: Annotation[]
  profileName: string
  sync: OnlineSyncAPI
  onlineFriends: Friend[]
  anySharing: boolean
  onGoToContacts: () => void
}) {
  const { t } = useTranslation()
  const e = t.onlineSharingHub.feedEmpty

  if (memories.length === 0) {
    return (
      <section className="friends-section">
        <p className="friends-hint" data-testid="feed-empty-hint">
          {anySharing ? e.hint : e.allPausedHint}
        </p>
        <div className="online-empty-actions">
          <button className="btn btn--ghost btn--sm" onClick={onGoToContacts}>
            {e.inviteCta}
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="friends-section">
      {memories.map(m => {
        const mine = annotations.filter(a => a.shareId === m.shareId)
        return (
          <SharedMemoryCard
            key={m.shareId}
            memory={m}
            annotations={mine}
            profileName={profileName}
            sync={sync}
            onlineFriends={onlineFriends}
          />
        )
      })}
    </section>
  )
}

function SharedMemoryCard({
  memory,
  annotations,
  profileName,
  sync,
  onlineFriends,
}: {
  memory: SharedMemory
  annotations: Annotation[]
  profileName: string
  sync: OnlineSyncAPI
  onlineFriends: Friend[]
}) {
  const { t, locale } = useTranslation()
  const a = t.onlineSharingHub.annotation
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const audience = useMemo<Recipient[]>(() => {
    const seen = new Set<string>()
    const out: Recipient[] = []
    for (const f of onlineFriends) {
      if (!f.online) continue
      if (seen.has(f.online.deviceId)) continue
      out.push({ deviceId: f.online.deviceId, publicKey: f.online.publicKey })
      seen.add(f.online.deviceId)
    }
    return out
  }, [onlineFriends])

  const submit = async () => {
    const text = draft.trim()
    if (!text || !sync.service || !sync.deviceId) return
    setStatus('sending')
    try {
      const body: AnnotationBody = {
        $type: 'remember-me-annotation',
        version: 1,
        text,
        imageCount: 0,
        authorName: profileName,
        createdAt: new Date().toISOString(),
      }
      await sync.service.addAnnotation({
        shareId: memory.shareId,
        body,
        audience,
      })
      setDraft('')
      setStatus('sent')
      await sync.refresh()
      setTimeout(() => setStatus('idle'), 2000)
    } catch (err) {
      console.error(err)
      setStatus('error')
    }
  }

  return (
    <article className="shared-memory-card" data-testid="feed-item">
      <header>
        <strong>{memory.ownerName}</strong>
        <span className="shared-memory-date">
          {new Date(memory.createdAt).toLocaleDateString(locale === 'en' ? 'en-GB' : 'de-DE')}
        </span>
        {annotations.length > 0 && (
          <span data-testid="annotation-count" className="shared-memory-annotation-count">
            {annotations.length}
          </span>
        )}
      </header>
      <p className="shared-memory-question">{memory.questionText}</p>
      <p className="shared-memory-value">{memory.value}</p>

      {annotations.length > 0 && (
        <ul className="shared-memory-annotations">
          {annotations.map(ann => (
            <li key={ann.annotationId}>
              <strong>{ann.authorName}</strong>: {ann.text}
            </li>
          ))}
        </ul>
      )}

      <div className="shared-memory-compose">
        <label>
          {a.label}
          <textarea
            data-testid="annotation-input"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={3}
            placeholder={a.placeholder}
          />
        </label>
        <button
          data-testid={status === 'sent' ? 'annotation-sent' : 'send-annotation'}
          className="btn btn--ghost btn--sm"
          onClick={submit}
          disabled={status === 'sending' || !draft.trim()}
        >
          {status === 'sending' ? a.sending
            : status === 'sent' ? a.sent
            : status === 'error' ? a.error
            : a.sendButton}
        </button>
      </div>
    </article>
  )
}

// ── Contacts ────────────────────────────────────────────────────────────────

const SWIPE_THRESHOLD = 80

function contactAvatarColor(name: string): string {
  const hue = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  return `hsl(${hue}, 55%, 38%)`
}

function ContactItem({
  friend,
  onRemove,
}: {
  friend: Friend
  onRemove: (id: string) => void
}) {
  const [offset, setOffset] = useState(0)
  const [flyOut, setFlyOut] = useState(false)
  const [dragging, setDragging] = useState(false)
  const startXRef = useRef<number | null>(null)

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (flyOut) return
    startXRef.current = e.clientX
    setDragging(true)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (startXRef.current === null) return
    const dx = e.clientX - startXRef.current
    if (dx < 0) {
      setOffset(Math.max(dx, -600))
    }
  }

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (startXRef.current === null) return
    const dx = e.clientX - startXRef.current
    startXRef.current = null
    setDragging(false)
    if (dx < -SWIPE_THRESHOLD) {
      setFlyOut(true)
      setOffset(-600)
      setTimeout(() => onRemove(friend.id), 260)
    } else {
      setOffset(0)
    }
  }

  const handlePointerLeave = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (startXRef.current !== null) {
      handlePointerUp(e)
    }
  }

  return (
    <li className="online-contact-item" data-testid={`contact-item-${friend.id}`}>
      <div className="online-contact-delete-bg" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14H6L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M9 6V4h6v2" />
        </svg>
      </div>
      <div
        className={`online-contact-swipe${dragging ? ' online-contact-swipe--dragging' : ''}${flyOut ? ' online-contact-swipe--fly-out' : ''}`}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        data-testid={`contact-swipe-${friend.id}`}
      >
        <div className="online-contact-avatar" style={{ background: contactAvatarColor(friend.name) }} aria-hidden="true">
          {friend.name.charAt(0).toUpperCase()}
        </div>
        <span className="online-contact-name" data-testid={`contact-name-${friend.id}`}>
          {friend.name}
        </span>
        <div className="online-contact-swipe-hint" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
        </div>
      </div>
    </li>
  )
}

function ContactsTab({
  onlineFriends,
  onRemoveContact,
  onOpenSandraFlow,
}: {
  onlineFriends: Friend[]
  onRemoveContact: (friendId: string) => void
  onOpenSandraFlow: () => void
}) {
  const { t } = useTranslation()
  const c = t.onlineSharingHub.contacts

  return (
    <section className="friends-section">
      <h3 className="friends-section-title">{c.contactsHeading}</h3>
      {onlineFriends.length === 0 ? (
        <p className="friends-hint" data-testid="no-contacts-hint">{c.noContactsHint}</p>
      ) : (
        <ul className="online-contact-list" data-testid="contacts-list">
          {onlineFriends.map(f => (
            <ContactItem
              key={f.id}
              friend={f}
              onRemove={onRemoveContact}
            />
          ))}
        </ul>
      )}

      <button
        className="share-cta-btn"
        style={{ marginTop: '1rem' }}
        onClick={onOpenSandraFlow}
        data-testid="contacts-new-connection"
      >
        {c.newConnectionCta}
      </button>
    </section>
  )
}

// ── Settings / Deactivate ───────────────────────────────────────────────────

function SettingsTab({ onDeactivate }: { onDeactivate: () => void }) {
  const { t } = useTranslation()
  const s = t.onlineSharingHub.settings
  const [confirming, setConfirming] = useState(false)

  return (
    <section className="friends-section">
      <h3 className="friends-section-title">{s.heading}</h3>
      <p className="friends-hint">{s.hint}</p>
      {!confirming ? (
        <button
          data-testid="deactivate-sharing"
          className="btn btn--ghost btn--sm"
          onClick={() => setConfirming(true)}
        >
          {s.deactivateButton}
        </button>
      ) : (
        <div className="online-confirm">
          <p><strong>{s.confirmStrong}</strong>{s.confirmRest}</p>
          <button
            data-testid="confirm-deactivate"
            className="share-cta-btn share-cta-btn--error"
            onClick={onDeactivate}
          >
            {s.confirmYes}
          </button>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => setConfirming(false)}
          >
            {s.confirmNo}
          </button>
        </div>
      )}
    </section>
  )
}

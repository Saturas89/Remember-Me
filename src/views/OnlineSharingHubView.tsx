import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { generateContactUrl, shareOrCopy } from '../utils/secureLink'
import { generateShareCard } from '../utils/shareCard'
import { CATEGORIES } from '../data/categories'
import { useTranslation } from '../locales'
import type { Translations } from '../locales/types'
import type {
  Friend,
  Answer,
  SharedMemory,
  Annotation,
  ContactHandshake,
  ShareBody,
  AnnotationBody,
} from '../types'
import type { OnlineSyncAPI } from '../hooks/useOnlineSync'
import type { Recipient } from '../utils/shareEncryption'

function resolveQuestionText(questionId: string): string {
  for (const cat of CATEGORIES) {
    const q = cat.questions.find(q => q.id === questionId)
    if (q) return q.text
  }
  return questionId
}

interface Props {
  profileName: string
  friends: Friend[]
  answers: Record<string, Answer>
  sync: OnlineSyncAPI
  onBack: () => void
  onDeactivate: () => void
  onRemoveContact: (friendId: string) => void
}

type Tab = 'feed' | 'share' | 'contacts' | 'settings'

// ── Shared hook: contact link share logic ────────────────────────────────────
// Used by both OnboardingScreen and ContactsTab to avoid duplication.

function useContactShare(profileName: string, sync: OnlineSyncAPI, c: Translations['contactHandshake']) {
  const shareCardRef = useRef<File | null>(null)
  const [copied, setCopied] = useState(false)

  const handshake: ContactHandshake | null = useMemo(() => {
    if (!sync.deviceId || !sync.publicKeyB64) return null
    return {
      $type: 'remember-me-contact',
      version: 1,
      deviceId: sync.deviceId,
      publicKey: sync.publicKeyB64,
      displayName: profileName,
    }
  }, [sync.deviceId, sync.publicKeyB64, profileName])

  const url = handshake ? generateContactUrl(handshake) : ''

  useEffect(() => {
    if (!profileName) return
    fetch('/pwa-192x192.png')
      .then(r => r.blob())
      .then(b => generateShareCard(b, {
        title: c.shareCardTitleWithName.replace('{name}', profileName),
        subtitle: c.shareCardSubtitle,
      }))
      .then(f => { shareCardRef.current = f })
      .catch(() => {})
  }, [profileName, c.shareCardTitleWithName, c.shareCardSubtitle])

  const share = useCallback(async () => {
    if (!url) return
    const inviteText = c.shareInviteText.replace('{name}', profileName)
    const card = shareCardRef.current
    if (card && typeof navigator.share === 'function' && navigator.canShare?.({ files: [card] })) {
      const text = `${inviteText}\n\n${url}`
      try {
        await navigator.share({ files: [card], title: c.shareSheetTitle, text })
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
      }
    }
    const sent = await shareOrCopy({
      title: c.shareSheetTitle,
      text: inviteText,
      url,
    })
    if (!sent) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [url, profileName, c.shareInviteText, c.shareSheetTitle])

  return { url, share, copied }
}

/**
 * The post-opt-in control surface for online sharing.
 *
 * Flow:
 *  • 0 contacts → OnboardingScreen (single focused invite CTA)
 *  • ≥1 contacts → Four-tab hub: Feed · Teilen · Einladen · Einstellungen
 */
export function OnlineSharingHubView({
  profileName,
  friends,
  answers,
  sync,
  onBack,
  onDeactivate,
  onRemoveContact,
}: Props) {
  const { t } = useTranslation()
  const h = t.onlineSharingHub
  const [tab, setTab] = useState<Tab>('feed')
  const onlineFriends = useMemo(() => friends.filter(f => f.online), [friends])
  const hasContacts = onlineFriends.length > 0

  return (
    <div className="friends-view">
      <div className="quiz-topbar">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>{h.back}</button>
        <h2 className="archive-title">{h.title}</h2>
      </div>

      {sync.error && (
        <section className="friends-section">
          <p className="friends-hint friends-hint--warn">
            {h.syncErrorPrefix}{sync.error}
          </p>
        </section>
      )}

      {!sync.ready && !sync.error && (
        <section className="friends-section">
          <p className="friends-hint">{h.connecting}</p>
        </section>
      )}

      {sync.ready && !hasContacts && (
        <OnboardingScreen
          profileName={profileName}
          sync={sync}
          onDeactivate={onDeactivate}
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
            <TabButton active={tab === 'share'} onClick={() => setTab('share')}>
              {h.tabs.share}
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
              onGoToShare={() => setTab('share')}
              onGoToInvite={() => setTab('contacts')}
            />
          )}
          {tab === 'share' && (
            <ShareTab
              answers={answers}
              onlineFriends={onlineFriends}
              profileName={profileName}
              sync={sync}
            />
          )}
          {tab === 'contacts' && (
            <ContactsTab
              profileName={profileName}
              sync={sync}
              onlineFriends={onlineFriends}
              onRemoveContact={onRemoveContact}
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
  profileName,
  sync,
  onDeactivate,
}: {
  profileName: string
  sync: OnlineSyncAPI
  onDeactivate: () => void
}) {
  const { t } = useTranslation()
  const o = t.onlineSharingHub.onboarding
  const { url, share, copied } = useContactShare(profileName, sync, t.contactHandshake)
  const [showSettings, setShowSettings] = useState(false)

  return (
    <section className="friends-section online-onboarding">
      <div className="online-onboarding__icon">🔗</div>

      <h3 className="friends-section-title">{o.heading}</h3>

      <p className="friends-hint">{o.hint}</p>

      <button className="share-cta-btn" onClick={share} disabled={!url}>
        {copied ? o.copied : o.shareCta}
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
  onGoToShare,
  onGoToInvite,
}: {
  memories: SharedMemory[]
  annotations: Annotation[]
  profileName: string
  sync: OnlineSyncAPI
  onlineFriends: Friend[]
  onGoToShare: () => void
  onGoToInvite: () => void
}) {
  const { t } = useTranslation()
  const e = t.onlineSharingHub.feedEmpty

  if (memories.length === 0) {
    return (
      <section className="friends-section">
        <p className="friends-hint">{e.hint}</p>
        <div className="online-empty-actions">
          <button className="share-cta-btn" onClick={onGoToShare}>
            {e.shareCta}
          </button>
          <button className="btn btn--ghost btn--sm" onClick={onGoToInvite}>
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
    <article className="shared-memory-card">
      <header>
        <strong>{memory.ownerName}</strong>
        <span className="shared-memory-date">
          {new Date(memory.createdAt).toLocaleDateString(locale === 'en' ? 'en-GB' : 'de-DE')}
        </span>
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
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={3}
            placeholder={a.placeholder}
          />
        </label>
        <button
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

// ── Share ────────────────────────────────────────────────────────────────────

function ShareTab({
  answers,
  onlineFriends,
  profileName,
  sync,
}: {
  answers: Record<string, Answer>
  onlineFriends: Friend[]
  profileName: string
  sync: OnlineSyncAPI
}) {
  const { t } = useTranslation()
  const s = t.onlineSharingHub.share
  const options = Object.values(answers).filter(a => a.value.trim().length > 0)
  const [selectedQ, setSelectedQ] = useState<string>('')
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set())
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string>('')

  const toggle = (friendId: string) => {
    const next = new Set(selectedFriends)
    if (next.has(friendId)) next.delete(friendId)
    else next.add(friendId)
    setSelectedFriends(next)
  }

  const send = useCallback(async () => {
    if (!selectedQ || selectedFriends.size === 0 || !sync.service) return
    const ans = answers[selectedQ]
    if (!ans) return
    setStatus('sending')
    setErrorMsg('')
    try {
      const recipients: Recipient[] = onlineFriends
        .filter(f => selectedFriends.has(f.id) && f.online)
        .map(f => ({ deviceId: f.online!.deviceId, publicKey: f.online!.publicKey }))

      const body: ShareBody = {
        $type: 'remember-me-share',
        version: 1,
        questionId: ans.questionId,
        questionText: resolveQuestionText(ans.questionId),
        value: ans.value,
        imageCount: 0,
        createdAt: ans.createdAt,
        ownerName: profileName,
      }

      const TIMEOUT_MS = 30_000
      await Promise.race([
        sync.service.shareMemory({ body, recipients, images: [] }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(s.timeoutMessage)),
            TIMEOUT_MS,
          )
        ),
      ])
      setStatus('sent')
      setTimeout(() => setStatus('idle'), 2000)
      setSelectedFriends(new Set())
    } catch (err) {
      console.error(err)
      setErrorMsg((err as Error).message ?? s.unknownError)
      setStatus('error')
    }
  }, [selectedQ, selectedFriends, sync.service, answers, onlineFriends, profileName, s.timeoutMessage, s.unknownError])

  if (options.length === 0) {
    return (
      <section className="friends-section">
        <p className="friends-hint">{s.needsAnswerHint}</p>
      </section>
    )
  }

  return (
    <section className="friends-section">
      <span className="share-tab__label">{s.whichMemoryLabel}</span>
      <div className="share-memory-list" role="radiogroup" aria-label={s.memoryListAriaLabel}>
        {options.map(a => (
          <label
            key={a.id}
            className={`share-memory-option${selectedQ === a.id ? ' share-memory-option--selected' : ''}`}
          >
            <input
              type="radio"
              name="share-memory"
              value={a.id}
              checked={selectedQ === a.id}
              onChange={() => setSelectedQ(a.id)}
              className="sr-only"
            />
            <span className="share-memory-option__indicator" aria-hidden="true" />
            <span className="share-memory-option__content">
              <span className="share-memory-option__question">{resolveQuestionText(a.questionId)}</span>
              <span className="share-memory-option__value">{a.value}</span>
            </span>
          </label>
        ))}
      </div>

      <span className="share-tab__label">{s.whichRecipientLabel}</span>
      <div className="share-recipient-list" role="group" aria-label={s.recipientListAriaLabel}>
        {onlineFriends.map(f => (
          <label
            key={f.id}
            className={`share-recipient-chip${selectedFriends.has(f.id) ? ' share-recipient-chip--selected' : ''}`}
          >
            <input
              type="checkbox"
              checked={selectedFriends.has(f.id)}
              onChange={() => toggle(f.id)}
              className="sr-only"
            />
            <span className="share-recipient-avatar" aria-hidden="true">
              {f.name.charAt(0).toUpperCase()}
            </span>
            <span className="share-recipient-name">{f.name}</span>
          </label>
        ))}
      </div>

      <div className="share-tab__actions">
        <button
          className={`share-cta-btn${status === 'sent' ? ' share-cta-btn--success' : ''}`}
          disabled={!selectedQ || selectedFriends.size === 0 || status === 'sending' || !sync.service}
          onClick={send}
        >
          {status === 'sending' ? s.sendingButton
            : status === 'sent' ? s.sentButton
            : s.sendButton}
        </button>
        {status === 'error' && errorMsg && (
          <p className="share-tab__error" role="alert">{errorMsg}</p>
        )}
      </div>
    </section>
  )
}

// ── Contacts / Einladen ──────────────────────────────────────────────────────

const SWIPE_THRESHOLD = 60
const REVEAL_WIDTH = 80

function ContactItem({
  friend,
  removeLabel,
  removeAriaLabel,
  onRemove,
}: {
  friend: Friend
  removeLabel: string
  removeAriaLabel: string
  onRemove: (id: string) => void
}) {
  const [offset, setOffset] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [dragging, setDragging] = useState(false)
  const startXRef = useRef<number | null>(null)

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    startXRef.current = e.clientX
    setDragging(true)
    // setPointerCapture keeps move/up events on this element even when the
    // pointer drifts outside. Not available in jsdom, so guard gracefully.
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (startXRef.current === null) return
    const dx = e.clientX - startXRef.current
    if (dx < 0) {
      setOffset(Math.max(dx, -(REVEAL_WIDTH + 20)))
    }
  }

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (startXRef.current === null) return
    const dx = e.clientX - startXRef.current
    setDragging(false)
    if (dx < -SWIPE_THRESHOLD) {
      setRevealed(true)
      setOffset(-REVEAL_WIDTH)
    } else {
      setRevealed(false)
      setOffset(0)
    }
    startXRef.current = null
  }

  const handlePointerLeave = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (startXRef.current !== null) {
      handlePointerUp(e)
    }
  }

  const handleReset = () => {
    setRevealed(false)
    setOffset(0)
  }

  return (
    <li className="online-contact-item" data-testid={`contact-item-${friend.id}`}>
      <div
        className={`online-contact-swipe${dragging ? ' online-contact-swipe--dragging' : ''}`}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onClick={revealed ? handleReset : undefined}
        role="listitem"
        data-testid={`contact-swipe-${friend.id}`}
      >
        <strong data-testid={`contact-name-${friend.id}`}>{friend.name}</strong>
      </div>
      {revealed && (
        <button
          className="online-contact-remove-btn"
          aria-label={removeAriaLabel.replace('{name}', friend.name)}
          onClick={() => onRemove(friend.id)}
          data-testid={`contact-remove-btn-${friend.id}`}
        >
          {removeLabel}
        </button>
      )}
    </li>
  )
}

function ContactsTab({
  profileName,
  sync,
  onlineFriends,
  onRemoveContact,
}: {
  profileName: string
  sync: OnlineSyncAPI
  onlineFriends: Friend[]
  onRemoveContact: (friendId: string) => void
}) {
  const { t } = useTranslation()
  const c = t.onlineSharingHub.contacts
  const { url, share, copied } = useContactShare(profileName, sync, t.contactHandshake)

  return (
    <section className="friends-section">
      <h3 className="friends-section-title">{c.linkHeading}</h3>
      <p className="friends-hint">{c.linkHint}</p>
      <button className="share-cta-btn" onClick={share} disabled={!url}>
        {copied ? c.copied : c.shareLinkButton}
      </button>

      <h3 className="friends-section-title" style={{ marginTop: '1.5rem' }}>
        {c.contactsHeading}
      </h3>
      {onlineFriends.length === 0 ? (
        <p className="friends-hint" data-testid="no-contacts-hint">{c.noContactsHint}</p>
      ) : (
        <ul className="online-contact-list" data-testid="contacts-list">
          {onlineFriends.map(f => (
            <ContactItem
              key={f.id}
              friend={f}
              removeLabel={c.removeContactButton}
              removeAriaLabel={c.removeContactAriaLabel}
              onRemove={onRemoveContact}
            />
          ))}
        </ul>
      )}
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
          className="btn btn--ghost btn--sm"
          onClick={() => setConfirming(true)}
        >
          {s.deactivateButton}
        </button>
      ) : (
        <div className="online-confirm">
          <p><strong>{s.confirmStrong}</strong>{s.confirmRest}</p>
          <button
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

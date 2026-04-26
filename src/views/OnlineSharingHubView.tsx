import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { generateContactUrl, shareOrCopy } from '../utils/secureLink'
import { generateShareCard } from '../utils/shareCard'
import { CATEGORIES } from '../data/categories'
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
}

type Tab = 'feed' | 'share' | 'contacts' | 'settings'

// ── Shared hook: contact link share logic ────────────────────────────────────
// Used by both OnboardingScreen and ContactsTab to avoid duplication.

function useContactShare(profileName: string, sync: OnlineSyncAPI) {
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
        title: `${profileName} lädt ein`,
        subtitle: 'Teile Erinnerungen sicher & privat – ohne Account.',
      }))
      .then(f => { shareCardRef.current = f })
      .catch(() => {})
  }, [profileName])

  const share = useCallback(async () => {
    if (!url) return
    const card = shareCardRef.current
    if (card && typeof navigator.share === 'function' && navigator.canShare?.({ files: [card] })) {
      const text = `${profileName} möchte Remember-Me-Erinnerungen mit dir teilen. Öffne diesen Link, um dich zu verknüpfen:\n\n${url}`
      try {
        await navigator.share({ files: [card], title: 'Remember Me – Online-Kontakt', text })
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
      }
    }
    const sent = await shareOrCopy({
      title: 'Remember Me – Online-Kontakt',
      text: `${profileName} möchte Remember-Me-Erinnerungen mit dir teilen. Öffne diesen Link, um dich zu verknüpfen:`,
      url,
    })
    if (!sent) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [url, profileName])

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
}: Props) {
  const [tab, setTab] = useState<Tab>('feed')
  const onlineFriends = useMemo(() => friends.filter(f => f.online), [friends])
  const hasContacts = onlineFriends.length > 0

  return (
    <div className="friends-view">
      <div className="quiz-topbar">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>Zurück</button>
        <h2 className="archive-title">Online teilen</h2>
      </div>

      {sync.error && (
        <section className="friends-section">
          <p className="friends-hint friends-hint--warn">
            Sync-Fehler: {sync.error}
          </p>
        </section>
      )}

      {!sync.ready && !sync.error && (
        <section className="friends-section">
          <p className="friends-hint">Verbinde mit Server …</p>
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
              Feed {sync.memories.length > 0 && (
                <span className="online-tab-badge">{sync.memories.length}</span>
              )}
            </TabButton>
            <TabButton active={tab === 'share'} onClick={() => setTab('share')}>
              Teilen
            </TabButton>
            <TabButton active={tab === 'contacts'} onClick={() => setTab('contacts')}>
              Einladen
            </TabButton>
            <TabButton active={tab === 'settings'} onClick={() => setTab('settings')}>
              Einstellungen
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
  const { url, share, copied } = useContactShare(profileName, sync)
  const [showSettings, setShowSettings] = useState(false)

  return (
    <section className="friends-section online-onboarding">
      <div className="online-onboarding__icon">🔗</div>

      <h3 className="friends-section-title">Jemanden einladen</h3>

      <p className="friends-hint">
        Schick diesen Link an jemanden, dem du vertraust. Sobald die Person
        ihn öffnet, seid ihr verknüpft und könnt gegenseitig Erinnerungen
        sicher miteinander teilen.
      </p>

      <button className="share-cta-btn" onClick={share} disabled={!url}>
        {copied ? 'In die Zwischenablage kopiert ✓' : '📤 Verbindungslink teilen'}
      </button>

      <ul className="online-onboarding__steps">
        <li>Du teilst deinen Link</li>
        <li>Die Person öffnet ihn – fertig, ihr seid verknüpft</li>
        <li>Jetzt könnt ihr gegenseitig Erinnerungen teilen</li>
      </ul>

      <button
        className="btn btn--ghost btn--sm online-onboarding__settings-btn"
        onClick={() => setShowSettings(s => !s)}
      >
        {showSettings ? 'Einstellungen schließen' : 'Einstellungen'}
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
  if (memories.length === 0) {
    return (
      <section className="friends-section">
        <p className="friends-hint">
          Noch keine Erinnerungen von deinen Kontakten eingegangen. Teile
          selbst eine – oder lade weitere Personen ein.
        </p>
        <div className="online-empty-actions">
          <button className="share-cta-btn" onClick={onGoToShare}>
            Erinnerung teilen →
          </button>
          <button className="btn btn--ghost btn--sm" onClick={onGoToInvite}>
            Weiteren Kontakt einladen
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
          {new Date(memory.createdAt).toLocaleDateString('de-DE')}
        </span>
      </header>
      <p className="shared-memory-question">{memory.questionText}</p>
      <p className="shared-memory-value">{memory.value}</p>

      {annotations.length > 0 && (
        <ul className="shared-memory-annotations">
          {annotations.map(a => (
            <li key={a.annotationId}>
              <strong>{a.authorName}</strong>: {a.text}
            </li>
          ))}
        </ul>
      )}

      <div className="shared-memory-compose">
        <label>
          Ergänzung hinzufügen
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={3}
            placeholder="Deine Erinnerung dazu …"
          />
        </label>
        <button
          className="btn btn--ghost btn--sm"
          onClick={submit}
          disabled={status === 'sending' || !draft.trim()}
        >
          {status === 'sending' ? 'Sende …'
            : status === 'sent' ? 'Gesendet ✓'
            : status === 'error' ? 'Fehler – erneut versuchen'
            : 'Ergänzung senden'}
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
            () => reject(new Error('Zeitüberschreitung – bitte Internetverbindung prüfen und erneut versuchen')),
            TIMEOUT_MS,
          )
        ),
      ])
      setStatus('sent')
      setTimeout(() => setStatus('idle'), 2000)
      setSelectedFriends(new Set())
    } catch (err) {
      console.error(err)
      setErrorMsg((err as Error).message ?? 'unbekannter Fehler')
      setStatus('error')
    }
  }, [selectedQ, selectedFriends, sync.service, answers, onlineFriends, profileName])

  if (options.length === 0) {
    return (
      <section className="friends-section">
        <p className="friends-hint">
          Beantworte erst eine Frage im Quiz – sie kann dann hier geteilt werden.
        </p>
      </section>
    )
  }

  return (
    <section className="friends-section">
      <span className="share-tab__label">Welche Erinnerung teilen?</span>
      <div className="share-memory-list" role="radiogroup" aria-label="Erinnerung auswählen">
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

      <span className="share-tab__label">An wen?</span>
      <div className="share-recipient-list" role="group" aria-label="Empfänger auswählen">
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
          {status === 'sending' ? 'Verschlüssele & sende …'
            : status === 'sent' ? 'Gesendet ✓'
            : 'Verschlüssele & sende'}
        </button>
        {status === 'error' && errorMsg && (
          <p className="share-tab__error" role="alert">{errorMsg}</p>
        )}
      </div>
    </section>
  )
}

// ── Contacts / Einladen ──────────────────────────────────────────────────────

function ContactsTab({
  profileName,
  sync,
  onlineFriends,
}: {
  profileName: string
  sync: OnlineSyncAPI
  onlineFriends: Friend[]
}) {
  const { url, share, copied } = useContactShare(profileName, sync)

  return (
    <section className="friends-section">
      <h3 className="friends-section-title">Dein Verbindungslink</h3>
      <p className="friends-hint">
        Schicke diesen Link an jemanden, den du verbinden möchtest. Sobald
        er oder sie ihn öffnet, seid ihr verknüpft – und könnt gegenseitig
        Erinnerungen teilen.
      </p>
      <button className="share-cta-btn" onClick={share} disabled={!url}>
        {copied ? 'In die Zwischenablage kopiert ✓' : 'Verbindungslink teilen'}
      </button>

      <h3 className="friends-section-title" style={{ marginTop: '1.5rem' }}>
        Verbundene Kontakte
      </h3>
      {onlineFriends.length === 0 ? (
        <p className="friends-hint">Noch niemand verknüpft. Teile deinen Verbindungslink, um loszulegen.</p>
      ) : (
        <ul className="online-contact-list">
          {onlineFriends.map(f => (
            <li key={f.id}>
              <strong>{f.name}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ── Settings / Deactivate ───────────────────────────────────────────────────

function SettingsTab({ onDeactivate }: { onDeactivate: () => void }) {
  const [confirming, setConfirming] = useState(false)

  return (
    <section className="friends-section">
      <h3 className="friends-section-title">Direktes Teilen deaktivieren</h3>
      <p className="friends-hint">
        Löscht alle deine geteilten Erinnerungen vom Server und trennt die
        Verbindung zu deinen Kontakten. Deine eigenen Antworten und Fotos
        auf diesem Gerät bleiben vollständig erhalten.
      </p>
      {!confirming ? (
        <button
          className="btn btn--ghost btn--sm"
          onClick={() => setConfirming(true)}
        >
          Deaktivieren
        </button>
      ) : (
        <div className="online-confirm">
          <p><strong>Wirklich deaktivieren?</strong> Das kann nicht rückgängig gemacht werden — kontaktierte Personen können deine bisher geteilten Erinnerungen nicht mehr sehen.</p>
          <button
            className="share-cta-btn share-cta-btn--error"
            onClick={onDeactivate}
          >
            Ja, alles löschen
          </button>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => setConfirming(false)}
          >
            Abbrechen
          </button>
        </div>
      )}
    </section>
  )
}

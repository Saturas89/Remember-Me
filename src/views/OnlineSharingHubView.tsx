import { useCallback, useMemo, useState } from 'react'
import { generateContactUrl, shareOrCopy } from '../utils/secureLink'
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

/**
 * The post-opt-in control surface for online sharing. Four tabs:
 *   • Feed        – Erinnerungen, die andere mit mir geteilt haben
 *   • Teilen      – eigene Erinnerung an Kontakte senden
 *   • Kontakte    – Invite-Link erstellen, gelinkte Kontakte sehen
 *   • Einstellungen – Feature deaktivieren + Server-Daten löschen
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

      <nav className="online-tabs" role="tablist">
        <TabButton active={tab === 'feed'} onClick={() => setTab('feed')}>
          Feed {sync.memories.length > 0 && <span className="online-tab-badge">{sync.memories.length}</span>}
        </TabButton>
        <TabButton active={tab === 'share'} onClick={() => setTab('share')}>
          Teilen
        </TabButton>
        <TabButton active={tab === 'contacts'} onClick={() => setTab('contacts')}>
          Kontakte
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

// ── Feed ────────────────────────────────────────────────────────────────────

function FeedTab({
  memories,
  annotations,
  profileName,
  sync,
  onlineFriends,
}: {
  memories: SharedMemory[]
  annotations: Annotation[]
  profileName: string
  sync: OnlineSyncAPI
  onlineFriends: Friend[]
}) {
  if (memories.length === 0) {
    return (
      <section className="friends-section">
        <p className="friends-hint">
          Hier erscheinen Erinnerungen, die andere mit dir geteilt haben.
          Teile selbst deinen #contact/-Link, damit Kontakte dich als
          Empfänger hinzufügen können.
        </p>
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
    // Audience = share owner + other online friends (so the owner + others see the annotation)
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

      await sync.service.shareMemory({ body, recipients, images: [] })
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
          Du hast noch keine Antworten gespeichert. Beantworte erst eine
          Frage im Quiz; sie kann dann hier geteilt werden.
        </p>
      </section>
    )
  }

  if (onlineFriends.length === 0) {
    return (
      <section className="friends-section">
        <p className="friends-hint">
          Du hast noch keine Online-Kontakte. Erstelle im Tab „Kontakte"
          einen Einladungs-Link und lass dir einen zurückschicken, bevor du
          teilen kannst.
        </p>
      </section>
    )
  }

  return (
    <section className="friends-section">
      <label className="online-field">
        Welche Erinnerung?
        <select value={selectedQ} onChange={e => setSelectedQ(e.target.value)}>
          <option value="">— auswählen —</option>
          {options.map(a => (
            <option key={a.id} value={a.id}>
              {(a.value || '').slice(0, 60)}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="online-field">
        <legend>An wen?</legend>
        {onlineFriends.map(f => (
          <label key={f.id} className="online-recipient">
            <input
              type="checkbox"
              checked={selectedFriends.has(f.id)}
              onChange={() => toggle(f.id)}
            />
            <span>{f.name}</span>
          </label>
        ))}
      </fieldset>

      <button
        className="share-cta-btn"
        disabled={!selectedQ || selectedFriends.size === 0 || status === 'sending'}
        onClick={send}
      >
        {status === 'sending' ? 'Verschlüssele & sende …'
          : status === 'sent' ? 'Gesendet ✓'
          : status === 'error' ? 'Fehler – erneut versuchen'
          : 'Erinnerung verschlüsselt teilen'}
      </button>

      {status === 'error' && errorMsg && (
        <p className="friends-hint friends-hint--warn">{errorMsg}</p>
      )}
    </section>
  )
}

// ── Contacts ────────────────────────────────────────────────────────────────

function ContactsTab({
  profileName,
  sync,
  onlineFriends,
}: {
  profileName: string
  sync: OnlineSyncAPI
  onlineFriends: Friend[]
}) {
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

  const share = async () => {
    if (!url) return
    const sent = await shareOrCopy({
      title: 'Remember Me – Online-Kontakt',
      text: `${profileName} möchte Remember-Me-Erinnerungen mit dir teilen. Öffne diesen Link, um dich zu verknüpfen:`,
      url,
    })
    if (!sent) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <section className="friends-section">
      <h3 className="friends-section-title">Dein Einladungs-Link</h3>
      <p className="friends-hint">
        Gib diesen Link an Personen, mit denen du online Erinnerungen teilen
        willst. Nachdem sie den Link geöffnet haben, bekommst du auch ihren
        Link zurück — dann könnt ihr gegenseitig teilen.
      </p>
      <button className="share-cta-btn" onClick={share} disabled={!url}>
        {copied ? 'In die Zwischenablage kopiert ✓' : 'Einladungs-Link teilen'}
      </button>

      <h3 className="friends-section-title" style={{ marginTop: '1.5rem' }}>
        Verknüpfte Kontakte
      </h3>
      {onlineFriends.length === 0 ? (
        <p className="friends-hint">Noch keine Online-Kontakte.</p>
      ) : (
        <ul className="online-contact-list">
          {onlineFriends.map(f => (
            <li key={f.id}>
              <strong>{f.name}</strong>
              <code>{f.online?.deviceId.slice(0, 8)}…</code>
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
      <h3 className="friends-section-title">Online-Teilen deaktivieren</h3>
      <p className="friends-hint">
        Löscht alle deine geteilten Erinnerungen, Ergänzungen und Medien
        vom Server, meldet dein Gerät ab und entfernt deinen Private Key
        lokal. Deine eigenen Offline-Antworten bleiben unberührt.
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

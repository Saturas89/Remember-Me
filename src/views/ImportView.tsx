import { useState, useRef, useCallback } from 'react'
import { parseInstagramZip, type ImportCandidate } from '../utils/importInstagram'
import { useImageStore } from '../hooks/useImageStore'

type Step =
  | 'platform'        // 1 – choose platform
  | 'instructions'    // 2 – step-by-step guide
  | 'upload'          // 3 – pick ZIP file
  | 'parsing'         // 3b – reading the ZIP
  | 'preview'         // 4 – select + describe entries
  | 'importing'       // 5 – storing images + saving
  | 'done'            // 6 – success screen

interface Props {
  onImport: (entries: Array<{
    questionText: string
    description: string
    imageIds: string[]
    eventDate?: string
    importSource?: {
      platform: 'instagram' | 'facebook'
      originalId: string
      originalCaption?: string
      importedAt: string
    }
  }>) => void
  onBack: () => void
  /** Called when the user presses "Zum Archiv" on the done screen */
  onDone?: () => void
}

const INSTAGRAM_STEPS = [
  { icon: '📱', text: 'Öffne die Instagram-App auf deinem Handy' },
  { icon: '👤', text: 'Tippe auf dein Profilbild unten rechts' },
  { icon: '☰',  text: 'Tippe oben rechts auf das Menü-Symbol (drei Striche)' },
  { icon: '⚙️', text: 'Wähle „Einstellungen und Aktivitäten"' },
  { icon: '📥', text: 'Suche nach „Deine Informationen und Berechtigungen"' },
  { icon: '💾', text: 'Tippe auf „Deine Instagram-Informationen herunterladen"' },
  { icon: '📋', text: 'Wähle „Einige deiner Informationen"→ „Beiträge" auswählen' },
  { icon: '📄', text: 'Wähle Format: JSON (wichtig – nicht HTML!)' },
  { icon: '📧', text: 'Tippe auf „Anfrage erstellen" – du erhältst eine E-Mail mit dem Download-Link' },
  { icon: '📦', text: 'Lade die ZIP-Datei herunter und lade sie hier hoch' },
]

export function ImportView({ onImport, onBack, onDone }: Props) {
  const [step, setStep] = useState<Step>('platform')
  const [candidates, setCandidates] = useState<ImportCandidate[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [importedCount, setImportedCount] = useState(0)
  const [importingIndex, setImportingIndex] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { addImage } = useImageStore()

  // ── Cleanup object URLs on unmount ───────────────────────
  const revokeAll = useCallback((items: ImportCandidate[]) => {
    items.forEach(c => { if (c.previewUrl) URL.revokeObjectURL(c.previewUrl) })
  }, [])

  // ── Toggle selection ─────────────────────────────────────
  function toggleAll(selected: boolean) {
    setCandidates(prev => prev.map(c => ({ ...c, selected })))
  }

  function toggleOne(id: string) {
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, selected: !c.selected } : c))
  }

  function updateDescription(id: string, value: string) {
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, description: value } : c))
  }

  // ── Parse ZIP ────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setParseError(null)
    setStep('parsing')
    try {
      const result = await parseInstagramZip(file)
      setCandidates(result)
      setStep('preview')
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Unbekannter Fehler beim Lesen der Datei.')
      setStep('upload')
    }
    e.target.value = ''
  }

  // ── Confirm import ───────────────────────────────────────
  async function handleConfirm() {
    const selected = candidates.filter(c => c.selected)
    if (selected.length === 0) return

    setStep('importing')
    const entries: Parameters<typeof onImport>[0] = []
    const now = new Date().toISOString()

    for (let i = 0; i < selected.length; i++) {
      setImportingIndex(i + 1)
      const c = selected[i]

      // Store image in IndexedDB
      const imageIds: string[] = []
      if (c.imageBlob) {
        try {
          const file = new File([c.imageBlob], 'import.jpg', { type: c.imageBlob.type || 'image/jpeg' })
          const id = await addImage(file)
          imageIds.push(id)
        } catch {
          // Image storage failed – import text only
        }
      }

      entries.push({
        questionText: c.description || c.originalCaption || 'Instagram-Erinnerung',
        description: c.description,
        imageIds,
        eventDate: c.timestamp ? new Date(c.timestamp * 1000).toISOString() : undefined,
        importSource: {
          platform: 'instagram',
          originalId: c.id,
          originalCaption: c.originalCaption || undefined,
          importedAt: now,
        },
      })
    }

    // Revoke preview URLs
    revokeAll(candidates)

    onImport(entries)
    setImportedCount(entries.length)
    setStep('done')
  }

  const selectedCount = candidates.filter(c => c.selected).length

  // ── Render ───────────────────────────────────────────────

  if (step === 'platform') {
    return (
      <div className="import-view">
        <div className="import-topbar">
          <button className="btn btn--ghost btn--sm" onClick={onBack}>← Zurück</button>
        </div>
        <h1 className="import-heading">📥 Importieren</h1>
        <p className="import-subtext">
          Übernimm Erinnerungen und Fotos aus sozialen Netzwerken in dein Lebensarchiv.
        </p>
        <div className="import-platform-grid">
          <button className="import-platform-card" onClick={() => setStep('instructions')}>
            <span className="import-platform-icon">📷</span>
            <span className="import-platform-name">Instagram</span>
            <span className="import-platform-desc">Fotos & Beiträge importieren</span>
          </button>
          <button className="import-platform-card import-platform-card--soon" disabled>
            <span className="import-platform-icon">📘</span>
            <span className="import-platform-name">Facebook</span>
            <span className="import-platform-badge">Demnächst</span>
          </button>
        </div>
        <p className="import-privacy-note">
          🔒 Alle Daten werden ausschließlich auf deinem Gerät verarbeitet – nichts wird übertragen.
        </p>
      </div>
    )
  }

  if (step === 'instructions') {
    return (
      <div className="import-view">
        <div className="import-topbar">
          <button className="btn btn--ghost btn--sm" onClick={() => setStep('platform')}>← Zurück</button>
        </div>
        <div className="import-step-indicator">Schritt 1 von 3</div>
        <h1 className="import-heading">📷 Instagram-Export erstellen</h1>
        <p className="import-subtext">
          Folge diesen Schritten in der Instagram-App. Die Vorbereitung dauert nur wenige Minuten –
          die Datei ist danach per E-Mail verfügbar (kann bis zu 48 Stunden dauern).
        </p>

        <ol className="import-steps-list">
          {INSTAGRAM_STEPS.map((s, i) => (
            <li key={i} className="import-steps-item">
              <span className="import-steps-icon">{s.icon}</span>
              <span className="import-steps-text">{s.text}</span>
            </li>
          ))}
        </ol>

        <div className="import-tip">
          <strong>💡 Tipp:</strong> Wähle nur „Beiträge" aus, damit die Datei kleiner bleibt
          und schneller heruntergeladen werden kann.
        </div>

        <button className="btn btn--primary import-cta" onClick={() => setStep('upload')}>
          Ich habe die ZIP-Datei bereit →
        </button>
      </div>
    )
  }

  if (step === 'upload' || step === 'parsing') {
    return (
      <div className="import-view">
        <div className="import-topbar">
          <button className="btn btn--ghost btn--sm" onClick={() => setStep('instructions')}>← Zurück</button>
        </div>
        <div className="import-step-indicator">Schritt 2 von 3</div>
        <h1 className="import-heading">ZIP-Datei hochladen</h1>
        <p className="import-subtext">
          Lade jetzt die ZIP-Datei hoch, die du von Instagram per E-Mail erhalten hast.
          Die Datei wird nur auf deinem Gerät gelesen – nichts wird gespeichert oder übertragen.
        </p>

        {parseError && (
          <div className="import-error">
            <strong>⚠️ Fehler beim Lesen</strong>
            <p>{parseError}</p>
          </div>
        )}

        {step === 'parsing' ? (
          <div className="import-parsing">
            <div className="import-spinner" aria-hidden="true" />
            <p>ZIP wird analysiert…</p>
            <p className="import-parsing-hint">Bei großen Exporten kann das einen Moment dauern.</p>
          </div>
        ) : (
          <button
            className="import-file-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="import-file-icon">📁</span>
            <span className="import-file-label">ZIP-Datei auswählen</span>
            <span className="import-file-hint">instagram-*.zip</span>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,application/zip"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>
    )
  }

  if (step === 'preview') {
    return (
      <div className="import-view import-view--preview">
        <div className="import-topbar">
          <button className="btn btn--ghost btn--sm" onClick={() => setStep('upload')}>← Zurück</button>
          <span className="import-topbar-count">{candidates.length} gefunden</span>
        </div>
        <div className="import-step-indicator">Schritt 3 von 3</div>
        <h1 className="import-heading">Auswahl & Beschreibung</h1>
        <p className="import-subtext">
          Wähle die Erinnerungen aus, die du übernehmen möchtest. Du kannst die Beschreibung
          für jeden Eintrag direkt bearbeiten.
        </p>

        <div className="import-select-all-row">
          <button className="btn btn--ghost btn--sm" onClick={() => toggleAll(true)}>Alle</button>
          <button className="btn btn--ghost btn--sm" onClick={() => toggleAll(false)}>Keine</button>
          <span className="import-selected-hint">{selectedCount} ausgewählt</span>
        </div>

        <div className="import-entry-list">
          {candidates.map(c => (
            <div
              key={c.id}
              className={`import-entry-card ${c.selected ? 'import-entry-card--selected' : ''}`}
            >
              <label className="import-entry-check-label">
                <input
                  type="checkbox"
                  className="import-entry-checkbox"
                  checked={c.selected}
                  onChange={() => toggleOne(c.id)}
                />
                {c.previewUrl && (
                  <img
                    src={c.previewUrl}
                    alt=""
                    className="import-entry-thumb"
                    loading="lazy"
                  />
                )}
                {!c.previewUrl && (
                  <span className="import-entry-no-thumb" aria-hidden="true">📷</span>
                )}
                <div className="import-entry-meta">
                  <span className="import-entry-date">
                    {c.timestamp
                      ? new Date(c.timestamp * 1000).toLocaleDateString('de-DE', {
                          day: 'numeric', month: 'long', year: 'numeric',
                        })
                      : 'Datum unbekannt'}
                  </span>
                </div>
              </label>
              {c.selected && (
                <textarea
                  className="import-entry-desc"
                  value={c.description}
                  onChange={e => updateDescription(c.id, e.target.value)}
                  placeholder="Beschreibung hinzufügen…"
                  rows={2}
                />
              )}
            </div>
          ))}
        </div>

        <div className="import-confirm-bar">
          <button
            className="btn btn--primary"
            onClick={handleConfirm}
            disabled={selectedCount === 0}
          >
            {selectedCount === 0
              ? 'Keine Auswahl'
              : `${selectedCount} Erinnerung${selectedCount !== 1 ? 'en' : ''} importieren`}
          </button>
        </div>
      </div>
    )
  }

  if (step === 'importing') {
    return (
      <div className="import-view import-view--center">
        <div className="import-spinner import-spinner--large" aria-hidden="true" />
        <p className="import-importing-text">Erinnerungen werden gespeichert…</p>
        <p className="import-importing-count">{importingIndex} von {selectedCount}</p>
      </div>
    )
  }

  // done
  return (
    <div className="import-view import-view--center">
      <div className="import-done-icon" aria-hidden="true">✅</div>
      <h1 className="import-heading">Import abgeschlossen</h1>
      <p className="import-subtext">
        <strong>{importedCount} Erinnerung{importedCount !== 1 ? 'en' : ''}</strong> wurden
        erfolgreich in dein Lebensarchiv übernommen.
      </p>
      <p className="import-done-hint">
        Du findest sie im Archiv unter „Eigene Fragen".
      </p>
      <div className="import-done-actions">
        <button className="btn btn--primary" onClick={onDone ?? onBack}>
          Zum Archiv →
        </button>
        <button className="btn btn--ghost" onClick={() => {
          setCandidates([])
          setParseError(null)
          setStep('platform')
        }}>
          Weiteren Import starten
        </button>
      </div>
    </div>
  )
}

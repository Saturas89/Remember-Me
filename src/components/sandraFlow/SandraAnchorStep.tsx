import { useState, useEffect } from 'react'
import type { SandraFlowStrings } from '../../i18n/de/sandraFlow'
import type { SandraAnchor } from '../../types/sandraFlow'

interface Props {
  t: SandraFlowStrings
  anchor: SandraAnchor
  onUpdate: (anchor: SandraAnchor) => void
  onBack: () => void
  onNext: () => void
}

type ChipKey = keyof SandraFlowStrings['anchor']['chipLabels']

const CHIPS: ChipKey[] = ['mama', 'papa', 'oma', 'opa', 'tante_onkel', 'geschwister', 'other']

export function SandraAnchorStep({ t, anchor, onUpdate, onBack, onNext }: Props) {
  const [relation, setRelation] = useState(anchor.relation)
  const [anrede, setAnrede] = useState(anchor.anrede)
  const [birthYear, setBirthYear] = useState<string>(
    anchor.birthYear ? String(anchor.birthYear) : '',
  )
  const [otherText, setOtherText] = useState(
    anchor.relation && !CHIPS.includes(anchor.relation as ChipKey) ? anchor.relation : '',
  )
  const [touched, setTouched] = useState(false)

  // Auto-prefill the anrede whenever Sandra picks a default chip and hasn't
  // typed anything yet. Free-form ("other") never triggers a prefill.
  useEffect(() => {
    if (anrede.trim()) return
    if (!relation || relation === 'other') return
    const chipLabel = t.anchor.chipLabels[relation as ChipKey]
    if (chipLabel) setAnrede(chipLabel)
  }, [relation, anrede, t])

  function pickChip(key: ChipKey) {
    if (key === 'other') {
      setRelation('other')
    } else {
      setRelation(key)
    }
  }

  function handleNext() {
    setTouched(true)
    const effectiveRelation = relation === 'other' ? otherText.trim() : relation
    if (!effectiveRelation || !anrede.trim()) return
    const year = birthYear.trim() ? parseInt(birthYear.trim(), 10) : undefined
    onUpdate({
      relation: effectiveRelation,
      anrede: anrede.trim(),
      birthYear: year && year >= 1900 && year <= 2020 ? year : undefined,
    })
    onNext()
  }

  const validRelation = relation === 'other' ? otherText.trim().length > 0 : relation.length > 0
  const validAnrede = anrede.trim().length > 0

  return (
    <div className="sandra-flow-view">
      <div className="quiz-topbar">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>
          {t.back}
        </button>
      </div>

      <section className="friends-section">
        <h2 className="friends-section-title">{t.anchor.title}</h2>
        <div className="friends-tags sandra-chip-row">
          {CHIPS.map(key => (
            <button
              key={key}
              type="button"
              className={`friends-tag sandra-chip${relation === key ? ' sandra-chip--active' : ''}`}
              onClick={() => pickChip(key)}
              data-testid={`sandra-anchor-chip-${key}`}
            >
              {t.anchor.chipLabels[key]}
            </button>
          ))}
        </div>
        {relation === 'other' && (
          <input
            type="text"
            className="input-text"
            placeholder={t.anchor.otherPlaceholder}
            value={otherText}
            onChange={e => setOtherText(e.target.value)}
            aria-label={t.anchor.otherPlaceholder}
          />
        )}
        {touched && !validRelation && (
          <p className="friends-hint friends-hint--warn">{t.anchor.validationRelation}</p>
        )}
      </section>

      <section className="friends-section">
        <h3 className="friends-section-title">{t.anchor.anredeLabel}</h3>
        <p className="friends-hint">{t.anchor.anredeHelper}</p>
        <input
          type="text"
          className="input-text"
          placeholder={t.anchor.anredePlaceholder}
          value={anrede}
          onChange={e => setAnrede(e.target.value)}
          aria-label={t.anchor.anredeLabel}
          data-testid="sandra-anchor-anrede"
        />
        {touched && !validAnrede && (
          <p className="friends-hint friends-hint--warn">{t.anchor.validationAnrede}</p>
        )}
      </section>

      <section className="friends-section">
        <h3 className="friends-section-title">{t.anchor.birthYearLabel}</h3>
        <input
          type="number"
          min={1900}
          max={2020}
          className="input-text"
          placeholder={t.anchor.birthYearPlaceholder}
          value={birthYear}
          onChange={e => setBirthYear(e.target.value)}
          aria-label={t.anchor.birthYearLabel}
        />
      </section>

      <div className="friends-share">
        <button
          type="button"
          className="share-cta-btn"
          onClick={handleNext}
          disabled={!validRelation || !validAnrede}
          data-testid="sandra-anchor-next"
        >
          {t.anchor.next}
        </button>
      </div>
    </div>
  )
}

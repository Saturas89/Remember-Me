import { useState, useMemo, useEffect } from 'react'
import type { SandraFlowStrings } from '../../i18n/de/sandraFlow'
import type { Locale } from '../../locales'
import type { SandraAnchor } from '../../types/sandraFlow'
import { findTrigger, getInspirationQuestions } from '../../data/loadPersonalQuestions'
import { composeAll } from '../../lib/sandraFlow/templateEngine'

interface Props {
  t: SandraFlowStrings
  locale: Locale
  anchor: SandraAnchor
  triggerId: string
  seed: string
  onSeedChange: (seed: string) => void
  onChangeTrigger: () => void
  onDiscard: () => void
  onAdd: (text: string) => void
}

export function SandraComposerStep({
  t,
  locale,
  anchor,
  triggerId,
  seed,
  onSeedChange,
  onChangeTrigger,
  onDiscard,
  onAdd,
}: Props) {
  const trigger = useMemo(() => findTrigger(locale, triggerId), [locale, triggerId])
  const isFreeform = triggerId === 'freeform'

  const [draftText, setDraftText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [discarded, setDiscarded] = useState<Set<string>>(new Set())
  const [showInspiration, setShowInspiration] = useState(false)
  const [showEmptyError, setShowEmptyError] = useState(false)

  // Rotating placeholder for the seed textarea. Picks one at random on mount.
  const placeholder = useMemo(() => {
    const list = t.composer.seedPlaceholders
    return list[Math.floor(Math.random() * list.length)]
  }, [t])

  useEffect(() => {
    setDraftText('')
    setEditingId(null)
    setDiscarded(new Set())
    setShowEmptyError(false)
  }, [triggerId])

  const suggestions = useMemo(() => {
    if (!trigger || isFreeform) return []
    return composeAll(trigger.templates, anchor.anrede, seed).filter(
      s => !discarded.has(s.template.id),
    )
  }, [trigger, anchor.anrede, seed, discarded, isFreeform])

  const inspiration = useMemo(
    () => (isFreeform ? [] : getInspirationQuestions(locale, triggerId)),
    [locale, triggerId, isFreeform],
  )

  function handleUseSuggestion(text: string) {
    onAdd(text)
  }

  function handleEditSuggestion(templateId: string, text: string) {
    setEditingId(templateId)
    setEditText(text)
  }

  function handleCommitEdit() {
    if (!editText.trim()) return
    onAdd(editText.trim())
    setEditingId(null)
  }

  function handleAddFreeform() {
    if (!draftText.trim()) {
      setShowEmptyError(true)
      return
    }
    onAdd(draftText.trim())
  }

  function handleInspirationClick(text: string) {
    onSeedChange(text)
  }

  return (
    <div className="sandra-flow-view">
      <div className="quiz-topbar">
        <button className="btn btn--ghost btn--sm" onClick={onDiscard}>
          {t.back}
        </button>
      </div>

      <section className="friends-section sandra-composer">
        {/* Zone A: trigger chip */}
        <div className="sandra-composer__zone-a">
          <button
            type="button"
            className="friends-tag sandra-trigger-chip"
            onClick={onChangeTrigger}
            data-testid="sandra-composer-trigger-chip"
          >
            {(trigger?.title ?? t.composer.triggerChipLabel).replace('{anrede}', anchor.anrede)}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onChangeTrigger}
          >
            {t.composer.backToTriggers}
          </button>
        </div>

        {/* Zone B: seed textarea or freeform textarea */}
        <div className="sandra-composer__zone-b">
          {isFreeform ? (
            <>
              <label className="input-label" htmlFor="sandra-freeform-input">
                {t.composer.freeformLabel}
              </label>
              <textarea
                id="sandra-freeform-input"
                className="input-textarea sandra-composer__textarea"
                placeholder={t.composer.freeformPlaceholder}
                value={draftText}
                onChange={e => {
                  setDraftText(e.target.value)
                  setShowEmptyError(false)
                }}
                rows={4}
                aria-describedby="sandra-freeform-hint"
                data-testid="sandra-composer-freeform"
              />
              <p id="sandra-freeform-hint" className="friends-hint">
                {t.composer.freeformHelper.replace('{anrede}', anchor.anrede)}
              </p>
            </>
          ) : (
            <>
              <label className="input-label" htmlFor="sandra-seed-input">
                {t.composer.seedLabel}
              </label>
              <textarea
                id="sandra-seed-input"
                className="input-textarea sandra-composer__textarea"
                placeholder={placeholder}
                value={seed}
                onChange={e => onSeedChange(e.target.value)}
                rows={3}
                aria-describedby="sandra-seed-hint"
                data-testid="sandra-composer-seed"
              />
              <p id="sandra-seed-hint" className="friends-hint">
                {t.composer.seedHelper}
              </p>
            </>
          )}
        </div>

        {/* Zone C: suggestions (template variants) */}
        {!isFreeform && suggestions.length > 0 && (
          <div className="sandra-composer__zone-c">
            <h3 className="friends-section-title">{t.composer.suggestionsHeading}</h3>
            <p className="friends-hint">{t.composer.suggestionsHint}</p>
            <div className="friends-list">
              {suggestions.map(({ template, text }) => {
                const isEditing = editingId === template.id
                return (
                  <div
                    key={template.id}
                    className="friend-card sandra-suggestion"
                    data-testid={`sandra-suggestion-${template.id}`}
                  >
                    {isEditing ? (
                      <div className="sandra-suggestion__edit">
                        <textarea
                          className="input-textarea"
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          rows={3}
                          aria-label={t.composer.suggestionEdit}
                          autoFocus
                        />
                        <div className="sandra-suggestion__edit-actions">
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => setEditingId(null)}
                          >
                            {t.composer.discard}
                          </button>
                          <button
                            type="button"
                            className="share-cta-btn sandra-suggestion__use"
                            onClick={handleCommitEdit}
                            disabled={!editText.trim()}
                          >
                            {t.composer.suggestionUse}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <span className="sandra-suggestion__text">{text}</span>
                        <div className="sandra-suggestion__actions">
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => handleEditSuggestion(template.id, text)}
                            data-testid={`sandra-suggestion-edit-${template.id}`}
                          >
                            {t.composer.suggestionEdit}
                          </button>
                          <button
                            type="button"
                            className="btn btn--primary btn--sm"
                            onClick={() => handleUseSuggestion(text)}
                            data-testid={`sandra-suggestion-use-${template.id}`}
                          >
                            {t.composer.suggestionUse}
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => setDiscarded(prev => new Set(prev).add(template.id))}
                            aria-label={t.composer.suggestionDiscardAria}
                            title={t.composer.suggestionDiscardAria}
                          >
                            ✕
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Inspiration drawer */}
        {!isFreeform && inspiration.length > 0 && (
          <details
            className="sandra-inspiration"
            open={showInspiration}
            onToggle={e => setShowInspiration((e.target as HTMLDetailsElement).open)}
            data-testid="sandra-inspiration"
          >
            <summary className="friends-section-title sandra-inspiration__toggle">
              {t.composer.inspirationToggle}
            </summary>
            <p className="friends-hint">{t.composer.inspirationHint}</p>
            <ul className="sandra-inspiration__list">
              {inspiration.map((q, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm sandra-inspiration__item"
                    onClick={() => handleInspirationClick(q)}
                  >
                    {q}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}

        {/* Footer */}
        <div className="sandra-composer__footer">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onDiscard}
            data-testid="sandra-composer-discard"
          >
            {t.composer.discard}
          </button>
          {isFreeform && (
            <button
              type="button"
              className="share-cta-btn sandra-composer__add"
              onClick={handleAddFreeform}
              data-testid="sandra-composer-add"
            >
              {t.composer.addQuestion}
            </button>
          )}
        </div>
        {showEmptyError && (
          <p className="friends-hint friends-hint--warn">{t.composer.addEmptyError}</p>
        )}
      </section>
    </div>
  )
}

import type { SandraFlowStrings } from '../../locales/types'
import type { Locale } from '../../locales'
import { getPersonalQuestionTriggers } from '../../data/loadPersonalQuestions'

interface Props {
  t: SandraFlowStrings
  locale: Locale
  anrede: string
  onBack: () => void
  onPick: (triggerId: string) => void
  onPickFreeform: () => void
}

export function SandraTriggerStep({ t, locale, anrede, onBack, onPick, onPickFreeform }: Props) {
  const triggers = getPersonalQuestionTriggers(locale)
  const biography = triggers.filter(tr => tr.group === 'biography')
  const relationship = triggers.filter(tr => tr.group === 'relationship')
  const renderTitle = (title: string) => title.replace('{anrede}', anrede)

  return (
    <div className="sandra-flow-view">
      <div className="quiz-topbar">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>
          {t.back}
        </button>
      </div>

      <section className="friends-section">
        <h2 className="friends-section-title">
          {t.trigger.sectionAboutThem.replace('{anrede}', anrede)}
        </h2>
        <div className="friends-list">
          {biography.map(tr => (
            <button
              key={tr.id}
              type="button"
              className="friend-card sandra-trigger-card"
              onClick={() => onPick(tr.id)}
              data-testid={`sandra-trigger-${tr.id}`}
            >
              <span className="sandra-trigger-card__title">{renderTitle(tr.title)}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="friends-section sandra-section--accent">
        <h2 className="friends-section-title">
          <span aria-hidden="true">{t.trigger.sectionAboutUsHeart} </span>
          {t.trigger.sectionAboutUs}
        </h2>
        <p className="friends-hint">{t.trigger.sectionAboutUsHint}</p>
        <div className="friends-list">
          {relationship.map(tr => (
            <button
              key={tr.id}
              type="button"
              className="friend-card sandra-trigger-card sandra-trigger-card--accent"
              onClick={() => onPick(tr.id)}
              data-testid={`sandra-trigger-${tr.id}`}
            >
              <span className="sandra-trigger-card__title">{renderTitle(tr.title)}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="friends-share">
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={onPickFreeform}
          data-testid="sandra-trigger-freeform"
        >
          {t.trigger.typeMyOwn}
        </button>
      </div>
    </div>
  )
}

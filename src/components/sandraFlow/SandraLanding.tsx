import type { SandraFlowStrings } from '../../i18n/de/sandraFlow'

interface Props {
  t: SandraFlowStrings
  /** Fallback "Mama" until the user picks their own anrede in screen 2. */
  anrede: string
  onBack: () => void
  onStart: () => void
}

export function SandraLanding({ t, anrede, onBack, onStart }: Props) {
  const fill = (s: string) => s.replace('{anrede}', anrede)
  return (
    <div className="sandra-flow-view">
      <div className="quiz-topbar">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>
          {t.back}
        </button>
      </div>

      <section className="friends-section sandra-landing">
        <h1 className="sandra-landing__title">{fill(t.landing.title)}</h1>
        <p className="sandra-landing__subline">{t.landing.subline}</p>

        <div className="friends-share">
          <button
            type="button"
            className="share-cta-btn"
            onClick={onStart}
            data-testid="sandra-landing-cta"
          >
            {t.landing.primaryCta}
          </button>
        </div>

        <ol className="sandra-steps">
          {t.landing.steps.map((label, i) => (
            <li key={i} className="sandra-steps__item">
              <span className="sandra-steps__num">{i + 1}</span>
              <span className="sandra-steps__label">{fill(label)}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

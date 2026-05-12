import type { SandraFlowStrings } from '../../i18n/de/sandraFlow'

interface Props {
  t: SandraFlowStrings
  onBack: () => void
  onStart: () => void
}

export function SandraLanding({ t, onBack, onStart }: Props) {
  return (
    <div className="sandra-flow-view">
      <div className="quiz-topbar">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>
          {t.back}
        </button>
      </div>

      <section className="friends-section sandra-landing">
        <h1 className="sandra-landing__title">{t.landing.title}</h1>
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
              <span className="sandra-steps__label">{label}</span>
            </li>
          ))}
        </ol>

        <a
          href="#sandra-how-it-works"
          className="friends-hint sandra-landing__how"
          onClick={e => e.preventDefault()}
        >
          {t.landing.howItWorks}
        </a>
      </section>
    </div>
  )
}

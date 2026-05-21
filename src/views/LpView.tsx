import './LpView.css'

export interface LpContent {
  howId: string
  eyebrow: string
  h1: string
  heroBody: string
  ctaPrimary: string
  ctaSecondary: string
  problemH2: string
  problemBody: string[]
  howH2: string
  steps: Array<{ h3: string; body: string }>
  benefitsH2: string
  benefits: string[]
  proofH2: string
  proofBody: string
  faqH2: string
  faq: Array<{ q: string; a: string }>
  finalH2: string
  finalBody: string
  finalCta: string
}

function handleStart() {
  try { localStorage.setItem('rm-landing-seen', '1') } catch { /* noop */ }
  window.location.href = '/'
}

function IconHeart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="lp-logo-icon">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="lp-check-icon">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export function LpView({ content }: { content: LpContent }) {
  return (
    <div className="lp">

      {/* Nav */}
      <nav className="lp-nav" aria-label="Navigation">
        <div className="lp-nav__inner">
          <span className="lp-nav__logo" aria-label="Storyhold">
            <IconHeart />
            Storyhold
          </span>
          <button className="lp-cta-btn lp-cta-btn--sm" onClick={handleStart}>
            {content.ctaPrimary}
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="lp-hero">
        <div className="lp-inner">
          <span className="lp-eyebrow">{content.eyebrow}</span>
          <h1 className="lp-h1">{content.h1}</h1>
          <p className="lp-body lp-hero__body">{content.heroBody}</p>
          <div className="lp-hero__actions">
            <button className="lp-cta-btn" onClick={handleStart}>{content.ctaPrimary}</button>
            <a href={`#${content.howId}`} className="lp-btn-secondary">{content.ctaSecondary}</a>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="lp-section lp-section--surface">
        <div className="lp-inner">
          <h2 className="lp-h2">{content.problemH2}</h2>
          {content.problemBody.map((p, i) => <p key={i} className="lp-body">{p}</p>)}
        </div>
      </section>

      {/* How it works */}
      <section id={content.howId} className="lp-section">
        <div className="lp-inner">
          <h2 className="lp-h2">{content.howH2}</h2>
          <div className="lp-steps">
            {content.steps.map((step, i) => (
              <div key={i} className="lp-step">
                <span className="lp-step__num" aria-hidden="true">{i + 1}</span>
                <div className="lp-step__content">
                  <h3 className="lp-h3">{step.h3}</h3>
                  <p className="lp-body">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="lp-section lp-section--surface">
        <div className="lp-inner">
          <h2 className="lp-h2">{content.benefitsH2}</h2>
          <ul className="lp-benefits" role="list">
            {content.benefits.map((b, i) => (
              <li key={i} className="lp-benefit">
                <IconCheck />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Emotional proof */}
      <section className="lp-section lp-proof">
        <div className="lp-inner lp-proof__inner">
          <h2 className="lp-h2">{content.proofH2}</h2>
          <p className="lp-body">{content.proofBody}</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="lp-section lp-section--surface">
        <div className="lp-inner">
          <h2 className="lp-h2">{content.faqH2}</h2>
          <div className="lp-faq">
            {content.faq.map((item, i) => (
              <details key={i} className="lp-faq__item">
                <summary className="lp-faq__q">{item.q}</summary>
                <p className="lp-faq__a">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section id="cta" className="lp-section lp-final-cta">
        <div className="lp-inner">
          <h2 className="lp-h2">{content.finalH2}</h2>
          <p className="lp-body">{content.finalBody}</p>
          <button className="lp-cta-btn" onClick={handleStart}>{content.finalCta}</button>
        </div>
      </section>

    </div>
  )
}

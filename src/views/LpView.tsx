import { useState } from 'react'
import './LandingView.css'
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
  benefits: Array<{ title: string; desc: string }>
  proofH2: string
  proofBody: string
  faqH2: string
  faq: Array<{ q: string; a: string }>
  finalH2: string
  finalBody: string
  finalCta: string
  heroImg?: string
  ctaImg?: string
}

function handleStart() {
  try { localStorage.setItem('rm-landing-seen', '1') } catch { /* noop */ }
  window.location.href = '/'
}

// ─── Icons (same as LandingView) ──────────────────────────────────────────────

function IconHeart() {
  return (
    <svg className="landing-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function IconMessageCircle() {
  return (
    <svg className="landing-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function IconMic() {
  return (
    <svg className="landing-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

function IconShield() {
  return (
    <svg className="landing-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function IconStar() {
  return (
    <svg className="landing-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

const HOW_ICONS = [IconMessageCircle, IconMic, IconShield]
const WHY_ICONS = [IconHeart, IconStar, IconShield, IconMic]

function LpImage({ src, alt, aspectRatio }: { src: string; alt: string; aspectRatio: string }) {
  const [error, setError] = useState(false)
  return (
    <div className="landing-img-wrap" style={{ aspectRatio }}>
      {!error ? (
        <img src={src} alt={alt} className="landing-img" onError={() => setError(true)} loading="lazy" />
      ) : (
        <div className="landing-img-ph" role="img" aria-label={alt} />
      )}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LpView({ content }: { content: LpContent }) {
  const heroImg = content.heroImg ?? '/landing/hero.jpg'
  const ctaImg  = content.ctaImg  ?? '/landing/ABCAFE7B-04E2-4983-BD37-4854F197834E.png'

  return (
    <div className="landing-view">

      {/* ── Nav ── */}
      <nav className="landing-nav" aria-label="Navigation">
        <div className="landing-nav__inner">
          <div className="landing-nav__logo" aria-label="Storyhold">
            <IconHeart />
            <span>Storyhold</span>
          </div>
          <button className="landing-nav__cta" onClick={handleStart}>
            {content.ctaPrimary}
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="landing-hero">
        <div className="landing-hero__content">
          <p className="landing-hero__eyebrow">{content.eyebrow}</p>
          <h1 className="landing-hero__headline">{content.h1}</h1>
          <p className="landing-hero__body">{content.heroBody}</p>
          <div className="landing-hero__actions">
            <button className="landing-cta-btn" onClick={handleStart}>
              {content.ctaPrimary}
            </button>
            <a href={`#${content.howId}`} className="landing-btn-secondary">
              {content.ctaSecondary}
            </a>
          </div>
        </div>
        <div className="landing-hero__media">
          <LpImage src={heroImg} alt="Familie bewahrt gemeinsam Erinnerungen" aspectRatio="3/4" />
        </div>
      </section>

      {/* ── Problem ── */}
      <section className="lp-problem">
        <div className="landing-inner">
          <h2 className="landing-section-title">{content.problemH2}</h2>
          {content.problemBody.map((p, i) => (
            <p key={i} className="lp-problem__body">{p}</p>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section id={content.howId} className="landing-how">
        <div className="landing-inner">
          <h2 className="landing-section-title">{content.howH2}</h2>
          <div className="landing-how__steps">
            {content.steps.map((step, i) => {
              const Icon = HOW_ICONS[i] ?? IconStar
              return (
                <div key={i} className="landing-how-step">
                  <div className="landing-how-step__header">
                    <span className="landing-how-step__num">{i + 1}</span>
                    <Icon />
                  </div>
                  <strong>{step.h3}</strong>
                  <p>{step.body}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Benefits / Why ── */}
      <section className="landing-why">
        <div className="landing-inner">
          <h2 className="landing-section-title">{content.benefitsH2}</h2>
          <div className="landing-why__grid">
            {content.benefits.map((item, i) => {
              const Icon = WHY_ICONS[i] ?? IconStar
              return (
                <div key={i} className="landing-why-card">
                  <Icon />
                  <strong>{item.title}</strong>
                  <p>{item.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Emotional proof ── */}
      <section className="landing-quote">
        <div className="landing-inner landing-quote__inner">
          <div className="landing-quote__text">
            <div className="landing-quote__icon-wrap"><IconHeart /></div>
            <blockquote className="landing-quote__blockquote">{content.proofH2}</blockquote>
            <p className="landing-quote__attr">{content.proofBody}</p>
          </div>
          <div className="landing-quote__media">
            <LpImage src="/landing/quote.jpg" alt="Familie" aspectRatio="4/5" />
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="lp-faq-section">
        <div className="landing-inner">
          <h2 className="landing-section-title">{content.faqH2}</h2>
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

      {/* ── Final CTA ── */}
      <section className="landing-final-cta">
        <div className="landing-inner landing-final-cta__inner">
          <div className="landing-final-cta__media">
            <LpImage src={ctaImg} alt="Familienerinnerungen" aspectRatio="4/3" />
          </div>
          <div className="landing-final-cta__content">
            <h2>{content.finalH2}</h2>
            <p>{content.finalBody}</p>
            <button className="landing-cta-btn" onClick={handleStart}>
              {content.finalCta}
            </button>
          </div>
        </div>
      </section>

    </div>
  )
}

import { useRef, useState } from 'react'
import { useTranslation } from '../locales'
import './LandingView.css'

interface Props {
  onStart: () => void
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function IconHeart() {
  return (
    <svg
      className="landing-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function IconClock() {
  return (
    <svg className="landing-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function IconLeaf() {
  return (
    <svg className="landing-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 8C8 10 5.9 16.17 3.82 22" />
      <path d="M3.82 22A10 10 0 0 1 17 8" />
    </svg>
  )
}

function IconUsers() {
  return (
    <svg className="landing-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function IconStar() {
  return (
    <svg className="landing-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

function IconLock() {
  return (
    <svg className="landing-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function IconMessageCircle() {
  return (
    <svg className="landing-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function IconMic() {
  return (
    <svg className="landing-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

function IconShield() {
  return (
    <svg className="landing-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function IconCloud() {
  return (
    <svg className="landing-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  )
}

function IconBlock() {
  return (
    <svg className="landing-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  )
}

function IconPhone() {
  return (
    <svg className="landing-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  )
}

// ─── Icon maps ────────────────────────────────────────────────────────────────

const CATEGORY_ICONS = [IconClock, IconHeart, IconLeaf, IconUsers, IconStar]
const WHY_ICONS = [IconUsers, IconHeart, IconLock, IconStar]
const HOW_ICONS = [IconMessageCircle, IconMic, IconShield]
const FEATURE_ICONS = [IconShield, IconCloud, IconUsers, IconBlock, IconHeart, IconPhone]

// ─── Image component ──────────────────────────────────────────────────────────

function LandingImage({ src, alt, aspectRatio }: { src: string; alt: string; aspectRatio: string }) {
  const [error, setError] = useState(false)
  return (
    <div className="landing-img-wrap" style={{ aspectRatio }}>
      {!error ? (
        <img
          src={src}
          alt={alt}
          className="landing-img"
          onError={() => setError(true)}
          loading="lazy"
        />
      ) : (
        <div className="landing-img-ph" role="img" aria-label={alt} />
      )}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LandingView({ onStart }: Props) {
  const { t } = useTranslation()
  const l = t.landing
  const questionsRef = useRef<HTMLElement>(null)

  function scrollToQuestions() {
    questionsRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="landing-view">

      {/* ── Nav ── */}
      <nav className="landing-nav" aria-label="Main navigation">
        <div className="landing-nav__inner">
          <div className="landing-nav__logo" aria-label="Storyhold">
            <IconHeart />
            <span>Storyhold</span>
          </div>
          <ul className="landing-nav__links" aria-label="Navigation links">
            <li><a href="#features">{l.nav.features}</a></li>
            <li><a href="#questions">{l.nav.questions}</a></li>
            <li><a href="#about">{l.nav.aboutUs}</a></li>
            <li><a href="#privacy">{l.nav.privacy}</a></li>
          </ul>
          <button className="landing-nav__cta" onClick={onStart}>
            {l.nav.openApp}
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="landing-hero">
        <div className="landing-hero__content">
          <p className="landing-hero__eyebrow">{l.hero.eyebrow}</p>
          <h1 className="landing-hero__headline">{l.hero.headline}</h1>
          <p className="landing-hero__subtext">{l.hero.subtext}</p>
          <p className="landing-hero__body">{l.hero.body}</p>
          <div className="landing-hero__actions">
            <button className="landing-cta-btn" onClick={onStart}>
              {l.hero.ctaPrimary}
            </button>
            <button className="landing-btn-secondary" onClick={scrollToQuestions}>
              {l.hero.ctaSecondary}
            </button>
          </div>
        </div>
        <div className="landing-hero__media">
          <LandingImage src="/landing/hero.jpg" alt={l.hero.imgAlt} aspectRatio="3/4" />
        </div>
      </section>

      {/* ── Questions ── */}
      <section className="landing-questions" ref={questionsRef} id="questions">
        <div className="landing-inner">
          <h2 className="landing-section-title">{l.questionsSection.title}</h2>
          <div className="landing-questions__grid">
            {l.questionsSection.categories.map((cat, i) => {
              const Icon = CATEGORY_ICONS[i] ?? IconStar
              return (
                <div key={cat.label} className="landing-q-item">
                  <div className="landing-q-item__icon">
                    <Icon />
                  </div>
                  <strong>{cat.label}</strong>
                  <p>{cat.question}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Quote ── */}
      <section className="landing-quote">
        <div className="landing-inner landing-quote__inner">
          <div className="landing-quote__text">
            <div className="landing-quote__icon-wrap">
              <IconHeart />
            </div>
            <blockquote className="landing-quote__blockquote">{l.quote.text}</blockquote>
            <p className="landing-quote__attr">{l.quote.attribution}</p>
          </div>
          <div className="landing-quote__media">
            <LandingImage src="/landing/quote.jpg" alt={l.quote.imgAlt} aspectRatio="4/5" />
          </div>
        </div>
      </section>

      {/* ── Why ── */}
      <section className="landing-why" id="features">
        <div className="landing-inner">
          <h2 className="landing-section-title">{l.why.title}</h2>
          <div className="landing-why__grid">
            {l.why.items.map((item, i) => {
              const Icon = WHY_ICONS[i] ?? IconStar
              return (
                <div key={item.title} className="landing-why-card">
                  <Icon />
                  <strong>{item.title}</strong>
                  <p>{item.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Legacy ── */}
      <section className="landing-legacy">
        <div className="landing-inner landing-legacy__inner">
          <div className="landing-legacy__media">
            <LandingImage src="/landing/legacy.jpg" alt={l.legacy.imgAlt} aspectRatio="4/3" />
          </div>
          <div className="landing-legacy__content">
            <h2>{l.legacy.title}</h2>
            <p>{l.legacy.desc}</p>
            <button className="landing-cta-btn landing-cta-btn--dark" onClick={onStart}>
              {l.legacy.cta}
            </button>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="landing-how">
        <div className="landing-inner">
          <h2 className="landing-section-title">{l.howItWorks.title}</h2>
          <div className="landing-how__steps">
            {l.howItWorks.steps.map((step, i) => {
              const Icon = HOW_ICONS[i] ?? IconStar
              return (
                <div key={step.label} className="landing-how-step">
                  <div className="landing-how-step__header">
                    <span className="landing-how-step__num">{i + 1}</span>
                    <Icon />
                  </div>
                  <strong>{step.label}</strong>
                  <p>{step.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Feature bar ── */}
      <div className="landing-features-bar">
        <div className="landing-inner landing-features-bar__grid">
          {l.features.map((f, i) => {
            const Icon = FEATURE_ICONS[i] ?? IconStar
            return (
              <div key={f.label} className="landing-feature-item">
                <Icon />
                <strong>{f.label}</strong>
                <span>{f.desc}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Final CTA ── */}
      <section className="landing-final-cta">
        <div className="landing-inner landing-final-cta__inner">
          <div className="landing-final-cta__media">
            <LandingImage src="/landing/ABCAFE7B-04E2-4983-BD37-4854F197834E.png" alt={l.finalCta.imgAlt} aspectRatio="4/3" />
          </div>
          <div className="landing-final-cta__content">
            <h2>{l.finalCta.headline}</h2>
            <p>{l.finalCta.subtext}</p>
            <button className="landing-cta-btn" onClick={onStart}>
              {l.finalCta.cta}
            </button>
            <p className="landing-final-cta__social">
              <span className="landing-final-cta__social-icon"><IconHeart /></span>
              {l.finalCta.socialProof}
            </p>
          </div>
        </div>
      </section>

    </div>
  )
}

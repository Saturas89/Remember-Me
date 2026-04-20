import { useState, useEffect } from 'react'
import { useTranslation } from '../locales'

type FeatureItem = { id: string; title: string; subtitle: string; img: string; description: string; status: string }

function featureFromPath(features: readonly FeatureItem[]): FeatureItem | null {
  const id = window.location.pathname.split('/')[2]
  return features.find(f => f.id === id) ?? null
}

// ── Detail page ────────────────────────────────────────

interface DetailProps {
  feature: FeatureItem
  onBack: () => void
}

function FeatureDetailPage({ feature, onBack }: DetailProps) {
  const { t } = useTranslation()
  return (
    <div className="feature-detail">
      <div className="feature-detail__topbar">
        <button className="btn btn--ghost btn--sm" onClick={onBack} type="button">
          {t.feature.back}
        </button>
        <span className="feature-detail__topbar-label">{t.feature.futureFeatureLabel}</span>
      </div>

      <div className="feature-detail__hero">
        <img
          src={feature.img}
          alt={feature.title}
          className="feature-detail__hero-img"
        />
        <div className="feature-detail__hero-overlay">
          <span className="feature-detail__status-badge">{feature.status}</span>
        </div>
      </div>

      <div className="feature-detail__content">
        <div>
          <h1 className="feature-detail__title">{feature.title}</h1>
          <p className="feature-detail__subtitle">{feature.subtitle}</p>
        </div>

        <div className="feature-detail__coming-soon">
          <span className="feature-detail__coming-icon" aria-hidden="true">🚀</span>
          <div>
            <strong>{t.feature.comingSoonTitle}</strong>
            <p>{t.feature.comingSoonDesc}</p>
          </div>
        </div>

        <p className="feature-detail__desc">{feature.description}</p>

        <p className="feature-detail__note">{t.feature.feedbackNote}</p>
      </div>
    </div>
  )
}

// ── Main Feature view ──────────────────────────────────

export function FeatureView() {
  const { t } = useTranslation()
  const features = t.feature.features
  const [active, setActive] = useState<FeatureItem | null>(() => featureFromPath(features))

  useEffect(() => {
    const onPopstate = () => setActive(featureFromPath(features))
    window.addEventListener('popstate', onPopstate)
    return () => window.removeEventListener('popstate', onPopstate)
  }, [features])

  function handleOpen(feature: FeatureItem) {
    history.pushState({}, '', `/feature/${feature.id}`)
    setActive(feature)
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }

  function handleBack() {
    history.pushState({}, '', '/feature')
    setActive(null)
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }

  if (active) {
    return (
      <FeatureDetailPage
        feature={active}
        onBack={handleBack}
      />
    )
  }

  return (
    <div className="feature-view">
      <div className="feature-view__header">
        <h1 className="feature-view__title">✨ {t.feature.listTitle}</h1>
        <div className="feature-view__intro-box">
          <p className="feature-view__intro">{t.feature.listIntro}</p>
          <p className="feature-view__intro feature-view__intro--note">{t.feature.listNote}</p>
        </div>
      </div>

      <div className="feature-view__list">
        {features.map(feature => (
          <button
            key={feature.id}
            className="feature-img-btn"
            onClick={() => handleOpen(feature)}
            type="button"
            aria-label={feature.title}
          >
            <img
              src={feature.img}
              alt={feature.title}
              className="feature-img-btn__img"
            />
          </button>
        ))}
      </div>
    </div>
  )
}

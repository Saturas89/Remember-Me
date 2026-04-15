import { useState } from 'react'
import { track } from '@vercel/analytics'

// ── Feature definitions ────────────────────────────────

const FEATURES = [
  {
    id: 'automatische-lebensgeschichte',
    title: 'Automatische Lebensgeschichte',
    subtitle: 'Ein Buch für deine Lieben',
    img: '/features/automatische-lebensgeschichte.jpg',
    description:
      'Erstellen Sie mühelos ein fesselndes Buch über Ihr Leben. Unsere KI hilft Ihnen, Ihre kostbarsten Momente und Meilensteine in einer wunderschönen Erzählung festzuhalten, die Sie mit Ihren Lieben teilen können.',
    status: 'Geplant',
  },
  {
    id: 'lebenszeitlinie',
    title: 'Lebenszeitlinie',
    subtitle: 'Erlebe dein Leben visuell',
    img: '/features/lebenszeitlinie.jpg',
    description:
      'Entdecken Sie Ihre Vergangenheit neu auf einer visuellen Reise. Verknüpfen Sie Fotos, Tickets und Erinnerungen chronologisch und teilen Sie Ihre gemeinsame Geschichte.',
    status: 'In Planung',
  },
  {
    id: 'privater-sync',
    title: 'Privater Sync',
    subtitle: 'Sicher & Verschlüsselt',
    img: '/features/privater-sync.jpg',
    description:
      'Ihre Daten sind sicher. Synchronisieren Sie Ihre Erinnerungen und Fotos nahtlos und privat zwischen all Ihren Geräten, geschützt durch starke Verschlüsselung.',
    status: 'In Entwicklung',
  },
  {
    id: 'familienmodus',
    title: 'Familienmodus',
    subtitle: 'Erinnerungen gemeinsam sammeln',
    img: '/features/familienmodus.jpg',
    description:
      'Erleben Sie gemeinsame Momente aus allen Blickwinkeln. Jedes Familienmitglied kann seine eigenen Geschichten und Fotos beitragen und so das Familienalbum bereichern.',
    status: 'Geplant',
  },
  {
    id: 'import-erinnerungen',
    title: 'Import bestehender Erinnerungen',
    subtitle: 'Alles an einem Ort',
    img: '/features/import-erinnerungen.jpg',
    description:
      'Führen Sie Ihre verstreuten Fotos zusammen. Importieren Sie mühelos Erinnerungen aus sozialen Netzwerken, E-Mails, Clouds und lokalen Ordnern in Ihre persönliche Lebensgeschichte.',
    status: 'In Planung',
  },
] as const

type FeatureId = typeof FEATURES[number]['id']

// ── localStorage tracking ──────────────────────────────

const STORAGE_PREFIX = 'feature-interest-'

function getCount(id: FeatureId): number {
  try {
    return parseInt(localStorage.getItem(STORAGE_PREFIX + id) ?? '0', 10) || 0
  } catch {
    return 0
  }
}

function incrementCount(id: FeatureId): number {
  try {
    const next = getCount(id) + 1
    localStorage.setItem(STORAGE_PREFIX + id, String(next))
    return next
  } catch {
    return 1
  }
}

// ── Detail page ────────────────────────────────────────

interface DetailProps {
  feature: typeof FEATURES[number]
  count: number
  onBack: () => void
}

function FeatureDetailPage({ feature, count, onBack }: DetailProps) {
  return (
    <div className="feature-detail">
      <div className="feature-detail__topbar">
        <button className="btn btn--ghost btn--sm" onClick={onBack} type="button">
          ← Zurück
        </button>
        <span className="feature-detail__topbar-label">Zukunfts-Feature</span>
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
            <strong>Noch nicht verfügbar</strong>
            <p>Dieses Feature ist in Planung – wir arbeiten bereits daran!</p>
          </div>
        </div>

        <p className="feature-detail__desc">{feature.description}</p>

        <div className="feature-detail__interest-box">
          <div className="feature-detail__interest-header">
            <span className="feature-detail__interest-heart" aria-hidden="true">❤️</span>
            <strong className="feature-detail__interest-count">
              {count} {count === 1 ? 'Person' : 'Personen'} interessiert
            </strong>
          </div>
          <p className="feature-detail__interest-text">
            Dein Interesse wurde vermerkt – vielen Dank! Da Remember Me vollständig
            offline arbeitet, ist das Antippen der Features unsere einzige Möglichkeit
            zu erfahren, was euch besonders am Herzen liegt. Je mehr Interesse wir
            sehen, desto schneller setzen wir es um.
          </p>
        </div>

        <p className="feature-detail__note">
          Hast du Ideen oder Wünsche zu diesem Feature? Schreib uns unter{' '}
          <strong>remember-me.app</strong> – wir freuen uns auf dein Feedback! 🙏
        </p>
      </div>
    </div>
  )
}

// ── Main Feature view ──────────────────────────────────

export function FeatureView() {
  const [active, setActive] = useState<{ feature: typeof FEATURES[number]; count: number } | null>(null)

  function handleOpen(feature: typeof FEATURES[number]) {
    // Server-side tracking via Vercel Analytics – sichtbar im Vercel Dashboard
    track('feature_interest', { feature: feature.id, title: feature.title })
    // Lokaler Fallback-Zähler (für den Offline-Betrieb)
    const count = incrementCount(feature.id)
    setActive({ feature, count })
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }

  if (active) {
    return (
      <FeatureDetailPage
        feature={active.feature}
        count={active.count}
        onBack={() => setActive(null)}
      />
    )
  }

  return (
    <div className="feature-view">
      <div className="feature-view__header">
        <h1 className="feature-view__title">✨ Was kommt als Nächstes?</h1>
        <div className="feature-view__intro-box">
          <p className="feature-view__intro">
            Hier siehst du die Features, die wir für Remember Me planen.{' '}
            <strong>Tippe auf ein Feature, das dich begeistert</strong> – so erfahren
            wir, was dir wichtig ist!
          </p>
          <p className="feature-view__intro feature-view__intro--note">
            Da Remember Me vollständig offline funktioniert, ist dein Antippen
            unsere einzige Möglichkeit, dein Interesse zu messen. Jeder Klick zählt!
          </p>
        </div>
      </div>

      <div className="feature-view__list">
        {FEATURES.map(feature => (
          <button
            key={feature.id}
            className="feature-img-btn"
            onClick={() => handleOpen(feature)}
            type="button"
            aria-label={`${feature.title} – Interesse zeigen`}
          >
            <img
              src={feature.img}
              alt={feature.title}
              className="feature-img-btn__img"
            />
          </button>
        ))}
      </div>

      <p className="feature-view__footer">
        Deine Stimme zählt – auch offline! 🙏
      </p>
    </div>
  )
}

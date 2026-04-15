import { useState } from 'react'

// ── Feature definitions ────────────────────────────────

const FEATURES = [
  {
    id: 'ki-biografie',
    title: 'KI-Biografie',
    subtitle: 'Ein Buch für deine Kinder',
    emoji: '📖',
    bgClass: 'feature-card__img--biografie',
    description:
      'Stell dir vor: Deine Lebensgeschichte, liebevoll aufbereitet als echtes Buch. Eine KI liest deine Erinnerungen, ordnet sie nach Kapiteln und schreibt eine Biografie – gestaltet für deine Kinder und Enkelkinder, damit deine Stimme noch Generationen klingt.',
    status: 'Geplant',
  },
  {
    id: 'lebenszeitlinie',
    title: 'Lebenszeitlinie',
    subtitle: 'Erlebe dein Leben visuell',
    emoji: '🗺️',
    bgClass: 'feature-card__img--zeitlinie',
    description:
      'Sieh dein Leben auf einer interaktiven Zeitlinie. Von der Kindheit bis heute – alle Erinnerungen schön angeordnet, mit Fotos, Aufnahmen und Geschichten hinterlegt. Ein Blick genügt, um dein ganzes Leben zu überblicken.',
    status: 'In Planung',
  },
  {
    id: 'privater-sync',
    title: 'Privater Sync',
    subtitle: 'Sicher & Verschlüsselt',
    emoji: '🔐',
    bgClass: 'feature-card__img--sync',
    description:
      'Deine Erinnerungen auf all deinen Geräten – sicher Ende-zu-Ende verschlüsselt. Kein Server kann deine Daten lesen. Nur du hast den Schlüssel. Remember Me bleibt privat, egal auf welchem Gerät du bist.',
    status: 'In Entwicklung',
  },
  {
    id: 'familienmodus',
    title: 'Familienmodus',
    subtitle: 'Erinnerungen gemeinsam sammeln',
    emoji: '👨‍👩‍👧‍👦',
    bgClass: 'feature-card__img--familie',
    description:
      'Sammle Erinnerungen gemeinsam mit der ganzen Familie. Kinder, Eltern, Geschwister – alle können beitragen und kommentieren. Ein gemeinsames Gedächtnis, das die Familie verbindet und für immer erhält.',
    status: 'Geplant',
  },
  {
    id: 'import-erinnerungen',
    title: 'Import bestehender Erinnerungen',
    subtitle: 'Alles an einem Ort',
    emoji: '📲',
    bgClass: 'feature-card__img--import',
    description:
      'Hol deine Erinnerungen aus allen Quellen: Facebook, WhatsApp, alte Fotos, digitale Tagebücher. Alles wird zusammengeführt – deine komplette Lebensgeschichte, endlich an einem einzigen Ort.',
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

      <div className={`feature-detail__hero ${feature.bgClass}`}>
        <span className="feature-detail__hero-emoji" aria-hidden="true">
          {feature.emoji}
        </span>
        <h1 className="feature-detail__title">{feature.title}</h1>
        <p className="feature-detail__subtitle">{feature.subtitle}</p>
        <span className="feature-detail__status-badge">{feature.status}</span>
      </div>

      <div className="feature-detail__content">
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

      <div className="feature-view__grid">
        {FEATURES.map(feature => (
          <button
            key={feature.id}
            className="feature-card"
            onClick={() => handleOpen(feature)}
            type="button"
            aria-label={`${feature.title}: ${feature.subtitle} – Interesse zeigen`}
          >
            <div className={`feature-card__img ${feature.bgClass}`}>
              <span className="feature-card__emoji" aria-hidden="true">
                {feature.emoji}
              </span>
              <span className="feature-card__coming" aria-hidden="true">Bald verfügbar</span>
            </div>
            <div className="feature-card__body">
              <p className="feature-card__label">{feature.title}</p>
              <p className="feature-card__sub">{feature.subtitle}</p>
              <span className="feature-card__status">{feature.status}</span>
            </div>
          </button>
        ))}
      </div>

      <p className="feature-view__footer">
        Deine Stimme zählt – auch offline! 🙏
      </p>
    </div>
  )
}

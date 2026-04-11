import { useState } from 'react'
import { HeroLogo } from '../components/Logo'
import { useTheme } from '../hooks/useTheme'
import { ThemeSwitcher } from '../components/ThemeSwitcher'
import type { Profile } from '../types'

interface Props {
  onComplete: (profile: Profile) => void
}

const FEATURES = [
  { icon: '🔒', title: 'Privat', desc: 'Keine Anmeldung, keine Cloud' },
  { icon: '📴', title: 'Offline', desc: 'Funktioniert ohne Internet' },
  { icon: '❤️', title: 'Für immer', desc: 'Für Familie & Nachwelt' },
]

export function OnboardingView({ onComplete }: Props) {
  const { theme, setTheme } = useTheme()
  const [name, setName] = useState('')

  function handleStart() {
    const trimmed = name.trim()
    if (!trimmed) return
    onComplete({
      name: trimmed,
      createdAt: new Date().toISOString(),
    })
  }

  return (
    <div className="onboarding">
      {/* Theme switcher top-right */}
      <div className="onboarding__topbar">
        <ThemeSwitcher current={theme} onChange={setTheme} />
      </div>

      {/* Hero */}
      <div className="onboarding__hero">
        <HeroLogo />
        <p className="onboarding__tagline">
          Deine Geschichte verdient es,<br />erzählt zu werden.
        </p>
      </div>

      {/* Story text */}
      <div className="onboarding__story">
        <p>
          Viele Erinnerungen verblassen. Fragen, die du deinen Großeltern nie gestellt hast.
          Momente, die niemand aufgeschrieben hat.
        </p>
        <p>
          <strong>Remember Me</strong> führt dich mit gezielten Fragen durch dein Leben –
          damit die Menschen, die dir wichtig sind, dich wirklich kennen.
        </p>
      </div>

      {/* Feature pills */}
      <div className="onboarding__features">
        {FEATURES.map((f, i) => (
          <div key={f.title} className="onboarding__feature" style={{ animationDelay: `${0.1 + i * 0.1}s` }}>
            <span className="onboarding__feature-icon">{f.icon}</span>
            <span className="onboarding__feature-title">{f.title}</span>
            <span className="onboarding__feature-desc">{f.desc}</span>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="onboarding__divider" />

      {/* Name input */}
      <div className="onboarding__form">
        <label className="onboarding__label" htmlFor="onboarding-name">
          Wie heißt du?
        </label>
        <p className="onboarding__label-hint">
          Dein Name personalisiert die Einladungen für Freunde und Familie.
        </p>
        <input
          id="onboarding-name"
          className="input-text onboarding__input"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleStart()}
          placeholder="Dein Name..."
          autoFocus
          autoComplete="given-name"
        />
        <button
          className="btn btn--primary onboarding__cta"
          onClick={handleStart}
          disabled={!name.trim()}
        >
          Loslegen →
        </button>
      </div>

      {/* Footer note */}
      <p className="onboarding__footer">
        Kostenlos · Keine Anmeldung nötig · Deine Daten bleiben auf deinem Gerät
      </p>
    </div>
  )
}

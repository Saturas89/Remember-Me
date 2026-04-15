import './Logo.css'

// ── Theme gradient map ────────────────────────────────
const GRADIENTS: Record<string, [string, string]> = {
  nacht: ['#f72585', '#7b2d8b'],
  ozean: ['#56b4f5', '#2e6fd8'],
  hell:  ['#ff8c00', '#e8365f'],
  sepia: ['#f9a825', '#e64a19'],
}
const DEFAULT_GRAD: [string, string] = ['#f72585', '#7b2d8b']

function AppLogo({ size }: { size: number }) {
  return (
    <img
      src="/logo.jpeg"
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        display: 'block',
        borderRadius: '50%',
      }}
      aria-hidden="true"
      alt=""
    />
  )
}

// ── HeroLogo – large centred version for HomeView / Onboarding ──
export function HeroLogo() {
  return (
    <div className="hero-logo" aria-label="Remember Me">
      <div className="hero-logo__heart-wrap" style={{
        width: 160, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem'
      }}>
        <AppLogo size={140} />
      </div>
      <p className="hero-logo__tagline">Erzähl deine Geschichte</p>
      <p className="hero-logo__name">
        <span className="hero-logo__name-remember">Remember</span>
        <span className="hero-logo__name-me">Me</span>
      </p>
    </div>
  )
}

// ── Compact Logo – for headers etc. ──
interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
}

const SIZE_PX: Record<string, number> = { sm: 36, md: 48, lg: 64 }

export function Logo({ size = 'md' }: LogoProps) {
  const px = SIZE_PX[size]
  return (
    <div className={`logo logo--${size}`} aria-label="Remember Me">
      <AppLogo size={px} />
      <div className="logo__wordmark">
        <span className="logo__tagline">Erzähl deine Geschichte</span>
        <span className="logo__name">
          <span className="logo__name-grad">Remember</span>
          <span className="logo__name-grad">Me</span>
        </span>
      </div>
    </div>
  )
}

// ── Standalone icon (no text) – for tiny usages ──
export function LogoIcon({ size = 32 }: { size?: number }) {
  return <AppLogo size={size} />
}

// ── Static gradient helper (used outside React, e.g. favicon colours) ──
export function getLogoGradient(themeId: string): [string, string] {
  return GRADIENTS[themeId] ?? DEFAULT_GRAD
}

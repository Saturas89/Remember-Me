import { useId } from 'react'

// ── Theme gradient map ────────────────────────────────
// Each theme maps to one of the 6 design variants in the brand sheet:
//   nacht  → hot-pink → violet   (variant 1)
//   ozean  → sky-blue → deep-blue (variant 2)
//   hell   → orange   → coral-red (variant 3)
//   sepia  → amber    → orange    (variant 5)
const GRADIENTS: Record<string, [string, string]> = {
  nacht: ['#f72585', '#7b2d8b'],
  ozean: ['#56b4f5', '#2e6fd8'],
  hell:  ['#ff8c00', '#e8365f'],
  sepia: ['#f9a825', '#e64a19'],
}
const DEFAULT_GRAD: [string, string] = ['#f72585', '#7b2d8b']

// ── Shared heart + figure + sparkles SVG ─────────────
// Works as inline SVG so the gradient picks up CSS-variable colours.
// Each instance gets a unique gradient ID to avoid conflicts.
function HeartFigure({ gradId, size }: { gradId: string; size: number }) {
  // We resolve the theme colours via CSS variables set on <html data-theme=...>
  // stop-color supports CSS custom properties in all modern browsers.
  return (
    <svg
      viewBox="0 0 48 44"
      width={size}
      height={size * (44 / 48)}
      aria-hidden="true"
      overflow="visible"
    >
      <defs>
        <linearGradient id={gradId} x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%"   stopColor="var(--logo-start)" />
          <stop offset="100%" stopColor="var(--logo-end)"   />
        </linearGradient>
      </defs>

      {/* ── Heart ── */}
      <path
        d="M24 41C24 41 2 27 2 13.5A11.5 11.5 0 0 1 24 6.1 11.5 11.5 0 0 1 46 13.5C46 27 24 41 24 41Z"
        fill={`url(#${gradId})`}
      />

      {/* ── Sparkles (4-pointed stars) ── */}
      {/* Large – top right */}
      <path d="M34,8 L34.55,9.45 L36,10 L34.55,10.55 L34,12 L33.45,10.55 L32,10 L33.45,9.45 Z" fill="white" />
      {/* Medium – top left */}
      <path d="M13,11 L13.4,12.1 L14.5,12.5 L13.4,12.9 L13,14 L12.6,12.9 L11.5,12.5 L12.6,12.1 Z" fill="white" opacity="0.85" />
      {/* Tiny – upper centre-right */}
      <path d="M30,7 L30.25,7.75 L31,8 L30.25,8.25 L30,9 L29.75,8.25 L29,8 L29.75,7.75 Z" fill="white" opacity="0.7" />

      {/* ── Person – head ── */}
      <circle cx="24" cy="14.5" r="3" fill="white" />

      {/* ── Open book (two curved pages) ── */}
      {/* Left page */}
      <path d="M24,22 C22,21.5 15,22 11,26 L11,30 C15,31 21,31.5 24,32 Z" fill="white" />
      {/* Right page */}
      <path d="M24,22 C26,21.5 33,22 37,26 L37,30 C33,31 27,31.5 24,32 Z" fill="white" />
      {/* Spine shadow */}
      <line x1="24" y1="22" x2="24" y2="32" stroke="rgba(0,0,0,0.1)" strokeWidth="0.6" />

      {/* ── Small shoulder/body connector ── */}
      <path d="M21.5,17.5 C21.5,19.5 22.5,21.5 24,22 C25.5,21.5 26.5,19.5 26.5,17.5 Z" fill="white" />
    </svg>
  )
}

// ── HeroLogo – large centred version for HomeView / Onboarding ──
export function HeroLogo() {
  const id = useId().replace(/:/g, '')
  return (
    <div className="hero-logo" aria-label="Remember Me">
      <div className="hero-logo__heart-wrap">
        <HeartFigure gradId={`hg-${id}`} size={96} />
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

const SIZE_PX: Record<string, number> = { sm: 26, md: 38, lg: 52 }

export function Logo({ size = 'md' }: LogoProps) {
  const id = useId().replace(/:/g, '')
  const px = SIZE_PX[size]
  return (
    <div className={`logo logo--${size}`} aria-label="Remember Me">
      <HeartFigure gradId={`lg-${id}`} size={px} />
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
  const id = useId().replace(/:/g, '')
  return <HeartFigure gradId={`li-${id}`} size={size} />
}

// ── Static gradient helper (used outside React, e.g. favicon colours) ──
export function getLogoGradient(themeId: string): [string, string] {
  return GRADIENTS[themeId] ?? DEFAULT_GRAD
}

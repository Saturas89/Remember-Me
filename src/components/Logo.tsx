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
  // We use CSS masking with the generated logo mask to apply the theme gradient
  // The gradient is controlled via CSS variables from the theme
  return (
    <div
      className="app-logo-mask"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(to bottom, var(--logo-start), var(--logo-end))`,
        WebkitMaskImage: `url('/logo-mask.png')`,
        maskImage: `url('/logo-mask.png')`,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
      aria-hidden="true"
    />
  )
}

// ── AppIconLogo – for matching the actual App icon style ──
function AppIconLogo({ size }: { size: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="appIconBg" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#1e2647" />
          <stop offset="100%" stopColor="#0c1120" />
        </linearGradient>

        <radialGradient id="appIconGlow" cx="50%" cy="48%" r="42%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="512" height="512" rx="112" fill="url(#appIconBg)" />
      <ellipse cx="256" cy="238" rx="210" ry="168" fill="url(#appIconGlow)" />

      <g transform="translate(76, 87) scale(7.5)" opacity="0.15">
        <path
          d="M24 41C24 41 2 27 2 13.5A11.5 11.5 0 0 1 24 6.1 11.5 11.5 0 0 1 46 13.5C46 27 24 41 24 41Z"
          fill="#000000"
        />
      </g>

      <g transform="translate(76, 75) scale(7.5)">
        <path
          d="M24 41C24 41 2 27 2 13.5A11.5 11.5 0 0 1 24 6.1 11.5 11.5 0 0 1 46 13.5C46 27 24 41 24 41Z"
          fill="#ffffff"
        />
      </g>
    </svg>
  )
}

// ── HeroLogo – large centred version for HomeView / Onboarding ──
export function HeroLogo() {
  return (
    <div className="hero-logo" aria-label="Remember Me">
      <div className="hero-logo__heart-wrap" style={{
        width: 160, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem'
      }}>
        <AppIconLogo size={140} />
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

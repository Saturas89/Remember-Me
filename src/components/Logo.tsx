interface Props {
  size?: 'sm' | 'md' | 'lg'
}

export function Logo({ size = 'md' }: Props) {
  return (
    <div className={`logo logo--${size}`} aria-label="Remember Me">
      <svg
        className="logo__heart"
        viewBox="0 0 48 44"
        fill="none"
        aria-hidden="true"
      >
        {/* Main heart */}
        <path
          d="M24 41C24 41 2 27 2 13.5A11.5 11.5 0 0 1 24 6.1 11.5 11.5 0 0 1 46 13.5C46 27 24 41 24 41Z"
          fill="var(--accent)"
        />
        {/* Shine highlight */}
        <path
          d="M13 10c-3 0-5.5 2.5-5.5 5.5"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>

      <div className="logo__wordmark">
        <span className="logo__remember">Remember</span>
        <span className="logo__me">Me</span>
      </div>
    </div>
  )
}

/** Full centered hero version for the HomeView */
export function HeroLogo() {
  return (
    <div className="hero-logo" aria-label="Remember Me">
      {/* viewBox has extra padding so drop-shadow is never clipped */}
      <svg
        className="hero-logo__heart"
        viewBox="-6 -6 60 56"
        fill="none"
        overflow="visible"
        aria-hidden="true"
      >
        <path
          d="M24 41C24 41 2 27 2 13.5A11.5 11.5 0 0 1 24 6.1 11.5 11.5 0 0 1 46 13.5C46 27 24 41 24 41Z"
          fill="var(--accent)"
        />
        <path
          d="M13 10c-3 0-5.5 2.5-5.5 5.5"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>

      <p className="hero-logo__remember">Remember</p>
      <p className="hero-logo__me">Me</p>
    </div>
  )
}

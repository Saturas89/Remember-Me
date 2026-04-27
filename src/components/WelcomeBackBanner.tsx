export interface WelcomeBackBannerProps {
  visible: boolean
  daysAway: number               // ≥3
  onContinue: () => void         // Klick auf "Weitermachen"
  onDismiss: () => void          // Klick auf ✕
}

export function WelcomeBackBanner({ visible, daysAway, onContinue, onDismiss }: WelcomeBackBannerProps): JSX.Element | null {
  if (!visible) return null

  return (
    <div 
      className="update-banner welcome-back-banner" 
      data-testid="welcome-back-banner"
      role="alert"
      aria-live="polite"
    >
      <div className="update-banner-content">
        <div className="update-banner-icon">👋</div>
        <div className="update-banner-text">
          <div className="update-banner-title">Willkommen zurück!</div>
          <div className="update-banner-subtitle">
            Du warst {daysAway} Tage weg. Zeit für neue Erinnerungen?
          </div>
        </div>
        <div className="update-banner-actions">
          <button 
            className="btn btn--primary btn--sm" 
            onClick={onContinue}
            data-testid="welcome-back-continue"
          >
            Weitermachen
          </button>
          <button 
            className="btn btn--ghost btn--sm" 
            onClick={onDismiss}
            aria-label="Banner schließen"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
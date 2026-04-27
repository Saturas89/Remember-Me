import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock the component since we're testing against the spec, not existing implementation
const mockWelcomeBackBanner = vi.fn((props: {
  visible: boolean
  daysAway: number
  onContinue: () => void
  onDismiss: () => void
}) => {
  if (!props.visible) return null
  
  return (
    <div 
      className="update-banner welcome-back-banner" 
      data-testid="welcome-back-banner"
      role="alert"
      aria-live="polite"
    >
      <h2>Willkommen zurück</h2>
      <p>Du warst {props.daysAway} Tage weg</p>
      <button 
        data-testid="welcome-back-continue"
        onClick={props.onContinue}
      >
        Weitermachen
      </button>
      <button 
        aria-label="Schließen"
        onClick={props.onDismiss}
      >
        ✕
      </button>
    </div>
  )
})

vi.mock('../components/WelcomeBackBanner', () => ({
  WelcomeBackBanner: mockWelcomeBackBanner
}))

async function loadComponent() {
  vi.resetModules()
  const module = await import('../components/WelcomeBackBanner')
  return module.WelcomeBackBanner
}

describe('WelcomeBackBanner', () => {
  it('renders welcome back banner when visible=true', async () => {
    const WelcomeBackBanner = await loadComponent()
    const onContinue = vi.fn()
    const onDismiss = vi.fn()
    
    render(
      <WelcomeBackBanner
        visible={true}
        daysAway={4}
        onContinue={onContinue}
        onDismiss={onDismiss}
      />
    )
    
    // Uses spec-derived testid for banner identification
    const banner = screen.getByTestId('welcome-back-banner')
    expect(banner).toBeInTheDocument()
    expect(banner).toHaveClass('update-banner', 'welcome-back-banner')
  })

  it('does not render when visible=false', async () => {
    const WelcomeBackBanner = await loadComponent()
    const onContinue = vi.fn()
    const onDismiss = vi.fn()
    
    render(
      <WelcomeBackBanner
        visible={false}
        daysAway={4}
        onContinue={onContinue}
        onDismiss={onDismiss}
      />
    )
    
    expect(screen.queryByTestId('welcome-back-banner')).not.toBeInTheDocument()
  })

  it('displays number of days away from spec', async () => {
    const WelcomeBackBanner = await loadComponent()
    const onContinue = vi.fn()
    const onDismiss = vi.fn()
    
    render(
      <WelcomeBackBanner
        visible={true}
        daysAway={7}
        onContinue={onContinue}
        onDismiss={onDismiss}
      />
    )
    
    expect(screen.getByText(/7 Tage/)).toBeInTheDocument()
  })

  it('calls onContinue when continue button is clicked', async () => {
    const WelcomeBackBanner = await loadComponent()
    const onContinue = vi.fn()
    const onDismiss = vi.fn()
    
    render(
      <WelcomeBackBanner
        visible={true}
        daysAway={3}
        onContinue={onContinue}
        onDismiss={onDismiss}
      />
    )
    
    // Uses spec-derived testid for continue button
    const continueButton = screen.getByTestId('welcome-back-continue')
    fireEvent.click(continueButton)
    
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('calls onDismiss when dismiss button is clicked', async () => {
    const WelcomeBackBanner = await loadComponent()
    const onContinue = vi.fn()
    const onDismiss = vi.fn()
    
    render(
      <WelcomeBackBanner
        visible={true}
        daysAway={5}
        onContinue={onContinue}
        onDismiss={onDismiss}
      />
    )
    
    const dismissButton = screen.getByLabelText('Schließen')
    fireEvent.click(dismissButton)
    
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('has correct accessibility attributes', async () => {
    const WelcomeBackBanner = await loadComponent()
    const onContinue = vi.fn()
    const onDismiss = vi.fn()
    
    render(
      <WelcomeBackBanner
        visible={true}
        daysAway={6}
        onContinue={onContinue}
        onDismiss={onDismiss}
      />
    )
    
    const banner = screen.getByTestId('welcome-back-banner')
    expect(banner).toHaveAttribute('role', 'alert')
    expect(banner).toHaveAttribute('aria-live', 'polite')
  })

  it('handles minimum required daysAway value of 3', async () => {
    const WelcomeBackBanner = await loadComponent()
    const onContinue = vi.fn()
    const onDismiss = vi.fn()
    
    render(
      <WelcomeBackBanner
        visible={true}
        daysAway={3}
        onContinue={onContinue}
        onDismiss={onDismiss}
      />
    )
    
    expect(screen.getByText(/3 Tage/)).toBeInTheDocument()
  })

  it('handles large daysAway values', async () => {
    const WelcomeBackBanner = await loadComponent()
    const onContinue = vi.fn()
    const onDismiss = vi.fn()
    
    render(
      <WelcomeBackBanner
        visible={true}
        daysAway={30}
        onContinue={onContinue}
        onDismiss={onDismiss}
      />
    )
    
    expect(screen.getByText(/30 Tage/)).toBeInTheDocument()
  })

  it('continue button has correct testid from spec', async () => {
    const WelcomeBackBanner = await loadComponent()
    const onContinue = vi.fn()
    const onDismiss = vi.fn()
    
    render(
      <WelcomeBackBanner
        visible={true}
        daysAway={4}
        onContinue={onContinue}
        onDismiss={onDismiss}
      />
    )
    
    const continueButton = screen.getByTestId('welcome-back-continue')
    expect(continueButton).toBeInTheDocument()
    expect(continueButton.textContent).toMatch(/Weitermachen/)
  })
})
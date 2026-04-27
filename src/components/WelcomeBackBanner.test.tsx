import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WelcomeBackBanner, type WelcomeBackBannerProps } from './WelcomeBackBanner'

describe('WelcomeBackBanner', () => {
  const defaultProps: WelcomeBackBannerProps = {
    visible: true,
    daysAway: 4,
    onContinue: vi.fn(),
    onDismiss: vi.fn()
  }

  it('renders nothing when visible is false', () => {
    const { container } = render(
      <WelcomeBackBanner {...defaultProps} visible={false} />
    )
    
    expect(container.firstChild).toBeNull()
  })

  it('renders welcome back banner with correct testid and classes', () => {
    render(<WelcomeBackBanner {...defaultProps} />)
    
    // Spec: data-testid="welcome-back-banner" + Klasse update-banner welcome-back-banner
    const banner = screen.getByTestId('welcome-back-banner')
    expect(banner).not.toBeNull()
    expect(banner.classList.contains('update-banner')).toBe(true)
    expect(banner.classList.contains('welcome-back-banner')).toBe(true)
  })

  it('displays days away information', () => {
    render(<WelcomeBackBanner {...defaultProps} daysAway={7} />)
    
    // Should show the number of days away in the content
    const banner = screen.getByTestId('welcome-back-banner')
    expect(banner.textContent).toMatch(/7/)
  })

  it('renders continue button with correct testid', () => {
    render(<WelcomeBackBanner {...defaultProps} />)
    
    // Spec: CTA-Button hat data-testid="welcome-back-continue"
    const continueButton = screen.getByTestId('welcome-back-continue')
    expect(continueButton).not.toBeNull()
  })

  it('calls onContinue when continue button is clicked', () => {
    const onContinueMock = vi.fn()
    render(<WelcomeBackBanner {...defaultProps} onContinue={onContinueMock} />)
    
    const continueButton = screen.getByTestId('welcome-back-continue')
    fireEvent.click(continueButton)
    
    expect(onContinueMock).toHaveBeenCalledTimes(1)
  })

  it('renders dismiss button', () => {
    render(<WelcomeBackBanner {...defaultProps} />)
    
    // Sollte einen Dismiss/X Button haben
    const dismissButton = screen.getByRole('button', { name: /dismiss|close|schließen|✕/i })
    expect(dismissButton).not.toBeNull()
  })

  it('calls onDismiss when dismiss button is clicked', () => {
    const onDismissMock = vi.fn()
    render(<WelcomeBackBanner {...defaultProps} onDismiss={onDismissMock} />)
    
    const dismissButton = screen.getByRole('button', { name: /dismiss|close|schließen|✕/i })
    fireEvent.click(dismissButton)
    
    expect(onDismissMock).toHaveBeenCalledTimes(1)
  })

  it('has correct accessibility attributes', () => {
    render(<WelcomeBackBanner {...defaultProps} />)
    
    // Spec: role="alert", aria-live="polite"
    const banner = screen.getByTestId('welcome-back-banner')
    expect(banner.getAttribute('role')).toBe('alert')
    expect(banner.getAttribute('aria-live')).toBe('polite')
  })

  it('handles minimum daysAway of 3', () => {
    render(<WelcomeBackBanner {...defaultProps} daysAway={3} />)
    
    const banner = screen.getByTestId('welcome-back-banner')
    expect(banner.textContent).toMatch(/3/)
  })

  it('shows welcome message with larger daysAway values', () => {
    render(<WelcomeBackBanner {...defaultProps} daysAway={30} />)
    
    const banner = screen.getByTestId('welcome-back-banner')
    expect(banner.textContent).toMatch(/30/)
  })

  it('continue button has proper button semantics', () => {
    render(<WelcomeBackBanner {...defaultProps} />)
    
    const continueButton = screen.getByTestId('welcome-back-continue')
    expect(continueButton.tagName).toBe('BUTTON')
    expect((continueButton as HTMLButtonElement).type).toBe('button')
  })

  it('dismiss button has proper button semantics', () => {
    render(<WelcomeBackBanner {...defaultProps} />)
    
    const dismissButton = screen.getByRole('button', { name: /dismiss|close|schließen|✕/i })
    expect(dismissButton.tagName).toBe('BUTTON')
    expect((dismissButton as HTMLButtonElement).type).toBe('button')
  })

  it('renders proper welcome back messaging', () => {
    render(<WelcomeBackBanner {...defaultProps} />)
    
    // Should contain welcome back type messaging
    const banner = screen.getByTestId('welcome-back-banner')
    const text = banner.textContent?.toLowerCase()
    expect(text).toMatch(/(willkommen|welcome|zurück|back)/i)
  })

  it('maintains banner visibility state correctly', () => {
    const { rerender } = render(<WelcomeBackBanner {...defaultProps} visible={false} />)
    expect(screen.queryByTestId('welcome-back-banner')).toBeNull()
    
    rerender(<WelcomeBackBanner {...defaultProps} visible={true} />)
    expect(screen.getByTestId('welcome-back-banner')).not.toBeNull()
    
    rerender(<WelcomeBackBanner {...defaultProps} visible={false} />)
    expect(screen.queryByTestId('welcome-back-banner')).toBeNull()
  })
})
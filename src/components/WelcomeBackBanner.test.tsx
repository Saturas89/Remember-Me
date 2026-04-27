import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WelcomeBackBanner } from './WelcomeBackBanner'
import { de } from '../locales/de/ui'

// Mock the locale import
vi.mock('../locales/de/ui', () => ({
  de: {
    reminder: {
      welcomeBack: {
        title: 'Willkommen zurück!',
        bodyDays: 'Du warst {days} Tage weg.',
        continueCta: 'Weitermachen',
        dismiss: 'Schließen'
      }
    }
  }
}))

describe('WelcomeBackBanner', () => {
  const defaultProps = {
    visible: true,
    daysAway: 5,
    onContinue: vi.fn(),
    onDismiss: vi.fn()
  }

  it('renders null when not visible', () => {
    const { container } = render(
      <WelcomeBackBanner {...defaultProps} visible={false} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders welcome back banner with correct testid', () => {
    render(<WelcomeBackBanner {...defaultProps} />)
    
    // Banner has the required data-testid
    const banner = screen.getByTestId('welcome-back-banner')
    expect(banner).not.toBeNull()
  })

  it('has correct CSS classes', () => {
    render(<WelcomeBackBanner {...defaultProps} />)
    
    const banner = screen.getByTestId('welcome-back-banner')
    expect(banner.classList.contains('update-banner')).toBe(true)
    expect(banner.classList.contains('welcome-back-banner')).toBe(true)
  })

  it('has correct accessibility attributes', () => {
    render(<WelcomeBackBanner {...defaultProps} />)
    
    const banner = screen.getByTestId('welcome-back-banner')
    expect(banner.getAttribute('role')).toBe('alert')
    expect(banner.getAttribute('aria-live')).toBe('polite')
  })

  it('displays welcome back title', () => {
    render(<WelcomeBackBanner {...defaultProps} />)
    
    expect(screen.getByText(de.reminder.welcomeBack.title)).not.toBeNull()
  })

  it('displays days away message with correct interpolation', () => {
    render(<WelcomeBackBanner {...defaultProps} daysAway={7} />)
    
    // Should show "Du warst 7 Tage weg."
    expect(screen.getByText('Du warst 7 Tage weg.')).not.toBeNull()
  })

  it('renders continue button with correct testid', () => {
    render(<WelcomeBackBanner {...defaultProps} />)
    
    // Continue button has required data-testid
    const continueButton = screen.getByTestId('welcome-back-continue')
    expect(continueButton).not.toBeNull()
    expect(continueButton.textContent).toBe(de.reminder.welcomeBack.continueCta)
  })

  it('calls onContinue when continue button clicked', () => {
    const onContinue = vi.fn()
    render(<WelcomeBackBanner {...defaultProps} onContinue={onContinue} />)
    
    const continueButton = screen.getByTestId('welcome-back-continue')
    fireEvent.click(continueButton)
    
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('renders dismiss button', () => {
    render(<WelcomeBackBanner {...defaultProps} />)
    
    const dismissButton = screen.getByText(de.reminder.welcomeBack.dismiss)
    expect(dismissButton).not.toBeNull()
  })

  it('calls onDismiss when dismiss button clicked', () => {
    const onDismiss = vi.fn()
    render(<WelcomeBackBanner {...defaultProps} onDismiss={onDismiss} />)
    
    const dismissButton = screen.getByText(de.reminder.welcomeBack.dismiss)
    fireEvent.click(dismissButton)
    
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('handles minimum days away (3)', () => {
    render(<WelcomeBackBanner {...defaultProps} daysAway={3} />)
    
    expect(screen.getByText('Du warst 3 Tage weg.')).not.toBeNull()
  })

  it('handles large numbers of days away', () => {
    render(<WelcomeBackBanner {...defaultProps} daysAway={30} />)
    
    expect(screen.getByText('Du warst 30 Tage weg.')).not.toBeNull()
  })

  it('continue button is focusable for accessibility', () => {
    render(<WelcomeBackBanner {...defaultProps} />)
    
    const continueButton = screen.getByTestId('welcome-back-continue')
    continueButton.focus()
    expect(document.activeElement).toBe(continueButton)
  })

  it('dismiss button is focusable for accessibility', () => {
    render(<WelcomeBackBanner {...defaultProps} />)
    
    const dismissButton = screen.getByText(de.reminder.welcomeBack.dismiss)
    dismissButton.focus()
    expect(document.activeElement).toBe(dismissButton)
  })
})
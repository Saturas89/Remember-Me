import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WelcomeBackBanner } from './WelcomeBackBanner'

// Mock i18n hook
vi.mock('../hooks/useI18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, any>) => {
      const translations: Record<string, string> = {
        'reminder.welcomeBack.title': 'Willkommen zurück',
        'reminder.welcomeBack.bodyDays': 'Du warst {days} Tage weg.',
        'reminder.welcomeBack.continueCta': 'Weitermachen',
        'reminder.welcomeBack.dismiss': 'Schließen'
      }
      let text = translations[key] || key
      if (params) {
        Object.entries(params).forEach(([param, value]) => {
          text = text.replace(`{${param}}`, String(value))
        })
      }
      return text
    }
  })
}))

describe('WelcomeBackBanner', () => {
  const defaultProps = {
    visible: true,
    daysAway: 5,
    onContinue: vi.fn(),
    onDismiss: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders banner when visible is true', () => {
    render(<WelcomeBackBanner {...defaultProps} />)
    
    // Banner element with required CSS classes and test ID
    const banner = screen.getByTestId('welcome-back-banner')
    expect(banner).not.toBeNull()
    expect(banner.classList.contains('update-banner')).toBe(true)
    expect(banner.classList.contains('welcome-back-banner')).toBe(true)
  })

  it('returns null when visible is false', () => {
    render(<WelcomeBackBanner {...defaultProps} visible={false} />)
    
    const banner = document.querySelector('[data-testid="welcome-back-banner"]')
    expect(banner).toBeNull()
  })

  it('displays welcome back title', () => {
    render(<WelcomeBackBanner {...defaultProps} />)
    
    expect(screen.getByText('Willkommen zurück')).not.toBeNull()
  })

  it('displays days away in body text', () => {
    render(<WelcomeBackBanner {...defaultProps} daysAway={7} />)
    
    expect(screen.getByText('Du warst 7 Tage weg.')).not.toBeNull()
  })

  it('renders continue button with correct test ID', () => {
    render(<WelcomeBackBanner {...defaultProps} />)
    
    // Continue button with required test ID
    const continueBtn = screen.getByTestId('welcome-back-continue')
    expect(continueBtn).not.toBeNull()
    expect(continueBtn.textContent).toBe('Weitermachen')
  })

  it('calls onContinue when continue button is clicked', () => {
    const onContinue = vi.fn()
    render(<WelcomeBackBanner {...defaultProps} onContinue={onContinue} />)
    
    const continueBtn = screen.getByTestId('welcome-back-continue')
    fireEvent.click(continueBtn)
    
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('renders dismiss button', () => {
    render(<WelcomeBackBanner {...defaultProps} />)
    
    const dismissBtn = screen.getByText('Schließen')
    expect(dismissBtn).not.toBeNull()
  })

  it('calls onDismiss when dismiss button is clicked', () => {
    const onDismiss = vi.fn()
    render(<WelcomeBackBanner {...defaultProps} onDismiss={onDismiss} />)
    
    const dismissBtn = screen.getByText('Schließen')
    fireEvent.click(dismissBtn)
    
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('has proper accessibility attributes', () => {
    render(<WelcomeBackBanner {...defaultProps} />)
    
    const banner = screen.getByTestId('welcome-back-banner')
    expect(banner.getAttribute('role')).toBe('alert')
    expect(banner.getAttribute('aria-live')).toBe('polite')
  })

  it('handles different days away values correctly', () => {
    const { rerender } = render(<WelcomeBackBanner {...defaultProps} daysAway={3} />)
    expect(screen.getByText('Du warst 3 Tage weg.')).not.toBeNull()
    
    rerender(<WelcomeBackBanner {...defaultProps} daysAway={15} />)
    expect(screen.getByText('Du warst 15 Tage weg.')).not.toBeNull()
  })

  it('maintains banner structure with required classes', () => {
    render(<WelcomeBackBanner {...defaultProps} />)
    
    const banner = screen.getByTestId('welcome-back-banner')
    
    // Verify CSS class structure matches DOM contract from spec
    expect(banner.classList.contains('update-banner')).toBe(true)
    expect(banner.classList.contains('welcome-back-banner')).toBe(true)
  })

  it('renders with minimum required days (3)', () => {
    render(<WelcomeBackBanner {...defaultProps} daysAway={3} />)
    
    expect(screen.getByText('Du warst 3 Tage weg.')).not.toBeNull()
    expect(screen.getByTestId('welcome-back-banner')).not.toBeNull()
  })
})
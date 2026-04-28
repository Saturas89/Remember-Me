import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { WelcomeBackBanner } from './WelcomeBackBanner'
import { UI_DE as de } from '../locales/de/ui'

describe('WelcomeBackBanner', () => {
  afterEach(() => {
    cleanup()
  })

  const defaultProps = {
    visible: true,
    daysAway: 5,
    onContinue: vi.fn(),
    onDismiss: vi.fn(),
  }

  it('renders null when not visible', () => {
    const { container } = render(
      <WelcomeBackBanner {...defaultProps} visible={false} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders welcome back banner with correct testid', () => {
    render(<WelcomeBackBanner {...defaultProps} />)

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

    const expected = de.reminder.welcomeBack.bodyDays.replace('{days}', '7')
    expect(screen.getByText(expected)).not.toBeNull()
  })

  it('renders continue button with correct testid', () => {
    render(<WelcomeBackBanner {...defaultProps} />)

    const continueButton = screen.getByTestId('welcome-back-continue')
    expect(continueButton).not.toBeNull()
    expect(continueButton.textContent).toBe(de.reminder.welcomeBack.continueCta)
  })

  it('calls onContinue when continue button clicked', () => {
    const onContinue = vi.fn()
    render(<WelcomeBackBanner {...defaultProps} onContinue={onContinue} />)

    fireEvent.click(screen.getByTestId('welcome-back-continue'))

    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('renders dismiss button reachable via aria-label', () => {
    render(<WelcomeBackBanner {...defaultProps} />)

    // Dismiss button shows ✕ text but is identified via aria-label
    const dismissButton = screen.getByRole('button', {
      name: de.reminder.welcomeBack.dismiss,
    })
    expect(dismissButton).not.toBeNull()
  })

  it('calls onDismiss when dismiss button clicked', () => {
    const onDismiss = vi.fn()
    render(<WelcomeBackBanner {...defaultProps} onDismiss={onDismiss} />)

    const dismissButton = screen.getByRole('button', {
      name: de.reminder.welcomeBack.dismiss,
    })
    fireEvent.click(dismissButton)

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('handles minimum days away (3)', () => {
    render(<WelcomeBackBanner {...defaultProps} daysAway={3} />)

    const expected = de.reminder.welcomeBack.bodyDays.replace('{days}', '3')
    expect(screen.getByText(expected)).not.toBeNull()
  })

  it('handles large numbers of days away', () => {
    render(<WelcomeBackBanner {...defaultProps} daysAway={30} />)

    const expected = de.reminder.welcomeBack.bodyDays.replace('{days}', '30')
    expect(screen.getByText(expected)).not.toBeNull()
  })

  it('continue button is focusable for accessibility', () => {
    render(<WelcomeBackBanner {...defaultProps} />)

    const continueButton = screen.getByTestId('welcome-back-continue')
    continueButton.focus()
    expect(document.activeElement).toBe(continueButton)
  })

  it('dismiss button is focusable for accessibility', () => {
    render(<WelcomeBackBanner {...defaultProps} />)

    const dismissButton = screen.getByRole('button', {
      name: de.reminder.welcomeBack.dismiss,
    })
    dismissButton.focus()
    expect(document.activeElement).toBe(dismissButton)
  })
})

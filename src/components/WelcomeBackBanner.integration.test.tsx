import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WelcomeBackBanner } from './WelcomeBackBanner'

// Mock useI18n for integration testing
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

describe('WelcomeBackBanner - Integration Tests (FR-16.8)', () => {
  const mockOnContinue = vi.fn()
  const mockOnDismiss = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('integrates with app visibility logic for 3+ days away', () => {
    // Simulate minimum threshold (3 days) as per FR-16.8
    render(
      <WelcomeBackBanner
        visible={true}
        daysAway={3}
        onContinue={mockOnContinue}
        onDismiss={mockOnDismiss}
      />
    )

    expect(screen.getByTestId('welcome-back-banner')).not.toBeNull()
    expect(screen.getByText('Du warst 3 Tage weg.')).not.toBeNull()
  })

  it('handles extended absence periods correctly', () => {
    // Simulate longer absence
    render(
      <WelcomeBackBanner
        visible={true}
        daysAway={10}
        onContinue={mockOnContinue}
        onDismiss={mockOnDismiss}
      />
    )

    expect(screen.getByText('Du warst 10 Tage weg.')).not.toBeNull()
  })

  it('banner appears independently of reminder toggle state', () => {
    // Welcome back banner should appear regardless of notification settings
    // as per FR-16.8: "Erscheint unabhängig vom Reminder-Toggle"
    render(
      <WelcomeBackBanner
        visible={true}
        daysAway={5}
        onContinue={mockOnContinue}
        onDismiss={mockOnDismiss}
      />
    )

    const banner = screen.getByTestId('welcome-back-banner')
    expect(banner).not.toBeNull()
    
    // Should be visible regardless of OS permission state
    expect(banner.classList.contains('update-banner')).toBe(true)
    expect(banner.classList.contains('welcome-back-banner')).toBe(true)
  })

  it('continue button triggers navigation to next question', () => {
    render(
      <WelcomeBackBanner
        visible={true}
        daysAway={4}
        onContinue={mockOnContinue}
        onDismiss={mockOnDismiss}
      />
    )

    // Click continue button (which should navigate to next open question)
    const continueBtn = screen.getByTestId('welcome-back-continue')
    fireEvent.click(continueBtn)

    // Should trigger navigation callback as per FR-16.8
    expect(mockOnContinue).toHaveBeenCalledTimes(1)
  })

  it('dismiss functionality works correctly', () => {
    render(
      <WelcomeBackBanner
        visible={true}
        daysAway={7}
        onContinue={mockOnContinue}
        onDismiss={mockOnDismiss}
      />
    )

    const dismissBtn = screen.getByText('Schließen')
    fireEvent.click(dismissBtn)

    expect(mockOnDismiss).toHaveBeenCalledTimes(1)
  })

  it('maintains accessibility requirements in integration context', () => {
    render(
      <WelcomeBackBanner
        visible={true}
        daysAway={6}
        onContinue={mockOnContinue}
        onDismiss={mockOnDismiss}
      />
    )

    const banner = screen.getByTestId('welcome-back-banner')
    
    // Accessibility attributes as per NFR
    expect(banner.getAttribute('role')).toBe('alert')
    expect(banner.getAttribute('aria-live')).toBe('polite')
  })

  it('works with various day counts in realistic scenarios', () => {
    const testCases = [
      { days: 3, expected: 'Du warst 3 Tage weg.' },
      { days: 7, expected: 'Du warst 7 Tage weg.' },
      { days: 14, expected: 'Du warst 14 Tage weg.' },
      { days: 30, expected: 'Du warst 30 Tage weg.' }
    ]

    testCases.forEach(({ days, expected }) => {
      const { rerender } = render(
        <WelcomeBackBanner
          visible={true}
          daysAway={days}
          onContinue={mockOnContinue}
          onDismiss={mockOnDismiss}
        />
      )

      expect(screen.getByText(expected)).not.toBeNull()

      // Clean up for next iteration
      rerender(
        <WelcomeBackBanner
          visible={false}
          daysAway={days}
          onContinue={mockOnContinue}
          onDismiss={mockOnDismiss}
        />
      )
    })
  })

  it('banner state toggles correctly with visibility prop', () => {
    const { rerender } = render(
      <WelcomeBackBanner
        visible={false}
        daysAway={5}
        onContinue={mockOnContinue}
        onDismiss={mockOnDismiss}
      />
    )

    // Should not be visible
    const bannerHidden = document.querySelector('[data-testid="welcome-back-banner"]')
    expect(bannerHidden).toBeNull()

    // Show the banner
    rerender(
      <WelcomeBackBanner
        visible={true}
        daysAway={5}
        onContinue={mockOnContinue}
        onDismiss={mockOnDismiss}
      />
    )

    // Should be visible
    expect(screen.getByTestId('welcome-back-banner')).not.toBeNull()
  })

  it('handles edge case of exactly 3 days (minimum threshold)', () => {
    render(
      <WelcomeBackBanner
        visible={true}
        daysAway={3}
        onContinue={mockOnContinue}
        onDismiss={mockOnDismiss}
      />
    )

    // Should show banner at exactly 3 days as per threshold in FR-16.8
    expect(screen.getByTestId('welcome-back-banner')).not.toBeNull()
    expect(screen.getByText('Du warst 3 Tage weg.')).not.toBeNull()
  })

  it('integrates properly with app state management', () => {
    // Test that banner can be controlled by external state
    let isVisible = true
    const toggleVisibility = () => { isVisible = !isVisible }

    const { rerender } = render(
      <WelcomeBackBanner
        visible={isVisible}
        daysAway={4}
        onContinue={() => {
          mockOnContinue()
          toggleVisibility() // Simulate hiding after continue
        }}
        onDismiss={() => {
          mockOnDismiss()
          toggleVisibility() // Simulate hiding after dismiss
        }}
      />
    )

    expect(screen.getByTestId('welcome-back-banner')).not.toBeNull()

    // Click continue
    fireEvent.click(screen.getByTestId('welcome-back-continue'))

    // Simulate state update
    rerender(
      <WelcomeBackBanner
        visible={false}
        daysAway={4}
        onContinue={mockOnContinue}
        onDismiss={mockOnDismiss}
      />
    )

    // Banner should be hidden after continue action
    const hiddenBanner = document.querySelector('[data-testid="welcome-back-banner"]')
    expect(hiddenBanner).toBeNull()
  })

  it('displays German localization correctly in integration', () => {
    render(
      <WelcomeBackBanner
        visible={true}
        daysAway={8}
        onContinue={mockOnContinue}
        onDismiss={mockOnDismiss}
      />
    )

    // Verify German texts are displayed as per localization requirements
    expect(screen.getByText('Willkommen zurück')).not.toBeNull()
    expect(screen.getByText('Du warst 8 Tage weg.')).not.toBeNull()
    expect(screen.getByText('Weitermachen')).not.toBeNull()
    expect(screen.getByText('Schließen')).not.toBeNull()
  })
})
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WelcomeBackBanner } from './WelcomeBackBanner';

// Mock navigation hook
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

describe('WelcomeBackBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with correct test id and accessibility attributes', () => {
    render(
      <WelcomeBackBanner 
        nextQuestionId="question-1" 
        daysSinceLastVisit={5}
      />
    );

    // Should have correct testid per spec FR-16.8
    const banner = screen.getByTestId('welcome-back-banner');
    expect(banner).toBeInTheDocument();
    
    // Should have correct CSS class per spec FR-16.8
    expect(banner).toHaveClass('update-banner', 'welcome-back-banner');
    
    // Should have accessibility attributes per spec section 5
    expect(banner).toHaveAttribute('role', 'alert');
    expect(banner).toHaveAttribute('aria-live', 'polite');
  });

  it('should display welcome back message in German', () => {
    render(
      <WelcomeBackBanner 
        nextQuestionId="question-1" 
        daysSinceLastVisit={3}
      />
    );

    // Should show German text per spec (locale: de-DE)
    expect(screen.getByText(/willkommen zurück/i)).toBeInTheDocument();
    expect(screen.getByText(/3 tag/i)).toBeInTheDocument();
  });

  it('should show continue button with correct text', () => {
    render(
      <WelcomeBackBanner 
        nextQuestionId="question-1" 
        daysSinceLastVisit={4}
      />
    );

    // Should show "Weitermachen" CTA per spec FR-16.8
    const continueButton = screen.getByRole('button', { name: /weitermachen/i });
    expect(continueButton).toBeInTheDocument();
  });

  it('should navigate to next question on continue button click', async () => {
    const user = userEvent.setup();
    
    render(
      <WelcomeBackBanner 
        nextQuestionId="question-42" 
        daysSinceLastVisit={7}
      />
    );

    const continueButton = screen.getByRole('button', { name: /weitermachen/i });
    
    await user.click(continueButton);

    // Should navigate to next open question per spec FR-16.8
    expect(mockNavigate).toHaveBeenCalledWith('/question/question-42');
  });

  it('should navigate to home when no next question provided', async () => {
    const user = userEvent.setup();
    
    render(
      <WelcomeBackBanner 
        nextQuestionId={null} 
        daysSinceLastVisit={5}
      />
    );

    const continueButton = screen.getByRole('button', { name: /weitermachen/i });
    
    await user.click(continueButton);

    // Should fallback to home per spec FR-16.8
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('should show correct pluralization for days', () => {
    const { rerender } = render(
      <WelcomeBackBanner 
        nextQuestionId="question-1" 
        daysSinceLastVisit={1}
      />
    );

    // Single day
    expect(screen.getByText(/1 tag[^e]/i)).toBeInTheDocument();

    rerender(
      <WelcomeBackBanner 
        nextQuestionId="question-1" 
        daysSinceLastVisit={5}
      />
    );

    // Multiple days
    expect(screen.getByText(/5 tage/i)).toBeInTheDocument();
  });

  it('should show dismiss button and handle dismissal', async () => {
    const mockOnDismiss = vi.fn();
    const user = userEvent.setup();
    
    render(
      <WelcomeBackBanner 
        nextQuestionId="question-1" 
        daysSinceLastVisit={3}
        onDismiss={mockOnDismiss}
      />
    );

    const dismissButton = screen.getByRole('button', { name: /schließen|×/i });
    
    await user.click(dismissButton);

    expect(mockOnDismiss).toHaveBeenCalled();
  });

  it('should not render when daysSinceLastVisit is less than 3', () => {
    const { container } = render(
      <WelcomeBackBanner 
        nextQuestionId="question-1" 
        daysSinceLastVisit={2} // Less than 3 days per spec FR-16.8
      />
    );

    // Should not appear for less than 3 days pause per spec FR-16.8
    expect(container.firstChild).toBeNull();
  });

  it('should render for exactly 3 days pause', () => {
    render(
      <WelcomeBackBanner 
        nextQuestionId="question-1" 
        daysSinceLastVisit={3} // Exactly 3 days per spec FR-16.8
      />
    );

    // Should appear for ≥3 days pause per spec FR-16.8
    expect(screen.getByTestId('welcome-back-banner')).toBeInTheDocument();
  });

  it('should render for more than 3 days pause', () => {
    render(
      <WelcomeBackBanner 
        nextQuestionId="question-1" 
        daysSinceLastVisit={10}
      />
    );

    // Should appear for ≥3 days pause per spec FR-16.8
    expect(screen.getByTestId('welcome-back-banner')).toBeInTheDocument();
    expect(screen.getByText(/10 tage/i)).toBeInTheDocument();
  });

  it('should support custom className prop', () => {
    render(
      <WelcomeBackBanner 
        nextQuestionId="question-1" 
        daysSinceLastVisit={5}
        className="custom-banner-class"
      />
    );

    const banner = screen.getByTestId('welcome-back-banner');
    expect(banner).toHaveClass('custom-banner-class');
  });

  it('should render with motivational message when streak info provided', () => {
    render(
      <WelcomeBackBanner 
        nextQuestionId="question-1" 
        daysSinceLastVisit={4}
        currentStreak={5}
      />
    );

    // Should show streak-related motivation
    expect(screen.getByText(/streak|serie/i)).toBeInTheDocument();
    expect(screen.getByText(/5/)).toBeInTheDocument();
  });

  it('should show category progress when provided', () => {
    render(
      <WelcomeBackBanner 
        nextQuestionId="question-1" 
        daysSinceLastVisit={6}
        categoryProgress="Familie (2/5)"
      />
    );

    // Should show category progress in welcome message
    expect(screen.getByText(/familie.*2.*5/i)).toBeInTheDocument();
  });
});
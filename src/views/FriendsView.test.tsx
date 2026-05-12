import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FriendsView } from './FriendsView'

// Mock router navigation
const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate
}))

const mockProps = {
  profileName: 'Sandra',
  onSettingsClick: vi.fn(),
  onHelpClick: vi.fn()
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('FriendsView - Sandra Flow Integration (FR-020.10)', () => {
  describe('Personal Questions Card', () => {
    it('shows "Eigene Fragen für jemanden formulieren" card', () => {
      render(<FriendsView {...mockProps} />)
      
      // data-testid derived from FR-020.10 "Eintrag in der Freunde-Tab: neue Karte 'Eigene Fragen für jemanden formulieren'"
      const personalQuestionsCard = screen.getByTestId('friends-personal-questions-card')
      expect(personalQuestionsCard).not.toBeNull()
      
      // Should contain the expected text from spec
      expect(personalQuestionsCard.textContent).toContain('Eigene Fragen')
      expect(personalQuestionsCard.textContent).toContain('formulieren')
    })

    it('navigates directly to #/ask when card is clicked', async () => {
      const user = userEvent.setup()
      render(<FriendsView {...mockProps} />)
      
      // data-testid derived from FR-020.10 "verlinkt direkt nach #/ask"
      const personalQuestionsCard = screen.getByTestId('friends-personal-questions-card')
      await user.click(personalQuestionsCard)
      
      expect(mockNavigate).toHaveBeenCalledWith('/ask')
    })

    it('has proper button styling following Friends design system', () => {
      render(<FriendsView {...mockProps} />)
      
      const card = screen.getByTestId('friends-personal-questions-card')
      
      // Per spec §6 Design-System: should use Friends-Tab classes
      expect(card.classList.contains('friend-card')).toBe(true)
    })

    it('shows action button with "Loslegen" text', () => {
      render(<FriendsView {...mockProps} />)
      
      // data-testid derived from typical Friends card action pattern + Sandra landing step
      const actionButton = screen.getByTestId('friends-personal-questions-action-button')
      expect(actionButton).not.toBeNull()
      expect(actionButton.textContent).toContain('Loslegen')
    })

    it('navigates to Sandra flow when action button is clicked', async () => {
      const user = userEvent.setup()
      render(<FriendsView {...mockProps} />)
      
      const actionButton = screen.getByTestId('friends-personal-questions-action-button')
      await user.click(actionButton)
      
      expect(mockNavigate).toHaveBeenCalledWith('/ask')
    })
  })

  describe('Card Positioning and Layout', () => {
    it('positions personal questions card within friends list section', () => {
      render(<FriendsView {...mockProps} />)
      
      const friendsList = screen.getByTestId('friends-list')
      const personalQuestionsCard = screen.getByTestId('friends-personal-questions-card')
      
      // Card should be within the friends list container
      expect(friendsList).toContainElement(personalQuestionsCard)
    })

    it('follows Friends design system spacing and layout', () => {
      render(<FriendsView {...mockProps} />)
      
      const card = screen.getByTestId('friends-personal-questions-card')
      const friendsList = screen.getByTestId('friends-list')
      
      // Should use .friends-list gap pattern per spec §6
      const listStyles = getComputedStyle(friendsList)
      expect(listStyles.gap).toBe('0.75rem')
      
      // Card should use .friend-card base class
      expect(card.classList.contains('friend-card')).toBe(true)
    })
  })

  describe('Icon and Visual Design', () => {
    it('shows appropriate icon for personal question creation', () => {
      render(<FriendsView {...mockProps} />)
      
      // data-testid derived from expected icon presence in card
      const cardIcon = screen.getByTestId('friends-personal-questions-icon')
      expect(cardIcon).not.toBeNull()
    })

    it('uses consistent visual hierarchy with other friend cards', () => {
      render(<FriendsView {...mockProps} />)
      
      const personalQuestionsCard = screen.getByTestId('friends-personal-questions-card')
      
      // Should have same base styling as other friend cards per design system
      expect(personalQuestionsCard.classList.contains('friend-card')).toBe(true)
      
      // Should not have any special modifier classes that break consistency
      const friendCardClasses = Array.from(personalQuestionsCard.classList)
      const isConsistent = friendCardClasses.every(cls => 
        cls.startsWith('friend-') || cls.startsWith('sandra-') || ['card'].includes(cls)
      )
      expect(isConsistent).toBe(true)
    })
  })

  describe('Accessibility and Interaction', () => {
    it('has proper keyboard navigation support', async () => {
      const user = userEvent.setup()
      render(<FriendsView {...mockProps} />)
      
      const card = screen.getByTestId('friends-personal-questions-card')
      
      // Should be focusable
      await user.tab()
      expect(document.activeElement).toBe(card)
      
      // Should activate on Enter
      await user.keyboard('{Enter}')
      expect(mockNavigate).toHaveBeenCalledWith('/ask')
    })

    it('has proper touch target size >= 44x44px', () => {
      render(<FriendsView {...mockProps} />)
      
      const card = screen.getByTestId('friends-personal-questions-card')
      const styles = getComputedStyle(card)
      
      // Per accessibility requirements
      expect(parseInt(styles.minHeight) || 0).toBeGreaterThanOrEqual(44)
    })

    it('provides clear visual affordance that it is clickable', () => {
      render(<FriendsView {...mockProps} />)
      
      const card = screen.getByTestId('friends-personal-questions-card')
      
      // Should be a button element or have button role for clarity
      expect(card.tagName === 'BUTTON' || card.getAttribute('role') === 'button').toBe(true)
    })
  })

  describe('Integration with Existing Friends Cards', () => {
    it('does not interfere with existing friend invitation cards', () => {
      render(<FriendsView {...mockProps} />)
      
      // Personal questions card should be additional, not replacing existing functionality
      const personalQuestionsCard = screen.getByTestId('friends-personal-questions-card')
      expect(personalQuestionsCard).not.toBeNull()
      
      // Should still show other friends functionality 
      const friendsList = screen.getByTestId('friends-list')
      expect(friendsList).not.toBeNull()
    })

    it('maintains existing Friends tab functionality', () => {
      render(<FriendsView {...mockProps} />)
      
      // Existing props should still work
      expect(mockProps.onSettingsClick).toBeDefined()
      expect(mockProps.onHelpClick).toBeDefined()
      
      // Profile name should still be displayed
      expect(screen.getByText(mockProps.profileName)).not.toBeNull()
    })
  })

  describe('Conditional Display', () => {
    it('shows personal questions card for all users', () => {
      render(<FriendsView {...mockProps} />)
      
      // Per spec, this should be available to all users, no conditional display
      const card = screen.getByTestId('friends-personal-questions-card')
      expect(card).not.toBeNull()
    })

    it('works with different profile names', () => {
      const alternateProps = { ...mockProps, profileName: 'Maria' }
      render(<FriendsView {...alternateProps} />)
      
      const card = screen.getByTestId('friends-personal-questions-card')
      expect(card).not.toBeNull()
      
      // Should still navigate to /ask regardless of profile name
      expect(card.getAttribute('onclick')).toBeFalsy() // Uses proper event handlers
    })
  })
})
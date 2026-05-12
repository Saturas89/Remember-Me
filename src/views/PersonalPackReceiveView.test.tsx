import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PersonalPackReceiveView } from './PersonalPackReceiveView'
import type { PersonalQuestionPack } from '../types/sandraFlow'

// Mock app mode context
const mockSetAppMode = vi.fn()
const mockAppMode = vi.fn()

// Mock components and hooks if needed
vi.mock('../hooks/useAppMode', () => ({
  useAppMode: () => [mockAppMode(), mockSetAppMode]
}))

const samplePersonalPack: PersonalQuestionPack = {
  personalPack: true,
  senderName: 'Sandra',
  recipientLabel: 'mama',
  anrede: 'Mama',
  questions: [
    {
      id: 'q1',
      text: 'Wie war deine Schulzeit, Mama?',
      type: 'text',
      createdAt: '2024-01-01T00:00:00.000Z'
    },
    {
      id: 'q2', 
      text: 'Was bedeute ich dir, Mama?',
      type: 'text',
      createdAt: '2024-01-01T00:01:00.000Z'
    },
    {
      id: 'q3',
      text: 'Erzähl von deiner Jugend, Mama.',
      type: 'text', 
      createdAt: '2024-01-01T00:02:00.000Z'
    }
  ]
}

const mockProps = {
  pack: samplePersonalPack,
  onSubmit: vi.fn(),
  onDismiss: vi.fn()
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAppMode.mockReturnValue('normal') // Default to normal mode
})

describe('PersonalPackReceiveView', () => {
  describe('Personal Pack Detection and Header (FR-020.9)', () => {
    it('recognizes personal pack and renders gentle header', () => {
      render(<PersonalPackReceiveView {...mockProps} />)
      
      // data-testid derived from FR-020.9 "Erkennt personalPack === true und rendert sanften Header"
      const gentleHeader = screen.getByTestId('personal-pack-gentle-header')
      expect(gentleHeader).not.toBeNull()
      
      // Should show sender name from pack
      expect(gentleHeader.textContent).toContain('Sandra')
    })

    it('displays pack metadata in header', () => {
      render(<PersonalPackReceiveView {...mockProps} />)
      
      const header = screen.getByTestId('personal-pack-gentle-header')
      expect(header.textContent).toContain(samplePersonalPack.senderName)
      expect(header.textContent).toContain(samplePersonalPack.anrede)
    })
  })

  describe('Simplified Mode Auto-Suggest (FR-020.9)', () => {
    it('shows auto-suggest modal when not in simple mode', () => {
      mockAppMode.mockReturnValue('normal')
      render(<PersonalPackReceiveView {...mockProps} />)
      
      // data-testid derived from FR-020.9 "Schlägt Vereinfachten Bedienmodus einmalig vor"
      const autoSuggestModal = screen.getByTestId('simple-mode-auto-suggest-modal')
      expect(autoSuggestModal).not.toBeNull()
    })

    it('does not show auto-suggest when already in simple mode', () => {
      mockAppMode.mockReturnValue('simple')
      render(<PersonalPackReceiveView {...mockProps} />)
      
      const autoSuggestModal = screen.queryByTestId('simple-mode-auto-suggest-modal')
      expect(autoSuggestModal).toBeNull()
    })

    it('sets simple mode when "Ja, einfach machen" is clicked', async () => {
      const user = userEvent.setup()
      mockAppMode.mockReturnValue('normal')
      
      render(<PersonalPackReceiveView {...mockProps} />)
      
      // data-testid derived from FR-020.9 "großem 'Ja, einfach machen'-Button"
      const acceptSimpleButton = screen.getByTestId('simple-mode-accept-button')
      await user.click(acceptSimpleButton)
      
      expect(mockSetAppMode).toHaveBeenCalledWith('simple')
    })

    it('dismisses auto-suggest with "Wie gewohnt" option', async () => {
      const user = userEvent.setup()
      mockAppMode.mockReturnValue('normal')
      
      render(<PersonalPackReceiveView {...mockProps} />)
      
      // data-testid derived from FR-020.9 "kleinem 'Wie gewohnt'-Button"
      const keepNormalButton = screen.getByTestId('simple-mode-keep-normal-button')
      await user.click(keepNormalButton)
      
      expect(mockSetAppMode).not.toHaveBeenCalled()
      
      // Modal should be dismissed
      await waitFor(() => {
        expect(screen.queryByTestId('simple-mode-auto-suggest-modal')).toBeNull()
      })
    })
  })

  describe('One-Question-at-a-Time Interface (FR-020.9)', () => {
    beforeEach(() => {
      mockAppMode.mockReturnValue('simple') // Skip auto-suggest for these tests
    })

    it('presents questions one at a time, not in list layout', () => {
      render(<PersonalPackReceiveView {...mockProps} />)
      
      // data-testid derived from FR-020.9 "Stellt Fragen eine nach der anderen"
      const currentQuestion = screen.getByTestId('personal-pack-current-question')
      expect(currentQuestion).not.toBeNull()
      
      // Should show first question text
      expect(currentQuestion.textContent).toContain('Wie war deine Schulzeit, Mama?')
      
      // Should NOT show all questions at once (no list layout)
      expect(screen.queryByText('Was bedeute ich dir, Mama?')).toBeNull()
      expect(screen.queryByText('Erzähl von deiner Jugend, Mama.')).toBeNull()
    })

    it('does not show pack code in interface', () => {
      render(<PersonalPackReceiveView {...mockProps} />)
      
      // data-testid derived from FR-020.9 "kein Pack-Code"
      expect(screen.queryByText(/qp=/)).toBeNull()
      expect(screen.queryByText(/pack.*code/i)).toBeNull()
    })

    it('does not show edit tools in receiver view', () => {
      render(<PersonalPackReceiveView {...mockProps} />)
      
      // data-testid derived from FR-020.9 "keine Edit-Tools"
      expect(screen.queryByTestId('question-edit-button')).toBeNull()
      expect(screen.queryByTestId('question-delete-button')).toBeNull()
      expect(screen.queryByTestId('question-reorder-button')).toBeNull()
    })

    it('shows large microphone button >= 80x80px', () => {
      render(<PersonalPackReceiveView {...mockProps} />)
      
      // data-testid derived from FR-020.9 "Großer Mikrofon-Button ≥ 80 × 80 px"
      const micButton = screen.getByTestId('personal-pack-mic-button')
      expect(micButton).not.toBeNull()
      
      // Check button size meets accessibility requirement
      const styles = getComputedStyle(micButton)
      const minSize = 80
      expect(parseInt(styles.width) || 0).toBeGreaterThanOrEqual(minSize)
      expect(parseInt(styles.height) || 0).toBeGreaterThanOrEqual(minSize)
    })

    it('advances to next question after answering', async () => {
      const user = userEvent.setup()
      render(<PersonalPackReceiveView {...mockProps} />)
      
      // Answer first question
      const textarea = screen.getByTestId('personal-pack-answer-textarea')
      await user.type(textarea, 'Die Schulzeit war schön.')
      
      // data-testid derived from next question navigation flow
      const nextButton = screen.getByTestId('personal-pack-next-button')
      await user.click(nextButton)
      
      // Should show second question
      const currentQuestion = screen.getByTestId('personal-pack-current-question')
      expect(currentQuestion.textContent).toContain('Was bedeute ich dir, Mama?')
    })
  })

  describe('Progress Indicator (FR-020.9)', () => {
    beforeEach(() => {
      mockAppMode.mockReturnValue('simple')
    })

    it('shows progress as dot indicator, not percentages', () => {
      render(<PersonalPackReceiveView {...mockProps} />)
      
      // data-testid derived from FR-020.9 "Progress als Punkt-Indikator (●●○○○), keine Prozente"
      const progressDots = screen.getByTestId('personal-pack-progress-dots')
      expect(progressDots).not.toBeNull()
      
      // Should not show percentage text
      expect(screen.queryByText(/%/)).toBeNull()
      expect(screen.queryByText(/prozent/i)).toBeNull()
    })

    it('shows correct progress state for current question', () => {
      render(<PersonalPackReceiveView {...mockProps} />)
      
      const progressDots = screen.getByTestId('personal-pack-progress-dots')
      
      // For 3 questions, on question 1: should show 1 filled, 2 empty
      // Specific dot pattern testing depends on implementation
      expect(progressDots.textContent).not.toContain('100%')
      
      // Has proper accessibility attributes per spec §7
      expect(progressDots.getAttribute('role')).toBe('progressbar')
      expect(progressDots.getAttribute('aria-valuenow')).toBe('1')
      expect(progressDots.getAttribute('aria-valuemax')).toBe('3')
    })
  })

  describe('Answer Submission (API Contract)', () => {
    beforeEach(() => {
      mockAppMode.mockReturnValue('simple')
    })

    it('calls onSubmit with correct format after completing all questions', async () => {
      const user = userEvent.setup()
      render(<PersonalPackReceiveView {...mockProps} />)
      
      // Answer all questions
      const answers = [
        'Die Schulzeit war schön.',
        'Du bedeutest mir alles.',
        'Meine Jugend war aufregend.'
      ]
      
      for (let i = 0; i < answers.length; i++) {
        const textarea = screen.getByTestId('personal-pack-answer-textarea')
        await user.type(textarea, answers[i])
        
        if (i < answers.length - 1) {
          const nextButton = screen.getByTestId('personal-pack-next-button')
          await user.click(nextButton)
        } else {
          // Last question - submit
          const submitButton = screen.getByTestId('personal-pack-submit-button')
          await user.click(submitButton)
        }
      }
      
      // Verify onSubmit called with correct format per API contract
      expect(mockProps.onSubmit).toHaveBeenCalledWith(
        expect.any(String), // recipientName
        [
          { questionId: 'q1', questionText: 'Wie war deine Schulzeit, Mama?', value: 'Die Schulzeit war schön.' },
          { questionId: 'q2', questionText: 'Was bedeute ich dir, Mama?', value: 'Du bedeutest mir alles.' },
          { questionId: 'q3', questionText: 'Erzähl von deiner Jugend, Mama.', value: 'Meine Jugend war aufregend.' }
        ]
      )
    })

    it('allows dismissing the entire flow', async () => {
      const user = userEvent.setup()
      render(<PersonalPackReceiveView {...mockProps} />)
      
      // data-testid derived from API contract onDismiss callback
      const dismissButton = screen.getByTestId('personal-pack-dismiss-button')
      await user.click(dismissButton)
      
      expect(mockProps.onDismiss).toHaveBeenCalledTimes(1)
    })
  })

  describe('Accessibility Requirements (§7)', () => {
    beforeEach(() => {
      mockAppMode.mockReturnValue('simple')
    })

    it('has proper touch target sizes >= 44x44px', () => {
      render(<PersonalPackReceiveView {...mockProps} />)
      
      // All interactive elements should meet touch target size
      const micButton = screen.getByTestId('personal-pack-mic-button')
      const nextButton = screen.getByTestId('personal-pack-next-button')
      
      for (const button of [micButton, nextButton]) {
        const styles = getComputedStyle(button)
        expect(parseInt(styles.width) || 0).toBeGreaterThanOrEqual(44)
        expect(parseInt(styles.height) || 0).toBeGreaterThanOrEqual(44)
      }
    })

    it('has proper ARIA labels for progress indicator', () => {
      render(<PersonalPackReceiveView {...mockProps} />)
      
      const progressDots = screen.getByTestId('personal-pack-progress-dots')
      
      // Per spec §7 "role='progressbar' mit aria-valuenow / aria-valuemax"
      expect(progressDots.getAttribute('role')).toBe('progressbar')
      expect(progressDots.getAttribute('aria-valuenow')).toBe('1')
      expect(progressDots.getAttribute('aria-valuemax')).toBe('3')
    })

    it('has proper textarea labeling', () => {
      render(<PersonalPackReceiveView {...mockProps} />)
      
      const textarea = screen.getByTestId('personal-pack-answer-textarea')
      
      // Should have visible label per spec §7
      expect(textarea.getAttribute('aria-label')).toBeTruthy()
    })

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<PersonalPackReceiveView {...mockProps} />)
      
      const textarea = screen.getByTestId('personal-pack-answer-textarea')
      await user.type(textarea, 'Test answer')
      
      // Enter should create line break, not submit per spec §7
      await user.keyboard('{Enter}')
      expect((textarea as HTMLTextAreaElement).value).toContain('\n')
      
      // onSubmit should not be called by Enter
      expect(mockProps.onSubmit).not.toHaveBeenCalled()
    })
  })

  describe('Simple Mode Integration (REQ-019)', () => {
    it('inherits REQ-019 accessibility when simple mode is active', () => {
      mockAppMode.mockReturnValue('simple')
      render(<PersonalPackReceiveView {...mockProps} />)
      
      // data-testid derived from FR-020.9 "Receiver erbt REQ-019-A11y"
      // This is integration testing - the actual A11y features would be tested in REQ-019 tests
      const container = screen.getByTestId('personal-pack-container')
      expect(container.getAttribute('data-app-mode')).toBe('simple')
    })
  })
})
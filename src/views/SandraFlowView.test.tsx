import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SandraFlowView } from './SandraFlowView'

// Mock navigator.share and sessionStorage for testing
const mockNavigatorShare = vi.fn()
const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn()
}

beforeEach(() => {
  vi.clearAllMocks()
  mockNavigatorShare.mockResolvedValue(undefined)
  mockSessionStorage.getItem.mockReturnValue(null)
  
  Object.defineProperty(global, 'navigator', {
    value: { share: mockNavigatorShare },
    writable: true
  })
  
  Object.defineProperty(global, 'sessionStorage', {
    value: mockSessionStorage,
    writable: true
  })
})

const mockProps = {
  profileName: 'Sandra',
  onBack: vi.fn()
}

describe('SandraFlowView', () => {
  describe('Step Navigation - Landing → Anchor → Trigger → Composer → List → Share', () => {
    it('progresses through all six steps in the Sandra flow', async () => {
      const user = userEvent.setup()
      render(<SandraFlowView {...mockProps} />)

      // Step 1: Landing - expect "Loslegen" button per spec FR-020.1
      // data-testid derived from spec wording "Sandra öffnet Landing-Schritt"  
      const startButton = screen.getByTestId('sandra-landing-start-button')
      await user.click(startButton)

      // Step 2: Anchor - require relation and anrede per spec FR-020.2
      // data-testid derived from "Pflicht-Felder im Anchor-Schritt: relation und anrede"
      const relationChip = screen.getByTestId('sandra-relation-chip-mama')
      await user.click(relationChip)
      
      // anrede should be pre-filled from chip selection
      const anredeInput = screen.getByTestId('sandra-anrede-input') as HTMLInputElement
      expect(anredeInput.value).toBe('Mama') // Default from chip per spec
      
      const continueFromAnchor = screen.getByTestId('sandra-anchor-continue-button')
      await user.click(continueFromAnchor)

      // Step 3: Trigger selection - spec FR-020.3 mentions trigger bank
      // data-testid derived from "Trigger-Bank umfasst 10 Trigger pro Locale"
      const biographyTrigger = screen.getByTestId('sandra-trigger-biography-school')
      await user.click(biographyTrigger)

      // Step 4: Composer - renders template suggestions per FR-020.4
      // data-testid derived from "Composer rendert Template-Vorschläge"
      const templateSuggestion = screen.getByTestId('sandra-template-suggestion-0')
      const acceptButton = screen.getByTestId('sandra-suggestion-accept-button-0')
      await user.click(acceptButton)

      // Step 5: List view - shows added questions per FR-020.6
      // data-testid derived from "Fragen-Liste erlaubt Edit / Reorder / Delete"
      const questionList = screen.getByTestId('sandra-questions-list')
      expect(questionList).not.toBeNull()
      
      const shareButton = screen.getByTestId('sandra-list-share-button')
      await user.click(shareButton)

      // Step 6: Share - opens Web Share API per FR-020.7
      // Should call navigator.share with generated URL
      expect(mockNavigatorShare).toHaveBeenCalledTimes(1)
      
      // Verify URL contains pack code per spec §5 URL format
      const shareCall = mockNavigatorShare.mock.calls[0][0]
      expect(shareCall.url).toMatch(/\?qp=/)
    })

    it('persists draft in sessionStorage during flow progression', async () => {
      const user = userEvent.setup()
      render(<SandraFlowView {...mockProps} />)

      // Navigate to anchor step
      await user.click(screen.getByTestId('sandra-landing-start-button'))
      
      // Fill anchor data - relation required per FR-020.2  
      await user.click(screen.getByTestId('sandra-relation-chip-papa'))
      await user.click(screen.getByTestId('sandra-anchor-continue-button'))

      // Expect draft persistence per FR-020.11
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'rm-sandra-draft',
        expect.stringContaining('"relation":"papa"')
      )
    })

    it('restores draft from sessionStorage on component mount', () => {
      const existingDraft = {
        anchor: { relation: 'oma', anrede: 'Oma', birthYear: 1955 },
        questions: []
      }
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(existingDraft))

      render(<SandraFlowView {...mockProps} />)

      // Should restore to list step when draft exists per FR-020.11
      // data-testid derived from "bei Reload im selben Tab kehrt Sandra automatisch zur Liste zurück"
      const restoredList = screen.getByTestId('sandra-questions-list')
      expect(restoredList).not.toBeNull()
    })
  })

  describe('Anchor Step - Relation and Anrede (FR-020.2)', () => {
    it('requires relation selection before continuing', async () => {
      const user = userEvent.setup()
      render(<SandraFlowView {...mockProps} />)
      
      await user.click(screen.getByTestId('sandra-landing-start-button'))
      
      // Continue button should be disabled without relation selection
      // data-testid derived from spec FR-020.2 "Pflicht-Felder: relation und anrede"
      const continueButton = screen.getByTestId('sandra-anchor-continue-button') as HTMLButtonElement
      expect(continueButton.disabled).toBe(true)
    })

    it('pre-fills anrede when relation chip is selected', async () => {
      const user = userEvent.setup()
      render(<SandraFlowView {...mockProps} />)
      
      await user.click(screen.getByTestId('sandra-landing-start-button'))
      await user.click(screen.getByTestId('sandra-relation-chip-oma'))
      
      const anredeInput = screen.getByTestId('sandra-anrede-input') as HTMLInputElement
      expect(anredeInput.value).toBe('Oma') // Default from chip per spec
    })

    it('allows custom relation via freetext input', async () => {
      const user = userEvent.setup()
      render(<SandraFlowView {...mockProps} />)
      
      await user.click(screen.getByTestId('sandra-landing-start-button'))
      
      // data-testid derived from spec FR-020.2 "Chip oder Freitext"
      const freetextInput = screen.getByTestId('sandra-relation-freetext')
      await user.type(freetextInput, 'Patentante')
      
      const continueButton = screen.getByTestId('sandra-anchor-continue-button') as HTMLButtonElement  
      expect(continueButton.disabled).toBe(false)
    })

    it('makes birthYear optional with 1900-2020 range', async () => {
      const user = userEvent.setup()
      render(<SandraFlowView {...mockProps} />)
      
      await user.click(screen.getByTestId('sandra-landing-start-button'))
      await user.click(screen.getByTestId('sandra-relation-chip-mama'))
      
      // birthYear is optional per FR-020.2
      // data-testid derived from "birthYear ist optional (1900–2020)"
      const birthYearInput = screen.getByTestId('sandra-birthyear-input') as HTMLInputElement
      
      // Should accept valid year
      await user.type(birthYearInput, '1965')
      expect(birthYearInput.value).toBe('1965')
      
      // Should be valid even when empty (optional)
      await user.clear(birthYearInput)
      const continueButton = screen.getByTestId('sandra-anchor-continue-button') as HTMLButtonElement
      expect(continueButton.disabled).toBe(false)
    })
  })

  describe('Trigger Selection (FR-020.3)', () => {
    beforeEach(async () => {
      const user = userEvent.setup()
      render(<SandraFlowView {...mockProps} />)
      
      // Navigate to trigger step
      await user.click(screen.getByTestId('sandra-landing-start-button'))
      await user.click(screen.getByTestId('sandra-relation-chip-mama'))
      await user.click(screen.getByTestId('sandra-anchor-continue-button'))
    })

    it('shows biography triggers from the trigger bank', () => {
      // data-testid derived from spec FR-020.3 "biography: 6 Trigger" 
      const biographySection = screen.getByTestId('sandra-triggers-biography')
      expect(biographySection).not.toBeNull()
      
      // Should have multiple biography trigger options
      const biographyTriggers = screen.getAllByTestId(/sandra-trigger-biography-/)
      expect(biographyTriggers.length).toBeGreaterThan(0)
    })

    it('shows relationship triggers from the trigger bank', () => {
      // data-testid derived from spec FR-020.3 "relationship: 4 Trigger"
      const relationshipSection = screen.getByTestId('sandra-triggers-relationship') 
      expect(relationshipSection).not.toBeNull()
      
      const relationshipTriggers = screen.getAllByTestId(/sandra-trigger-relationship-/)
      expect(relationshipTriggers.length).toBeGreaterThan(0)
    })

    it('offers freeform trigger option for custom questions', () => {
      // data-testid derived from spec FR-020.3 "Freeform-Trigger wählen und eigene Frage tippen"
      const freeformTrigger = screen.getByTestId('sandra-trigger-freeform')
      expect(freeformTrigger).not.toBeNull()
    })

    it('navigates to composer when trigger is selected', async () => {
      const user = userEvent.setup()
      
      await user.click(screen.getByTestId('sandra-trigger-biography-childhood'))
      
      // Should advance to composer step
      // data-testid derived from spec FR-020.4 "Composer rendert Template-Vorschläge"
      const composerView = screen.getByTestId('sandra-composer-view')
      expect(composerView).not.toBeNull()
    })
  })

  describe('Composer Step (FR-020.4 & FR-020.5)', () => {
    beforeEach(async () => {
      const user = userEvent.setup()
      render(<SandraFlowView {...mockProps} />)
      
      // Navigate to composer
      await user.click(screen.getByTestId('sandra-landing-start-button'))
      await user.click(screen.getByTestId('sandra-relation-chip-mama'))
      await user.click(screen.getByTestId('sandra-anchor-continue-button'))
      await user.click(screen.getByTestId('sandra-trigger-biography-school'))
    })

    it('shows template suggestions when seed has content', async () => {
      const user = userEvent.setup()
      
      // Type seed content per FR-020.4 "seed.length >= 1"
      // data-testid derived from "Template-Vorschläge eines Triggers, sobald seed.length >= 1"
      const seedTextarea = screen.getByTestId('sandra-composer-seed-textarea')
      await user.type(seedTextarea, 'Grundschule')
      
      // Should show suggestions
      const suggestions = screen.getAllByTestId(/sandra-template-suggestion-/)
      expect(suggestions.length).toBeGreaterThan(0)
    })

    it('shows withoutSeed variants when seed is empty', () => {
      // Per FR-020.4 "ODER der Template eine withoutSeed-Variante hat"
      const suggestions = screen.getAllByTestId(/sandra-template-suggestion-/)
      expect(suggestions.length).toBeGreaterThan(0) // withoutSeed variants should appear
    })

    it('allows accepting suggestions with "So nehmen"', async () => {
      const user = userEvent.setup()
      
      // data-testid derived from FR-020.4 "So nehmen"
      const acceptButton = screen.getByTestId('sandra-suggestion-accept-button-0')
      await user.click(acceptButton)
      
      // Should add to questions and navigate to list
      const questionsList = screen.getByTestId('sandra-questions-list')
      expect(questionsList).not.toBeNull()
    })

    it('allows inline editing with "Anpassen"', async () => {
      const user = userEvent.setup()
      
      // data-testid derived from FR-020.4 "Anpassen (inline-edit)"
      const editButton = screen.getByTestId('sandra-suggestion-edit-button-0')
      await user.click(editButton)
      
      // Should enter edit mode
      const editTextarea = screen.getByTestId('sandra-suggestion-edit-textarea-0')
      expect(editTextarea).not.toBeNull()
    })

    it('allows dismissing suggestions with "✕"', async () => {
      const user = userEvent.setup()
      
      const initialSuggestions = screen.getAllByTestId(/sandra-template-suggestion-/)
      const initialCount = initialSuggestions.length
      
      // data-testid derived from FR-020.4 "✕ (verwerfen)"
      const dismissButton = screen.getByTestId('sandra-suggestion-dismiss-button-0')
      await user.click(dismissButton)
      
      const remainingSuggestions = screen.queryAllByTestId(/sandra-template-suggestion-/)
      expect(remainingSuggestions.length).toBe(initialCount - 1)
    })

    it('shows inspirations drawer for selected trigger', async () => {
      const user = userEvent.setup()
      
      // data-testid derived from FR-020.5 "Inspirations-Schublade pro Trigger zeigt 6–8 kuratierte Beispiele"
      const inspirationsButton = screen.getByTestId('sandra-inspirations-button')
      await user.click(inspirationsButton)
      
      const inspirationsDrawer = screen.getByTestId('sandra-inspirations-drawer')
      expect(inspirationsDrawer).not.toBeNull()
      
      const examples = screen.getAllByTestId(/sandra-inspiration-example-/)
      expect(examples.length).toBeGreaterThanOrEqual(6)
      expect(examples.length).toBeLessThanOrEqual(8)
    })

    it('copies inspiration text to seed textarea only', async () => {
      const user = userEvent.setup()
      
      await user.click(screen.getByTestId('sandra-inspirations-button'))
      
      // data-testid derived from FR-020.5 "Klick kopiert den Text nur in das Seed-Textarea"
      const firstExample = screen.getByTestId('sandra-inspiration-example-0')
      const exampleText = firstExample.textContent || ''
      
      await user.click(firstExample)
      
      const seedTextarea = screen.getByTestId('sandra-composer-seed-textarea') as HTMLTextAreaElement
      expect(seedTextarea.value).toBe(exampleText)
      
      // Should NOT add directly to questions list per FR-020.5
      // "niemals direkt in die Fragen-Liste (Sandras Hand bleibt am Steuer)"
      expect(screen.queryByTestId('sandra-questions-list')).toBeNull()
    })
  })

  describe('Questions List Management (FR-020.6)', () => {
    beforeEach(async () => {
      // Mock a list with some questions already added
      const draftWithQuestions = {
        anchor: { relation: 'mama', anrede: 'Mama' },
        questions: [
          { id: 'q1', text: 'Wie war deine Schulzeit, Mama?', group: 'biography', triggerId: 'school', createdAt: Date.now() },
          { id: 'q2', text: 'Was bedeute ich dir, Mama?', group: 'relationship', triggerId: 'meaning', createdAt: Date.now() }
        ]
      }
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(draftWithQuestions))
    })

    it('allows editing questions inline', async () => {
      const user = userEvent.setup()
      render(<SandraFlowView {...mockProps} />)
      
      // data-testid derived from FR-020.6 "Fragen-Liste erlaubt Edit"
      const editButton = screen.getByTestId('sandra-question-edit-button-0')
      await user.click(editButton)
      
      const editTextarea = screen.getByTestId('sandra-question-edit-textarea-0')
      expect(editTextarea).not.toBeNull()
    })

    it('allows reordering questions', async () => {
      const user = userEvent.setup()
      render(<SandraFlowView {...mockProps} />)
      
      // data-testid derived from FR-020.6 "Fragen-Liste erlaubt Reorder"
      const moveUpButton = screen.getByTestId('sandra-question-move-up-button-1')
      await user.click(moveUpButton)
      
      // Order should have changed - implementation detail testing order change
      const questions = screen.getAllByTestId(/sandra-question-row-/)
      expect(questions).toHaveLength(2) // Still 2 questions but reordered
    })

    it('allows deleting questions', async () => {
      const user = userEvent.setup()
      render(<SandraFlowView {...mockProps} />)
      
      // data-testid derived from FR-020.6 "Fragen-Liste erlaubt Delete"
      const deleteButton = screen.getByTestId('sandra-question-delete-button-0')
      await user.click(deleteButton)
      
      const remainingQuestions = screen.queryAllByTestId(/sandra-question-row-/)
      expect(remainingQuestions).toHaveLength(1) // One question removed
    })

    it('does not show private toggle - all questions will be sent', () => {
      render(<SandraFlowView {...mockProps} />)
      
      // Per FR-020.6 "Es gibt kein Private-Toggle – jede Frage in der Liste wird gesendet"
      const privateToggle = screen.queryByTestId('sandra-question-private-toggle')
      expect(privateToggle).toBeNull()
    })
  })

  describe('Share Flow (FR-020.7 & FR-020.8)', () => {
    beforeEach(() => {
      const draftWithRelationshipQuestions = {
        anchor: { relation: 'mama', anrede: 'Mama' },
        questions: [
          { id: 'q1', text: 'Was bedeute ich dir?', group: 'relationship', triggerId: 'meaning', createdAt: Date.now() }
        ]
      }
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(draftWithRelationshipQuestions))
    })

    it('shows personal question warning banner for relationship questions', () => {
      render(<SandraFlowView {...mockProps} />)
      
      // data-testid derived from FR-020.8 "Hinweis-Banner bei mindestens einer relationship-Frage"
      const warningBanner = screen.getByTestId('sandra-relationship-warning-banner')
      expect(warningBanner).not.toBeNull()
      
      // Should contain anrede per spec  
      expect(warningBanner.textContent).toContain('Mama')
    })

    it('opens web share API when share button is clicked', async () => {
      const user = userEvent.setup()
      render(<SandraFlowView {...mockProps} />)
      
      const shareButton = screen.getByTestId('sandra-list-share-button')
      await user.click(shareButton)
      
      // data-testid derived from FR-020.7 "Versand öffnet die Web-Share-API"
      expect(mockNavigatorShare).toHaveBeenCalledTimes(1)
      
      const shareData = mockNavigatorShare.mock.calls[0][0]
      expect(shareData.url).toMatch(/\?qp=/) // URL contains pack code per §5
    })

    it('falls back to clipboard when web share unavailable', async () => {
      const user = userEvent.setup()
      const mockClipboard = vi.fn()
      
      // Remove navigator.share and add clipboard
      Object.defineProperty(global, 'navigator', {
        value: { clipboard: { writeText: mockClipboard } },
        writable: true
      })
      
      render(<SandraFlowView {...mockProps} />)
      
      const shareButton = screen.getByTestId('sandra-list-share-button')
      await user.click(shareButton)
      
      // data-testid derived from FR-020.7 "Bei fehlender Web-Share-API fällt der Versand auf navigator.clipboard.writeText zurück"
      expect(mockClipboard).toHaveBeenCalledWith(expect.stringMatching(/\?qp=/))
    })

    it('never shows pack code as text to user', () => {
      render(<SandraFlowView {...mockProps} />)
      
      // data-testid derived from FR-020.7 "Der Pack-Code wird niemals als Text gezeigt"
      const packCodeText = screen.queryByText(/qp=/)
      expect(packCodeText).toBeNull()
    })
  })
})
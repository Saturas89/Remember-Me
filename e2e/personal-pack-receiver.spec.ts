import { test, expect } from '@playwright/test'
import { de } from '../src/locales/de/ui'

test.describe('Personal Pack Receiver View E2E', () => {
  test.beforeEach(async ({ page, context }) => {
    // Seed context without profile (receiver scenario)
    await context.addInitScript(() => {
      localStorage.setItem('rm-install-dismissed', '1')
      localStorage.setItem('rm-lang', 'de')
      localStorage.setItem('remember-me-state', JSON.stringify({
        profile: null,
        answers: {}, 
        friends: [], 
        friendAnswers: [],
        customQuestions: [], 
        appMode: 'normal'
      }))
    })
  })

  test('Opens personal pack URL and shows auto-suggest modal', async ({ page }) => {
    // Create a sample personal pack URL - using the format from spec §5
    const personalPack = {
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
        }
      ]
    }
    
    // Encode pack as URL parameter per spec format
    const packJson = JSON.stringify(personalPack)
    const base64Pack = btoa(unescape(encodeURIComponent(packJson))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    const packUrl = `/?qp-plain=${base64Pack}`
    
    await page.goto(packUrl)

    // Should show auto-suggest modal per FR-020.9
    // data-testid derived from "Schlägt Vereinfachten Bedienmodus einmalig vor"
    const autoSuggestModal = page.locator('[data-testid="simple-mode-auto-suggest-modal"]')
    await expect(autoSuggestModal).toBeVisible()

    // Should have the large "Ja, einfach machen" button
    // data-testid derived from FR-020.9 "großem 'Ja, einfach machen'-Button"
    const acceptButton = page.locator('[data-testid="simple-mode-accept-button"]')
    await expect(acceptButton).toBeVisible()

    // Should have the smaller "Wie gewohnt" button  
    // data-testid derived from FR-020.9 "kleinem 'Wie gewohnt'-Button"
    const keepNormalButton = page.locator('[data-testid="simple-mode-keep-normal-button"]')
    await expect(keepNormalButton).toBeVisible()

    // Modal should contain reference to simplified mode
    await expect(autoSuggestModal).toContainText('einfach')
  })

  test('Accepts simple mode and enters one-question-at-a-time view', async ({ page }) => {
    const personalPack = {
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
    
    const packJson = JSON.stringify(personalPack)
    const base64Pack = btoa(unescape(encodeURIComponent(packJson))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    
    await page.goto(`/?qp-plain=${base64Pack}`)
    
    // Accept simple mode
    await page.click('[data-testid="simple-mode-accept-button"]')
    
    // Should set app mode to simple 
    await expect(page.locator('html')).toHaveAttribute('data-app-mode', 'simple')

    // Should show gentle header per FR-020.9 "rendert sanften Header"
    // data-testid derived from "Erkennt personalPack === true und rendert sanften Header"
    const gentleHeader = page.locator('[data-testid="personal-pack-gentle-header"]')
    await expect(gentleHeader).toBeVisible()
    await expect(gentleHeader).toContainText('Sandra')

    // Should show one question at a time per FR-020.9 "Stellt Fragen eine nach der anderen"
    // data-testid derived from "eine nach der anderen – kein Listen-Layout"
    const currentQuestion = page.locator('[data-testid="personal-pack-current-question"]')
    await expect(currentQuestion).toBeVisible()
    await expect(currentQuestion).toContainText('Wie war deine Schulzeit, Mama?')

    // Should NOT show other questions simultaneously
    await expect(page.locator('text=Was bedeute ich dir, Mama?')).not.toBeVisible()
    await expect(page.locator('text=Erzähl von deiner Jugend, Mama.')).not.toBeVisible()

    // Should NOT show pack code per FR-020.9 "kein Pack-Code"
    await expect(page.locator('text=/qp-plain=/')).not.toBeVisible()
    await expect(page.locator('text=/qp=/')).not.toBeVisible()

    // Should NOT show edit tools per FR-020.9 "keine Edit-Tools"
    await expect(page.locator('[data-testid="question-edit-button"]')).not.toBeVisible()
    await expect(page.locator('[data-testid="question-delete-button"]')).not.toBeVisible()
  })

  test('Shows large microphone button >= 80x80px', async ({ page }) => {
    const singleQuestionPack = {
      personalPack: true,
      senderName: 'Sandra',
      recipientLabel: 'mama',
      anrede: 'Mama',
      questions: [{
        id: 'q1',
        text: 'Wie war deine Schulzeit, Mama?', 
        type: 'text',
        createdAt: '2024-01-01T00:00:00.000Z'
      }]
    }
    
    const packJson = JSON.stringify(singleQuestionPack)
    const base64Pack = btoa(unescape(encodeURIComponent(packJson))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    
    await page.goto(`/?qp-plain=${base64Pack}`)
    await page.click('[data-testid="simple-mode-accept-button"]')

    // Check microphone button size per FR-020.9 "Großer Mikrofon-Button ≥ 80 × 80 px"
    // data-testid derived from "Großer Mikrofon-Button ≥ 80 × 80 px"
    const micButton = page.locator('[data-testid="personal-pack-mic-button"]')
    await expect(micButton).toBeVisible()

    const boundingBox = await micButton.boundingBox()
    expect(boundingBox).not.toBeNull()
    expect(boundingBox!.width).toBeGreaterThanOrEqual(80)
    expect(boundingBox!.height).toBeGreaterThanOrEqual(80)
  })

  test('Shows progress as dot indicator, not percentages', async ({ page }) => {
    const threeQuestionPack = {
      personalPack: true,
      senderName: 'Sandra', 
      recipientLabel: 'mama',
      anrede: 'Mama',
      questions: [
        { id: 'q1', text: 'Frage 1?', type: 'text', createdAt: '2024-01-01T00:00:00.000Z' },
        { id: 'q2', text: 'Frage 2?', type: 'text', createdAt: '2024-01-01T00:01:00.000Z' },
        { id: 'q3', text: 'Frage 3?', type: 'text', createdAt: '2024-01-01T00:02:00.000Z' }
      ]
    }
    
    const packJson = JSON.stringify(threeQuestionPack)
    const base64Pack = btoa(unescape(encodeURIComponent(packJson))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    
    await page.goto(`/?qp-plain=${base64Pack}`)
    await page.click('[data-testid="simple-mode-accept-button"]')

    // Should show dot progress per FR-020.9 "Progress als Punkt-Indikator (●●○○○), keine Prozente"
    // data-testid derived from "Progress als Punkt-Indikator"
    const progressDots = page.locator('[data-testid="personal-pack-progress-dots"]')
    await expect(progressDots).toBeVisible()

    // Should have proper ARIA attributes per spec §7
    await expect(progressDots).toHaveAttribute('role', 'progressbar')
    await expect(progressDots).toHaveAttribute('aria-valuenow', '1')
    await expect(progressDots).toHaveAttribute('aria-valuemax', '3')

    // Should NOT show percentage text 
    await expect(page.locator('text=/%/')).not.toBeVisible()
    await expect(page.locator('text=/prozent/i')).not.toBeVisible()
  })

  test('Progresses through questions one by one', async ({ page }) => {
    const multiQuestionPack = {
      personalPack: true,
      senderName: 'Sandra',
      recipientLabel: 'mama', 
      anrede: 'Mama',
      questions: [
        { id: 'q1', text: 'Erste Frage, Mama?', type: 'text', createdAt: '2024-01-01T00:00:00.000Z' },
        { id: 'q2', text: 'Zweite Frage, Mama?', type: 'text', createdAt: '2024-01-01T00:01:00.000Z' }
      ]
    }
    
    const packJson = JSON.stringify(multiQuestionPack)
    const base64Pack = btoa(unescape(encodeURIComponent(packJson))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    
    await page.goto(`/?qp-plain=${base64Pack}`)
    await page.click('[data-testid="simple-mode-accept-button"]')

    // Should show first question
    await expect(page.locator('[data-testid="personal-pack-current-question"]')).toContainText('Erste Frage, Mama?')

    // Answer first question
    // data-testid derived from receiver answer input
    const answerTextarea = page.locator('[data-testid="personal-pack-answer-textarea"]')
    await answerTextarea.fill('Antwort auf erste Frage.')

    // Progress to next question
    // data-testid derived from next question navigation
    await page.click('[data-testid="personal-pack-next-button"]')

    // Should now show second question
    await expect(page.locator('[data-testid="personal-pack-current-question"]')).toContainText('Zweite Frage, Mama?')

    // Progress dots should update
    const progressDots = page.locator('[data-testid="personal-pack-progress-dots"]')
    await expect(progressDots).toHaveAttribute('aria-valuenow', '2')
    await expect(progressDots).toHaveAttribute('aria-valuemax', '2')
  })

  test('Completes flow and submits all answers', async ({ page }) => {
    const singleQuestionPack = {
      personalPack: true,
      senderName: 'Sandra',
      recipientLabel: 'mama',
      anrede: 'Mama',
      questions: [{
        id: 'q1',
        text: 'Was war dein schönster Moment, Mama?',
        type: 'text', 
        createdAt: '2024-01-01T00:00:00.000Z'
      }]
    }
    
    const packJson = JSON.stringify(singleQuestionPack)
    const base64Pack = btoa(unescape(encodeURIComponent(packJson))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    
    await page.goto(`/?qp-plain=${base64Pack}`)
    await page.click('[data-testid="simple-mode-accept-button"]')

    // Fill name field if present
    const nameInput = page.locator('[data-testid="personal-pack-recipient-name"]')
    if (await nameInput.isVisible()) {
      await nameInput.fill('Ingrid')
    }

    // Answer the question
    await page.fill('[data-testid="personal-pack-answer-textarea"]', 'Mein schönster Moment war deine Geburt.')

    // Submit (this would be the final submit button for last question)
    // data-testid derived from final submission action  
    const submitButton = page.locator('[data-testid="personal-pack-submit-button"]')
    await expect(submitButton).toBeVisible()
    
    // Click submit - in real implementation this would call onSubmit callback
    // For E2E we just verify the button is present and clickable
    await submitButton.click()

    // Should show completion or thank you message
    // data-testid derived from completion state after all questions answered
    const completionMessage = page.locator('[data-testid="personal-pack-completion"]')
    await expect(completionMessage).toBeVisible()
  })

  test('Declines simple mode and still shows welcome', async ({ page }) => {
    const personalPack = {
      personalPack: true,
      senderName: 'Sandra',
      recipientLabel: 'mama',
      anrede: 'Mama',
      questions: [{
        id: 'q1',
        text: 'Wie war deine Schulzeit, Mama?',
        type: 'text',
        createdAt: '2024-01-01T00:00:00.000Z'
      }]
    }
    
    const packJson = JSON.stringify(personalPack)
    const base64Pack = btoa(unescape(encodeURIComponent(packJson))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    
    await page.goto(`/?qp-plain=${base64Pack}`)

    // Decline simple mode
    await page.click('[data-testid="simple-mode-keep-normal-button"]')

    // Should NOT set app mode to simple
    await expect(page.locator('html')).not.toHaveAttribute('data-app-mode', 'simple')

    // Should still show gentle header with sender info
    const gentleHeader = page.locator('[data-testid="personal-pack-gentle-header"]')
    await expect(gentleHeader).toBeVisible()
    await expect(gentleHeader).toContainText('Sandra')

    // Auto-suggest modal should be dismissed
    await expect(page.locator('[data-testid="simple-mode-auto-suggest-modal"]')).not.toBeVisible()
  })

  test('Handles keyboard navigation correctly', async ({ page }) => {
    const personalPack = {
      personalPack: true,
      senderName: 'Sandra', 
      recipientLabel: 'mama',
      anrede: 'Mama',
      questions: [{
        id: 'q1',
        text: 'Wie war deine Schulzeit, Mama?',
        type: 'text',
        createdAt: '2024-01-01T00:00:00.000Z'
      }]
    }
    
    const packJson = JSON.stringify(personalPack)
    const base64Pack = btoa(unescape(encodeURIComponent(packJson))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    
    await page.goto(`/?qp-plain=${base64Pack}`)
    await page.click('[data-testid="simple-mode-accept-button"]')

    // Focus on answer textarea
    const textarea = page.locator('[data-testid="personal-pack-answer-textarea"]')
    await textarea.focus()

    // Type answer with enter - should create line break, not submit per spec §7
    await textarea.fill('Erste Zeile')
    await page.keyboard.press('Enter')
    await textarea.type('Zweite Zeile')

    const textareaValue = await textarea.inputValue()
    expect(textareaValue).toContain('\n') // Should contain line break

    // Should still be on the same question (not submitted by Enter)
    await expect(page.locator('[data-testid="personal-pack-current-question"]')).toContainText('Wie war deine Schulzeit, Mama?')
  })

  test('Touch targets meet accessibility requirements', async ({ page }) => {
    const personalPack = {
      personalPack: true,
      senderName: 'Sandra',
      recipientLabel: 'mama', 
      anrede: 'Mama',
      questions: [{
        id: 'q1',
        text: 'Wie war deine Schulzeit, Mama?',
        type: 'text',
        createdAt: '2024-01-01T00:00:00.000Z'
      }]
    }
    
    const packJson = JSON.stringify(personalPack)
    const base64Pack = btoa(unescape(encodeURIComponent(packJson))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    
    await page.goto(`/?qp-plain=${base64Pack}`)
    await page.click('[data-testid="simple-mode-accept-button"]')

    // Check all interactive elements meet 44x44px minimum per spec §7
    const interactiveElements = [
      '[data-testid="personal-pack-mic-button"]',
      '[data-testid="personal-pack-next-button"]',
      '[data-testid="personal-pack-submit-button"]'
    ]

    for (const selector of interactiveElements) {
      const element = page.locator(selector)
      if (await element.isVisible()) {
        const box = await element.boundingBox()
        expect(box).not.toBeNull()
        expect(box!.width).toBeGreaterThanOrEqual(44)
        expect(box!.height).toBeGreaterThanOrEqual(44)
      }
    }
  })
})
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup, screen } from '@testing-library/react'
import { AppModeProvider } from '../hooks/useAppMode'
import { PersonalPackReceiveView } from './PersonalPackReceiveView'
import type { PersonalQuestionPack } from '../types/sandraFlow'
import type { AppMode } from '../types'

// ─────────────────────────────────────────────────────────────────────────────
// PersonalPackReceiveView – Ingrid's receiver experience.
//
// Coverage:
//   1. Welcome header substitutes pack.senderName + question count
//      (regression for the decodeQuestionPack metadata-dropping bug)
//   2. Auto-suggest phase shown when appMode !== 'simple'
//   3. Auto-suggest phase skipped when appMode === 'simple'
//   4. "Ja, einfach machen" activates simple mode + advances to welcome
//   5. "Wie gewohnt" advances to welcome WITHOUT activating simple mode
//   6. Start CTA disabled until recipient types a name
//   7. One question rendered at a time (not as list)
//   8. Submit calls onSubmit with collected, trimmed, filtered answers
//   9. Submit falls back to pack.recipientLabel when name field is empty
//  10. onDismiss is invoked when the back button is pressed on welcome
// ─────────────────────────────────────────────────────────────────────────────

afterEach(cleanup)

function makePack(overrides: Partial<PersonalQuestionPack> = {}): PersonalQuestionPack {
  return {
    questions: [
      { id: 'q1', text: 'Wie war deine Schulzeit, Mama?', type: 'text', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'q2', text: 'Was bedeute ich dir, Mama?', type: 'text', createdAt: '2026-01-01T00:00:00.000Z' },
    ],
    createdBy: 'Sandra',
    personalPack: true,
    senderName: 'Sandra',
    recipientLabel: 'mama',
    anrede: 'Mama',
    ...overrides,
  }
}

type OnSubmit = (
  recipientName: string,
  answers: Array<{ questionId: string; questionText: string; value: string }>,
) => void

function renderWith(
  pack: PersonalQuestionPack,
  appMode: AppMode | undefined = 'full',
) {
  const onSubmit = vi.fn<OnSubmit>()
  const onDismiss = vi.fn<() => void>()
  const setAppMode = vi.fn<(mode: AppMode) => void>()
  const utils = render(
    <AppModeProvider appMode={appMode} setAppMode={setAppMode}>
      <PersonalPackReceiveView pack={pack} onSubmit={onSubmit} onDismiss={onDismiss} />
    </AppModeProvider>,
  )
  return { ...utils, onSubmit, onDismiss, setAppMode }
}

describe('PersonalPackReceiveView', () => {
  describe('Welcome header (FR-020.9 / decodeQuestionPack roundtrip)', () => {
    it('substitutes pack.senderName into the welcome title', () => {
      const { container } = renderWith(makePack({ senderName: 'Sandra' }), 'simple')
      const title = container.querySelector('.sandra-receive__title')
      expect(title?.textContent).toContain('Sandra')
      // Regression: never let the literal placeholder leak through.
      expect(title?.textContent).not.toContain('{senderName}')
      expect(title?.textContent).not.toContain('undefined')
    })

    it('substitutes the question count into the welcome title', () => {
      const { container } = renderWith(makePack(), 'simple')
      const title = container.querySelector('.sandra-receive__title')
      expect(title?.textContent).toContain('2')
      expect(title?.textContent).not.toContain('{n}')
    })
  })

  describe('Simple-mode auto-suggest removed (issue #260)', () => {
    it('skips auto-suggest and shows name entry directly for any appMode', () => {
      renderWith(makePack(), 'full')
      expect(screen.queryByTestId('sandra-receive-simple-yes')).toBeNull()
      expect(screen.getByTestId('sandra-receive-name')).toBeTruthy()
    })

    it('skips auto-suggest when appMode is "simple"', () => {
      renderWith(makePack(), 'simple')
      expect(screen.queryByTestId('sandra-receive-simple-yes')).toBeNull()
      expect(screen.getByTestId('sandra-receive-name')).toBeTruthy()
    })

    it('activates simple mode on mount when pack.preferSimpleMode is true', () => {
      const { setAppMode } = renderWith(makePack({ preferSimpleMode: true }), 'full')
      expect(setAppMode).toHaveBeenCalledWith('simple')
    })
  })

  describe('Welcome → quiz transition', () => {
    it('disables the start CTA until the recipient enters a name', () => {
      renderWith(makePack(), 'simple')
      const start = screen.getByTestId('sandra-receive-start') as HTMLButtonElement
      expect(start.disabled).toBe(true)
      fireEvent.change(screen.getByTestId('sandra-receive-name'), { target: { value: 'Ingrid' } })
      expect(start.disabled).toBe(false)
    })

    it('opens the quiz on a single-question-at-a-time view', () => {
      const { container } = renderWith(makePack(), 'simple')
      fireEvent.change(screen.getByTestId('sandra-receive-name'), { target: { value: 'Ingrid' } })
      fireEvent.click(screen.getByTestId('sandra-receive-start'))

      // First question visible, second NOT in the DOM (no list layout).
      expect(container.textContent).toContain('Wie war deine Schulzeit, Mama?')
      expect(container.textContent).not.toContain('Was bedeute ich dir, Mama?')
      expect(screen.getByTestId('sandra-receive-answer')).toBeTruthy()
    })
  })

  describe('Submit (API contract for parent component)', () => {
    function answerAll(answers: string[], appMode: AppMode = 'simple') {
      const ctx = renderWith(makePack(), appMode)
      fireEvent.change(screen.getByTestId('sandra-receive-name'), { target: { value: 'Ingrid' } })
      fireEvent.click(screen.getByTestId('sandra-receive-start'))
      for (const value of answers) {
        fireEvent.change(screen.getByTestId('sandra-receive-answer'), { target: { value } })
        fireEvent.click(screen.getByTestId('sandra-receive-continue'))
      }
      return ctx
    }

    it('passes the recipient name + trimmed/filtered answers to onSubmit', () => {
      const { onSubmit } = answerAll(['  Schöne Erinnerungen  ', 'Sehr viel.'])
      expect(onSubmit).toHaveBeenCalledTimes(1)
      const [name, collected] = onSubmit.mock.calls[0]
      expect(name).toBe('Ingrid')
      expect(collected).toEqual([
        { questionId: 'q1', questionText: 'Wie war deine Schulzeit, Mama?', value: 'Schöne Erinnerungen' },
        { questionId: 'q2', questionText: 'Was bedeute ich dir, Mama?', value: 'Sehr viel.' },
      ])
    })

    it('drops empty answers (skipped questions stay out of the payload)', () => {
      const { onSubmit } = renderWith(makePack(), 'simple')
      fireEvent.change(screen.getByTestId('sandra-receive-name'), { target: { value: 'Ingrid' } })
      fireEvent.click(screen.getByTestId('sandra-receive-start'))
      // Skip Q1, then answer Q2 — the final continue-click submits directly.
      fireEvent.click(screen.getByTestId('sandra-receive-skip'))
      fireEvent.change(screen.getByTestId('sandra-receive-answer'), { target: { value: 'Sehr viel.' } })
      fireEvent.click(screen.getByTestId('sandra-receive-continue'))

      const [, collected] = onSubmit.mock.calls[0]
      expect(collected).toHaveLength(1)
      expect(collected[0]).toEqual({
        questionId: 'q2',
        questionText: 'Was bedeute ich dir, Mama?',
        value: 'Sehr viel.',
      })
    })
  })
})

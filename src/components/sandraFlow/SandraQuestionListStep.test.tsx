import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { SandraQuestionListStep } from './SandraQuestionListStep'
import { SANDRA_FLOW_DE } from '../../i18n/de/sandraFlow'
import { SANDRA_FLOW_EN } from '../../i18n/en/sandraFlow'
import type { ComposedQuestion, SandraAnchor } from '../../types/sandraFlow'

// ─────────────────────────────────────────────────────────────────────────────
// SandraQuestionListStep – Screen 5 of Sandra-Flow.
//
// Implementation Agent contract (SandraQuestionListStep.tsx):
//   props: { t, anchor, questions, onBack, onAddAnother, onEdit, onDelete,
//            onMove, onSend }
//   Send button:    data-testid="sandra-list-send"   (disabled when empty)
//   Add another:    data-testid="sandra-list-add-another"
//   Delete per row: data-testid="sandra-list-delete-{id}"  (uses window.confirm)
//
// SPEC contract (§4 Screen 5 + §0):
//   - Question cards with text + trigger chip
//   - NO private toggle anywhere
//   - Send button disabled when list empty, enabled with ≥1 question
//   - Send label „An {anrede} schicken" / „Send to {anrede}"
//   - Works in both DE and EN
// ─────────────────────────────────────────────────────────────────────────────

afterEach(cleanup)

function makeQ(
  id: string,
  group: 'biography' | 'relationship' = 'biography',
  text = 'Wie war deine Schulzeit, Mama?',
): ComposedQuestion {
  return {
    id,
    triggerId: 'school',
    group,
    text,
    createdAt: Date.now(),
  }
}

const ANCHOR: SandraAnchor = { relation: 'mama', anrede: 'Mama' }

function makeProps(
  overrides: Partial<React.ComponentProps<typeof SandraQuestionListStep>> = {},
): React.ComponentProps<typeof SandraQuestionListStep> {
  return {
    t: SANDRA_FLOW_DE,
    anchor: ANCHOR,
    questions: [],
    onBack: vi.fn(),
    onAddAnother: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onMove: vi.fn(),
    onSend: vi.fn(),
    ...overrides,
  }
}

describe('SandraQuestionListStep – rendering', () => {
  it('renders the title with the anrede slot substituted', () => {
    const qs = [makeQ('q1', 'biography', 'Frage A')]
    const { container } = render(<SandraQuestionListStep {...makeProps({ questions: qs })} />)
    // DE title: "Deine Fragen für Mama"
    expect(container.textContent ?? '').toContain('Mama')
  })

  it('renders one row per question with the question text', () => {
    const qs = [
      makeQ('q1', 'biography', 'Frage A – Schulzeit?'),
      makeQ('q2', 'relationship', 'Frage B – Wie siehst du mich?'),
    ]
    const { container, getByText } = render(
      <SandraQuestionListStep {...makeProps({ questions: qs })} />,
    )
    expect(getByText('Frage A – Schulzeit?')).toBeTruthy()
    expect(getByText('Frage B – Wie siehst du mich?')).toBeTruthy()
    expect(container.querySelectorAll('.sandra-question-row').length).toBe(2)
  })

  it('renders a trigger chip per row (one of "Über uns zwei" / "Über sie/ihn")', () => {
    const qs = [
      makeQ('q1', 'biography'),
      makeQ('q2', 'relationship'),
    ]
    const { container } = render(<SandraQuestionListStep {...makeProps({ questions: qs })} />)
    const chips = container.querySelectorAll('.sandra-question-row__chip')
    expect(chips.length).toBe(2)
    const chipTexts = Array.from(chips).map(c => c.textContent)
    expect(chipTexts).toEqual(
      expect.arrayContaining([SANDRA_FLOW_DE.trigger.sectionAboutThem, SANDRA_FLOW_DE.trigger.sectionAboutUs]),
    )
  })

  it('renders NO private toggle anywhere in the DOM (regression guard)', () => {
    const qs = [makeQ('q1'), makeQ('q2', 'relationship')]
    const { container } = render(<SandraQuestionListStep {...makeProps({ questions: qs })} />)

    // No checkbox / switch in the question list.
    expect(container.querySelector('input[type="checkbox"]')).toBeNull()
    expect(container.querySelector('[role="switch"]')).toBeNull()
    // No test-id that implies a private toggle.
    expect(container.querySelector('[data-testid*="private"]')).toBeNull()

    // No textual mention of "privat" / "private" in button labels.
    for (const btn of Array.from(container.querySelectorAll('button'))) {
      const label = (btn.getAttribute('aria-label') ?? '') + ' ' + (btn.textContent ?? '')
      expect(label).not.toMatch(/privat/i)
      expect(label).not.toMatch(/private/i)
    }
  })

  it('shows the empty hint when the questions list is empty', () => {
    const { container } = render(<SandraQuestionListStep {...makeProps({ questions: [] })} />)
    expect(container.textContent ?? '').toContain(SANDRA_FLOW_DE.list.emptyHint)
  })
})

describe('SandraQuestionListStep – send button state', () => {
  it('disables the send button when no questions exist', () => {
    const { container } = render(<SandraQuestionListStep {...makeProps({ questions: [] })} />)
    const send = container.querySelector<HTMLButtonElement>('[data-testid="sandra-list-send"]')
    expect(send).not.toBeNull()
    expect(send!.disabled).toBe(true)
  })

  it('enables the send button when at least one question is added', () => {
    const qs = [makeQ('q1')]
    const { container } = render(<SandraQuestionListStep {...makeProps({ questions: qs })} />)
    const send = container.querySelector<HTMLButtonElement>('[data-testid="sandra-list-send"]')
    expect(send!.disabled).toBe(false)
  })

  it('the send button label contains the DE anrede (default: „An Mama schicken")', () => {
    const qs = [makeQ('q1')]
    const { container } = render(
      <SandraQuestionListStep {...makeProps({ questions: qs, anchor: { relation: 'mama', anrede: 'Mama' } })} />,
    )
    const send = container.querySelector<HTMLButtonElement>('[data-testid="sandra-list-send"]')
    expect(send!.textContent ?? '').toContain('Mama')
  })

  it('clicking the send button invokes onSend exactly once', () => {
    const onSend = vi.fn()
    const qs = [makeQ('q1')]
    const { container } = render(<SandraQuestionListStep {...makeProps({ questions: qs, onSend })} />)
    const send = container.querySelector<HTMLButtonElement>('[data-testid="sandra-list-send"]')!
    fireEvent.click(send)
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('clicking the disabled empty-state send button does NOT invoke onSend', () => {
    const onSend = vi.fn()
    const { container } = render(<SandraQuestionListStep {...makeProps({ questions: [], onSend })} />)
    const send = container.querySelector<HTMLButtonElement>('[data-testid="sandra-list-send"]')!
    fireEvent.click(send)
    expect(onSend).not.toHaveBeenCalled()
  })
})

describe('SandraQuestionListStep – delete + reorder', () => {
  it('invokes onDelete with the question id when the delete button is confirmed', () => {
    const onDelete = vi.fn()
    const qs = [makeQ('q1'), makeQ('q2')]
    // Component uses window.confirm before delegating to onDelete.
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { container } = render(<SandraQuestionListStep {...makeProps({ questions: qs, onDelete })} />)
    const deleteBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="sandra-list-delete-q1"]',
    )
    expect(deleteBtn).not.toBeNull()
    fireEvent.click(deleteBtn!)
    expect(onDelete).toHaveBeenCalledWith('q1')
    confirmSpy.mockRestore()
  })

  it('does NOT invoke onDelete when the user cancels the confirm dialog', () => {
    const onDelete = vi.fn()
    const qs = [makeQ('q1')]
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { container } = render(<SandraQuestionListStep {...makeProps({ questions: qs, onDelete })} />)
    fireEvent.click(container.querySelector('[data-testid="sandra-list-delete-q1"]')!)
    expect(onDelete).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('clicking the "Add another" button invokes onAddAnother', () => {
    const onAddAnother = vi.fn()
    const { container } = render(<SandraQuestionListStep {...makeProps({ onAddAnother })} />)
    const btn = container.querySelector<HTMLButtonElement>('[data-testid="sandra-list-add-another"]')
    expect(btn).not.toBeNull()
    fireEvent.click(btn!)
    expect(onAddAnother).toHaveBeenCalledTimes(1)
  })

  it('the up-arrow button is disabled on the first row', () => {
    const qs = [makeQ('q1'), makeQ('q2')]
    const { container } = render(<SandraQuestionListStep {...makeProps({ questions: qs })} />)
    const upButtons = container.querySelectorAll<HTMLButtonElement>(
      `button[aria-label="${SANDRA_FLOW_DE.list.moveUpAria}"]`,
    )
    expect(upButtons.length).toBeGreaterThanOrEqual(1)
    expect(upButtons[0].disabled).toBe(true)
  })

  it('the down-arrow button is disabled on the last row', () => {
    const qs = [makeQ('q1'), makeQ('q2')]
    const { container } = render(<SandraQuestionListStep {...makeProps({ questions: qs })} />)
    const downButtons = container.querySelectorAll<HTMLButtonElement>(
      `button[aria-label="${SANDRA_FLOW_DE.list.moveDownAria}"]`,
    )
    expect(downButtons.length).toBeGreaterThanOrEqual(1)
    expect(downButtons[downButtons.length - 1].disabled).toBe(true)
  })

  it('clicking the down-arrow on the first row calls onMove with (id, 1)', () => {
    const onMove = vi.fn()
    const qs = [makeQ('q1'), makeQ('q2')]
    const { container } = render(<SandraQuestionListStep {...makeProps({ questions: qs, onMove })} />)
    const downButtons = container.querySelectorAll<HTMLButtonElement>(
      `button[aria-label="${SANDRA_FLOW_DE.list.moveDownAria}"]`,
    )
    fireEvent.click(downButtons[0])
    expect(onMove).toHaveBeenCalledWith('q1', 1)
  })
})

describe('SandraQuestionListStep – locale rendering', () => {
  it('renders EN labels when given the EN strings bundle', () => {
    const qs = [makeQ('q1')]
    const { container } = render(
      <SandraQuestionListStep
        {...makeProps({ questions: qs, t: SANDRA_FLOW_EN, anchor: { relation: 'mama', anrede: 'Mom' } })}
      />,
    )
    const send = container.querySelector<HTMLButtonElement>('[data-testid="sandra-list-send"]')!
    // EN send label should mention "Mom" (and not contain German "An … schicken")
    expect(send.textContent ?? '').toContain('Mom')
  })

  it('renders DE labels when given the DE strings bundle (default)', () => {
    const qs = [makeQ('q1')]
    const { container } = render(<SandraQuestionListStep {...makeProps({ questions: qs })} />)
    const send = container.querySelector<HTMLButtonElement>('[data-testid="sandra-list-send"]')!
    expect(send.textContent ?? '').toMatch(/schicken/i)
  })
})

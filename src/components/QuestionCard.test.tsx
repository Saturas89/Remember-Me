import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup, screen } from '@testing-library/react'
import { QuestionCard } from './QuestionCard'
import type { Question } from '../types'

afterEach(cleanup)

// ── MediaCapture uses useAudioRecorder which touches navigator.mediaDevices.
//    Stub it out so tests focus on QuestionCard itself.
vi.mock('./MediaCapture', () => ({
  MediaCapture: ({ currentValue }: { currentValue?: string }) => (
    <div data-testid="media-capture-stub">{currentValue ?? ''}</div>
  ),
}))

const textQuestion: Question = {
  id: 'q-text',
  categoryId: 'childhood',
  type: 'text',
  text: 'Was war dein schönster Moment?',
  helpText: 'Denk an Details.',
}

const choiceQuestion: Question = {
  id: 'q-choice',
  categoryId: 'childhood',
  type: 'choice',
  text: 'Wähle eine Jahreszeit',
  options: ['Frühling', 'Sommer', 'Herbst', 'Winter'],
}

const scaleQuestion: Question = {
  id: 'q-scale',
  categoryId: 'childhood',
  type: 'scale',
  text: 'Wie intensiv?',
  scaleMin: 'gar nicht',
  scaleMax: 'sehr',
}

const yearQuestion: Question = {
  id: 'q-year',
  categoryId: 'childhood',
  type: 'year',
  text: 'In welchem Jahr?',
}

function defaultProps(overrides: Partial<React.ComponentProps<typeof QuestionCard>> = {}) {
  return {
    question: textQuestion,
    initialValue: '',
    imageIds: [],
    imageCache: {},
    videoIds: [],
    audioId: undefined,
    index: 0,
    total: 10,
    onSave: vi.fn(),
    onLoadImages: vi.fn(),
    onAddImage: vi.fn(),
    onRemoveImage: vi.fn(),
    onAddVideo: vi.fn(),
    onRemoveVideo: vi.fn(),
    onSaveAudio: vi.fn(async () => {}),
    onRemoveAudio: vi.fn(),
    onNext: vi.fn(),
    onPrev: vi.fn(),
    canGoBack: false,
    ...overrides,
  }
}

describe('QuestionCard', () => {
  it('renders the question text, help text and the "Frage x von y" meta', () => {
    render(<QuestionCard {...defaultProps({ index: 2, total: 7 })} />)
    expect(screen.getByText('Was war dein schönster Moment?')).toBeTruthy()
    expect(screen.getByText('Denk an Details.')).toBeTruthy()
    expect(screen.getByText('Frage 3 von 7')).toBeTruthy()
  })

  it('shows the Weiter button for non-final questions and Fertig on the last one', () => {
    const props = defaultProps({ index: 0, total: 3 })
    const { rerender } = render(<QuestionCard {...props} />)
    expect(screen.getByRole('button', { name: /Weiter/ })).toBeTruthy()
    rerender(<QuestionCard {...defaultProps({ index: 2, total: 3 })} />)
    expect(screen.getByRole('button', { name: /Fertig/ })).toBeTruthy()
  })

  it('persists each keystroke via onSave (live save)', () => {
    const onSave = vi.fn()
    render(<QuestionCard {...defaultProps({ onSave })} />)
    const textarea = screen.getByPlaceholderText('Deine Antwort…') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Sommer 1985' } })
    expect(onSave).toHaveBeenLastCalledWith('Sommer 1985')
    expect(textarea.value).toBe('Sommer 1985')
  })

  it('hydrates the textarea from initialValue', () => {
    render(<QuestionCard {...defaultProps({ initialValue: 'bestehend' })} />)
    const textarea = screen.getByPlaceholderText('Deine Antwort…') as HTMLTextAreaElement
    expect(textarea.value).toBe('bestehend')
  })

  it('re-hydrates when the question changes (so stale text is not shown)', () => {
    const { rerender } = render(
      <QuestionCard {...defaultProps({ initialValue: 'Antwort A' })} />,
    )
    const next: Question = { ...textQuestion, id: 'q-other', text: 'andere Frage' }
    rerender(<QuestionCard {...defaultProps({ question: next, initialValue: 'Antwort B' })} />)
    const textarea = screen.getByPlaceholderText('Deine Antwort…') as HTMLTextAreaElement
    expect(textarea.value).toBe('Antwort B')
  })

  it('shows the skip link while the answer is empty, and hides it once text is typed', () => {
    const { container } = render(<QuestionCard {...defaultProps()} />)
    expect(container.querySelector('.question-card__skip')).not.toBeNull()

    const textarea = screen.getByPlaceholderText('Deine Antwort…') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'something' } })
    expect(container.querySelector('.question-card__skip')).toBeNull()
  })

  it('hides the skip link when media is attached even if text is empty', () => {
    const { container } = render(
      <QuestionCard {...defaultProps({ imageIds: ['img-1'] })} />,
    )
    expect(container.querySelector('.question-card__skip')).toBeNull()
  })

  it('disables the Zurück button on the first question and enables it once canGoBack is true', () => {
    const { rerender } = render(<QuestionCard {...defaultProps()} />)
    expect((screen.getByRole('button', { name: /Zurück/ }) as HTMLButtonElement).disabled).toBe(true)
    rerender(<QuestionCard {...defaultProps({ canGoBack: true })} />)
    expect((screen.getByRole('button', { name: /Zurück/ }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('invokes onNext and onPrev when navigation buttons are clicked', () => {
    const onNext = vi.fn()
    const onPrev = vi.fn()
    render(<QuestionCard {...defaultProps({ onNext, onPrev, canGoBack: true })} />)
    fireEvent.click(screen.getByRole('button', { name: /Weiter/ }))
    fireEvent.click(screen.getByRole('button', { name: /Zurück/ }))
    expect(onNext).toHaveBeenCalledOnce()
    expect(onPrev).toHaveBeenCalledOnce()
  })

  it('renders choice options and saves the selected value', () => {
    const onSave = vi.fn()
    render(<QuestionCard {...defaultProps({ question: choiceQuestion, onSave })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Sommer' }))
    expect(onSave).toHaveBeenCalledWith('Sommer')
  })

  it('visually marks the currently selected choice', () => {
    const { container } = render(
      <QuestionCard {...defaultProps({ question: choiceQuestion, initialValue: 'Winter' })} />,
    )
    const winter = [...container.querySelectorAll('.choice-btn')].find(b => b.textContent === 'Winter')
    expect(winter?.className).toContain('choice-btn--selected')
  })

  it('renders a 1–5 scale with labels for min and max', () => {
    render(<QuestionCard {...defaultProps({ question: scaleQuestion })} />)
    expect(screen.getByText('gar nicht')).toBeTruthy()
    expect(screen.getByText('sehr')).toBeTruthy()
    for (const n of [1, 2, 3, 4, 5]) {
      expect(screen.getByRole('button', { name: String(n) })).toBeTruthy()
    }
  })

  it('saves a scale selection as its string representation', () => {
    const onSave = vi.fn()
    render(<QuestionCard {...defaultProps({ question: scaleQuestion, onSave })} />)
    fireEvent.click(screen.getByRole('button', { name: '4' }))
    expect(onSave).toHaveBeenCalledWith('4')
  })

  it('renders a year input with number type and year-range bounds', () => {
    const { container } = render(<QuestionCard {...defaultProps({ question: yearQuestion })} />)
    const input = container.querySelector('input.input-year') as HTMLInputElement
    expect(input.type).toBe('number')
    expect(input.min).toBe('1900')
    expect(input.max).toBe('2100')
  })

  it('saves year edits through onSave', () => {
    const onSave = vi.fn()
    render(<QuestionCard {...defaultProps({ question: yearQuestion, onSave })} />)
    const input = document.querySelector('input.input-year') as HTMLInputElement
    fireEvent.change(input, { target: { value: '1999' } })
    expect(onSave).toHaveBeenLastCalledWith('1999')
  })
})

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { CustomQuestionsView } from './CustomQuestionsView'
import type { CustomQuestion } from '../types'

vi.mock('../hooks/useImageStore', () => ({
  useImageStore: () => ({ cache: {}, loadImages: vi.fn(), addImage: vi.fn(), removeImage: vi.fn() }),
}))
vi.mock('../hooks/useAudioStore', () => ({ addAudio: vi.fn(), removeAudio: vi.fn() }))
vi.mock('../hooks/useVideoStore', () => ({ addVideo: vi.fn(), removeVideo: vi.fn() }))
vi.mock('../components/MediaCapture', () => ({ MediaCapture: () => null }))

// ── Helpers ───────────────────────────────────────────────────────────────────

const Q1: CustomQuestion = {
  id: 'q-1',
  text: 'Lieblingsort',
  type: 'text',
  createdAt: '2024-01-01T00:00:00.000Z',
}

function makeProps(overrides: Partial<Parameters<typeof CustomQuestionsView>[0]> = {}) {
  return {
    customQuestions: [Q1] as CustomQuestion[],
    profileName: 'Anna',
    getAnswer: vi.fn(() => ''),
    getAnswerImageIds: vi.fn((): string[] => []),
    getAnswerVideoIds: vi.fn((): string[] => []),
    getAnswerAudioId: vi.fn((): string | undefined => undefined),
    onSave: vi.fn(),
    onSetImages: vi.fn(),
    onSetVideos: vi.fn(),
    onSetAudio: vi.fn(),
    onAdd: vi.fn((): CustomQuestion => ({ id: 'new', text: 'New', type: 'text', createdAt: '' })),
    onRemove: vi.fn(),
    onBack: vi.fn(),
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('CustomQuestionsView – Frage hinzufügen', () => {
  it('ruft onAdd auf wenn Text eingegeben und auf Hinzufügen geklickt wird', () => {
    const onAdd = vi.fn((): CustomQuestion => ({ id: 'new', text: 'Test', type: 'text', createdAt: '' }))
    const { container } = render(<CustomQuestionsView {...makeProps({ onAdd })} />)
    const input = container.querySelector<HTMLInputElement>('.input-text')!
    fireEvent.change(input, { target: { value: 'Neue Frage' } })
    fireEvent.click(container.querySelector('.btn--primary')!)
    expect(onAdd).toHaveBeenCalledWith('Neue Frage', 'text')
  })

  it('Hinzufügen-Button ist deaktiviert wenn kein Text eingegeben ist', () => {
    const { container } = render(<CustomQuestionsView {...makeProps()} />)
    const btn = container.querySelector<HTMLButtonElement>('.btn--primary')!
    expect(btn.disabled).toBe(true)
  })

  it('Enter-Taste ruft onAdd auf', () => {
    const onAdd = vi.fn((): CustomQuestion => ({ id: 'new', text: 'Test', type: 'text', createdAt: '' }))
    const { container } = render(<CustomQuestionsView {...makeProps({ onAdd })} />)
    const input = container.querySelector<HTMLInputElement>('.input-text')!
    fireEvent.change(input, { target: { value: 'Per Enter' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onAdd).toHaveBeenCalledWith('Per Enter', 'text')
  })
})

describe('CustomQuestionsView – Frage löschen', () => {
  it('ruft onRemove mit der richtigen ID auf', () => {
    const onRemove = vi.fn()
    const { container } = render(<CustomQuestionsView {...makeProps({ onRemove })} />)
    fireEvent.click(container.querySelector('.custom-q-delete')!)
    expect(onRemove).toHaveBeenCalledWith('q-1')
  })
})

describe('CustomQuestionsView – Fragenliste', () => {
  it('zeigt Fragentext in der Liste an', () => {
    const { container } = render(<CustomQuestionsView {...makeProps()} />)
    expect(container.querySelector('.custom-q-item__text')?.textContent).toBe('Lieblingsort')
  })

  it('zeigt keinen Fragen-Bereich wenn keine Fragen vorhanden sind', () => {
    const { container } = render(<CustomQuestionsView {...makeProps({ customQuestions: [] })} />)
    expect(container.querySelector('.custom-q-list')).toBeNull()
  })
})

describe('CustomQuestionsView – Share-Mechanismus entfernt', () => {
  it('hat keinen Share-Button mehr', () => {
    const { container } = render(<CustomQuestionsView {...makeProps()} />)
    expect(container.querySelector('.share-cta-btn')).toBeNull()
  })

  it('hat kein Import-Formular mehr', () => {
    const { container } = render(<CustomQuestionsView {...makeProps()} />)
    // No import textarea
    const textareas = Array.from(container.querySelectorAll('textarea'))
    // There should only be answer textareas, not an import-code area visible by default
    // (answer textarea only shows when editing a question)
    expect(textareas).toHaveLength(0)
  })
})


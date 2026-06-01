import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { CustomQuestionsView } from './CustomQuestionsView'
import { AppDataProvider, type AppData } from '../hooks/useAppData'
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

/** Build the slice of AppData that CustomQuestionsView reads from context. The
 *  view only touches these fields, so a partial cast keeps the mock readable. */
function makeAppData(overrides: Partial<AppData> = {}): AppData {
  return {
    customQuestions: [Q1],
    getAnswer: vi.fn(() => ''),
    getAnswerImageIds: vi.fn((): string[] => []),
    getAnswerVideoIds: vi.fn((): string[] => []),
    getAnswerAudioId: vi.fn((): string | undefined => undefined),
    setAnswerImages: vi.fn(),
    setAnswerVideos: vi.fn(),
    setAnswerAudio: vi.fn(),
    addCustomQuestion: vi.fn((): CustomQuestion => ({ id: 'new', text: 'New', type: 'text', createdAt: '' })),
    removeCustomQuestion: vi.fn(),
    ...overrides,
  } as unknown as AppData
}

function renderView(appData: AppData, props: { onSave?: () => void; onBack?: () => void } = {}) {
  return render(
    <AppDataProvider value={appData}>
      <CustomQuestionsView onSave={props.onSave ?? vi.fn()} onBack={props.onBack ?? vi.fn()} />
    </AppDataProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('CustomQuestionsView – Frage hinzufügen', () => {
  it('ruft addCustomQuestion auf wenn Text eingegeben und auf Hinzufügen geklickt wird', () => {
    const appData = makeAppData()
    const { container } = renderView(appData)
    const input = container.querySelector<HTMLInputElement>('.input-text')!
    fireEvent.change(input, { target: { value: 'Neue Frage' } })
    fireEvent.click(container.querySelector('.btn--primary')!)
    expect(appData.addCustomQuestion).toHaveBeenCalledWith('Neue Frage', 'text')
  })

  it('Hinzufügen-Button ist deaktiviert wenn kein Text eingegeben ist', () => {
    const { container } = renderView(makeAppData())
    const btn = container.querySelector<HTMLButtonElement>('.btn--primary')!
    expect(btn.disabled).toBe(true)
  })

  it('Enter-Taste ruft addCustomQuestion auf', () => {
    const appData = makeAppData()
    const { container } = renderView(appData)
    const input = container.querySelector<HTMLInputElement>('.input-text')!
    fireEvent.change(input, { target: { value: 'Per Enter' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(appData.addCustomQuestion).toHaveBeenCalledWith('Per Enter', 'text')
  })
})

describe('CustomQuestionsView – Frage löschen', () => {
  it('ruft removeCustomQuestion mit der richtigen ID auf', () => {
    const appData = makeAppData()
    const { container } = renderView(appData)
    fireEvent.click(container.querySelector('.custom-q-delete')!)
    expect(appData.removeCustomQuestion).toHaveBeenCalledWith('q-1')
  })
})

describe('CustomQuestionsView – Fragenliste', () => {
  it('zeigt Fragentext in der Liste an', () => {
    const { container } = renderView(makeAppData())
    expect(container.querySelector('.custom-q-item__text')?.textContent).toBe('Lieblingsort')
  })

  it('zeigt keinen Fragen-Bereich wenn keine Fragen vorhanden sind', () => {
    const { container } = renderView(makeAppData({ customQuestions: [] }))
    expect(container.querySelector('.custom-q-list')).toBeNull()
  })
})

describe('CustomQuestionsView – Share-Mechanismus entfernt', () => {
  it('hat keinen Share-Button mehr', () => {
    const { container } = renderView(makeAppData())
    expect(container.querySelector('.share-cta-btn')).toBeNull()
  })

  it('hat kein Import-Formular mehr', () => {
    const { container } = renderView(makeAppData())
    const textareas = Array.from(container.querySelectorAll('textarea'))
    expect(textareas).toHaveLength(0)
  })
})

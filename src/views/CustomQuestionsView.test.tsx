import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, cleanup, fireEvent, act } from '@testing-library/react'
import { CustomQuestionsView } from './CustomQuestionsView'
import { generateMemoryShareUrlSync } from '../utils/secureLink'
import type { CustomQuestion } from '../types'

// ── Module mocks ──────────────────────────────────────────────────────────────

// vi.mock factories are hoisted before variable declarations, so SHARE_URL
// must be declared with vi.hoisted() to be accessible inside the factory.
const { SHARE_URL } = vi.hoisted(() => ({ SHARE_URL: 'https://example.com/#ms/test123' }))

vi.mock('../utils/secureLink', () => ({
  generateMemoryShareUrlSync: vi.fn().mockReturnValue(SHARE_URL),
}))
vi.mock('../utils/shareCard', () => ({
  generateShareCard: vi.fn().mockResolvedValue(null),
}))
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
    onImport: vi.fn(),
    onBack: vi.fn(),
    ...overrides,
  }
}

function getShareBtn(container: HTMLElement) {
  return container.querySelector<HTMLButtonElement>('.share-cta-btn')
}

/** Stub navigator.clipboard.writeText. Returns the mock fn. */
function stubClipboard(resolves = true) {
  const writeText = resolves
    ? vi.fn().mockResolvedValue(undefined)
    : vi.fn().mockRejectedValue(new Error('NotAllowedError'))
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
  return writeText
}

/** Stub navigator.share. Returns the mock fn. */
function stubShare(rejects?: Error) {
  const fn = rejects
    ? vi.fn().mockRejectedValue(rejects)
    : vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'share', { value: fn, configurable: true })
  return fn
}

function clearShare() {
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
}

// ── Suite ─────────────────────────────────────────────────────────────────────

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('CustomQuestionsView – Erinnerungen teilen', () => {
  beforeEach(clearShare)

  // ── Sichtbarkeit ────────────────────────────────────────────────────────────

  describe('Sichtbarkeit', () => {
    it('versteckt den Teilen-Bereich wenn keine Fragen vorhanden sind', () => {
      const { container } = render(<CustomQuestionsView {...makeProps({ customQuestions: [] })} />)
      expect(getShareBtn(container)).toBeNull()
    })

    it('zeigt den share-cta-btn wenn Fragen vorhanden sind', () => {
      const { container } = render(<CustomQuestionsView {...makeProps()} />)
      const btn = getShareBtn(container)
      expect(btn).toBeTruthy()
      expect(btn?.textContent).toContain('Erinnerungen teilen')
    })

    it('Button ist nicht deaktiviert wenn Fragen vorhanden sind', () => {
      const { container } = render(<CustomQuestionsView {...makeProps()} />)
      expect(getShareBtn(container)?.disabled).toBe(false)
    })
  })

  // ── Clipboard-Pfad (navigator.share nicht verfügbar) ────────────────────────

  describe('Clipboard-Pfad (navigator.share nicht verfügbar)', () => {
    it('kopiert die generierte URL in die Zwischenablage', async () => {
      const writeText = stubClipboard()
      const { container } = render(<CustomQuestionsView {...makeProps()} />)
      await act(async () => { fireEvent.click(getShareBtn(container)!) })
      expect(writeText).toHaveBeenCalledWith(SHARE_URL)
    })

    it('zeigt "Link kopiert!" und success-Klasse nach erfolgreichem Kopieren', async () => {
      stubClipboard()
      const { container } = render(<CustomQuestionsView {...makeProps()} />)
      await act(async () => { fireEvent.click(getShareBtn(container)!) })
      const btn = getShareBtn(container)!
      expect(btn.textContent).toContain('Link kopiert!')
      expect(btn.className).toContain('share-cta-btn--success')
    })

    it('zeigt "Nochmal versuchen" und error-Klasse wenn Clipboard-Schreiben fehlschlägt', async () => {
      stubClipboard(false)
      const { container } = render(<CustomQuestionsView {...makeProps()} />)
      await act(async () => { fireEvent.click(getShareBtn(container)!) })
      const btn = getShareBtn(container)!
      expect(btn.textContent).toContain('Nochmal versuchen')
      expect(btn.className).toContain('share-cta-btn--error')
    })
  })

  // ── navigator.share-Pfad ────────────────────────────────────────────────────

  describe('navigator.share-Pfad', () => {
    it('ruft navigator.share mit title, text und url auf', async () => {
      const shareFn = stubShare()
      const { container } = render(<CustomQuestionsView {...makeProps()} />)
      await act(async () => { fireEvent.click(getShareBtn(container)!) })
      expect(shareFn).toHaveBeenCalledWith({
        title: 'Annas Erinnerungen',
        url: SHARE_URL,
      })
    })

    it('ignoriert AbortError – kein Fehler- oder Erfolgs-Status', async () => {
      const abortErr = Object.assign(new Error('Aborted'), { name: 'AbortError' })
      stubShare(abortErr)
      const { container } = render(<CustomQuestionsView {...makeProps()} />)
      await act(async () => { fireEvent.click(getShareBtn(container)!) })
      const btn = getShareBtn(container)!
      expect(btn.className).not.toContain('share-cta-btn--error')
      expect(btn.className).not.toContain('share-cta-btn--success')
    })

    it('fällt bei einem anderen share-Fehler auf Clipboard zurück', async () => {
      stubShare(new Error('share failed'))
      const writeText = stubClipboard()
      const { container } = render(<CustomQuestionsView {...makeProps()} />)
      await act(async () => { fireEvent.click(getShareBtn(container)!) })
      expect(writeText).toHaveBeenCalledWith(SHARE_URL)
      expect(getShareBtn(container)!.className).toContain('share-cta-btn--success')
    })
  })

  // ── Payload an generateMemoryShareUrl ───────────────────────────────────────

  describe('Payload an generateMemoryShareUrl', () => {
    it('übergibt Frage-Titel und Antwort-Inhalt', async () => {
      stubClipboard()
      const getAnswer = vi.fn((id: string) => (id === 'q-1' ? 'Mein Lieblingsort' : ''))
      const { container } = render(<CustomQuestionsView {...makeProps({ getAnswer })} />)
      await act(async () => { fireEvent.click(getShareBtn(container)!) })
      expect(vi.mocked(generateMemoryShareUrlSync)).toHaveBeenCalledWith({
        memories: [{ title: 'Lieblingsort', content: 'Mein Lieblingsort' }],
        sharedBy: 'Anna',
      })
    })

    it('lässt content weg wenn keine Antwort vorhanden ist', async () => {
      stubClipboard()
      // default getAnswer returns '' → content should be undefined
      const { container } = render(<CustomQuestionsView {...makeProps()} />)
      await act(async () => { fireEvent.click(getShareBtn(container)!) })
      expect(vi.mocked(generateMemoryShareUrlSync)).toHaveBeenCalledWith({
        memories: [{ title: 'Lieblingsort', content: undefined }],
        sharedBy: 'Anna',
      })
    })

    it('setzt sharedBy auf undefined wenn kein Profilname vorhanden ist', async () => {
      stubClipboard()
      const { container } = render(<CustomQuestionsView {...makeProps({ profileName: '' })} />)
      await act(async () => { fireEvent.click(getShareBtn(container)!) })
      expect(vi.mocked(generateMemoryShareUrlSync)).toHaveBeenCalledWith(
        expect.objectContaining({ sharedBy: undefined }),
      )
    })

    it('schließt alle Fragen als memories ein', async () => {
      stubClipboard()
      const q2: CustomQuestion = { id: 'q-2', text: 'Lieblingsessen', type: 'text', createdAt: '' }
      const getAnswer = vi.fn((id: string) => (id === 'q-1' ? 'Berge' : 'Pizza'))
      const { container } = render(
        <CustomQuestionsView {...makeProps({ customQuestions: [Q1, q2], getAnswer })} />,
      )
      await act(async () => { fireEvent.click(getShareBtn(container)!) })
      expect(vi.mocked(generateMemoryShareUrlSync)).toHaveBeenCalledWith({
        memories: [
          { title: 'Lieblingsort', content: 'Berge' },
          { title: 'Lieblingsessen', content: 'Pizza' },
        ],
        sharedBy: 'Anna',
      })
    })
  })

  // ── Fehlerbehandlung ────────────────────────────────────────────────────────

  describe('Fehlerbehandlung', () => {
    it('zeigt Fehler-Status wenn generateMemoryShareUrlSync wirft', async () => {
      vi.mocked(generateMemoryShareUrlSync).mockImplementationOnce(() => { throw new Error('URL generation failed') })
      const { container } = render(<CustomQuestionsView {...makeProps()} />)
      await act(async () => { fireEvent.click(getShareBtn(container)!) })
      expect(getShareBtn(container)!.className).toContain('share-cta-btn--error')
    })
  })
})

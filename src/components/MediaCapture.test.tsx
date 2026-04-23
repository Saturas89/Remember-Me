import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, fireEvent, cleanup, screen } from '@testing-library/react'
import type { UseAudioRecorder } from '../hooks/useAudioRecorder'
import { MediaCapture } from './MediaCapture'

afterEach(cleanup)

// ── useAudioRecorder is driven via a shared mutable ref so each test
//    can script the state the recorder should report.
const recorder: { current: UseAudioRecorder } = {
  current: makeRecorder({ state: 'idle' }),
}

function makeRecorder(p: Partial<UseAudioRecorder>): UseAudioRecorder {
  return {
    state: 'idle',
    duration: 0,
    transcript: '',
    previewBlob: null,
    previewUrl: null,
    hasTranscription: true,
    error: null,
    start: vi.fn(async () => {}),
    stop: vi.fn(),
    cancel: vi.fn(),
    reset: vi.fn(),
    ...p,
  }
}

vi.mock('../hooks/useAudioRecorder', () => ({
  useAudioRecorder: () => recorder.current,
}))

// AudioPlayer pulls from useAudioStore (IDB) – stub it out.
vi.mock('./AudioPlayer', () => ({
  AudioPlayer: ({ audioId }: { audioId: string }) => (
    <div data-testid="audio-player-stub">{audioId}</div>
  ),
}))

// ImageAttachment / VideoAttachment render independently; render tiny stubs so
// the toolbar buttons (which are the interesting surface here) stay isolated.
vi.mock('./ImageAttachment', () => ({
  ImageAttachment: ({ imageIds }: { imageIds: string[] }) => (
    <div data-testid="image-attachment">{imageIds.join(',')}</div>
  ),
}))
vi.mock('./VideoAttachment', () => ({
  VideoAttachment: ({ videoIds }: { videoIds: string[] }) => (
    <div data-testid="video-attachment">{videoIds.join(',')}</div>
  ),
}))

function baseProps(overrides: Partial<React.ComponentProps<typeof MediaCapture>> = {}) {
  return {
    imageIds: [],
    imageCache: {},
    videoIds: [],
    audioId: undefined,
    currentValue: '',
    onLoadImages: vi.fn(),
    onAddImage: vi.fn(),
    onRemoveImage: vi.fn(),
    onAddVideo: vi.fn(),
    onRemoveVideo: vi.fn(),
    onSaveAudio: vi.fn(async () => {}),
    onRemoveAudio: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  recorder.current = makeRecorder({ state: 'idle' })
})

describe('MediaCapture – idle', () => {
  it('shows the hint copy when no media is attached', () => {
    render(<MediaCapture {...baseProps()} />)
    expect(screen.getByText(/Damit dieser Moment nie verblasst/)).toBeTruthy()
  })

  it('hides the hint once any media is attached', () => {
    render(<MediaCapture {...baseProps({ imageIds: ['img-1'] })} />)
    expect(screen.queryByText(/Damit dieser Moment nie verblasst/)).toBeNull()
  })

  it('renders all three media-toolbar buttons (Foto / Video / Aufnahme)', () => {
    render(<MediaCapture {...baseProps()} />)
    expect(screen.getByRole('button', { name: /Foto hinzufügen/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Video hinzufügen/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Sprachaufnahme starten/ })).toBeTruthy()
  })

  it('disables the photo button when the image limit (5) is reached', () => {
    render(<MediaCapture {...baseProps({ imageIds: Array.from({ length: 5 }, (_, i) => `img-${i}`) })} />)
    const btn = screen.getByRole('button', { name: /Foto hinzufügen/ }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('disables the video button when the video limit (3) is reached', () => {
    render(<MediaCapture {...baseProps({ videoIds: ['v1', 'v2', 'v3'] })} />)
    const btn = screen.getByRole('button', { name: /Video hinzufügen/ }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('shows an existing-audio panel with replace/delete actions when audioId is set', () => {
    const onRemoveAudio = vi.fn()
    render(<MediaCapture {...baseProps({ audioId: 'aud-1', onRemoveAudio })} />)
    expect(screen.getByTestId('audio-player-stub').textContent).toBe('aud-1')
    fireEvent.click(screen.getByRole('button', { name: /Löschen/ }))
    expect(onRemoveAudio).toHaveBeenCalledOnce()
  })

  it('clicking the audio button starts the recorder when idle and no recording exists', () => {
    const start = vi.fn(async () => {})
    recorder.current = makeRecorder({ state: 'idle', start })
    render(<MediaCapture {...baseProps()} />)
    fireEvent.click(screen.getByRole('button', { name: /Sprachaufnahme starten/ }))
    expect(start).toHaveBeenCalledOnce()
  })

  it('clicking the audio button is a no-op when an existing recording is present', () => {
    const start = vi.fn(async () => {})
    recorder.current = makeRecorder({ state: 'idle', start })
    render(<MediaCapture {...baseProps({ audioId: 'aud-1' })} />)
    // The toolbar button is disabled when audioId is already set
    const toolbarBtn = screen.getByRole('button', { name: /Sprachaufnahme vorhanden/ })
    expect((toolbarBtn as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(toolbarBtn)
    expect(start).not.toHaveBeenCalled()
  })
})

describe('MediaCapture – active recording states', () => {
  it('renders the "Warte auf Mikrofon…" panel in the requesting state', () => {
    recorder.current = makeRecorder({ state: 'requesting' })
    render(<MediaCapture {...baseProps()} />)
    expect(screen.getByText(/Warte auf Mikrofon/)).toBeTruthy()
  })

  it('shows the timer and stop/cancel controls while recording', () => {
    const stop = vi.fn()
    const cancel = vi.fn()
    recorder.current = makeRecorder({ state: 'recording', duration: 72, stop, cancel })
    render(<MediaCapture {...baseProps()} />)
    expect(screen.getByText('01:12')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Stopp/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(stop).toHaveBeenCalledOnce()
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('surfaces a live transcript below the timer when SpeechRecognition emits', () => {
    recorder.current = makeRecorder({
      state: 'recording',
      duration: 3,
      transcript: 'live text…',
    })
    render(<MediaCapture {...baseProps()} />)
    expect(screen.getByText('live text…')).toBeTruthy()
  })

  it('surfaces recorder errors', () => {
    recorder.current = makeRecorder({ error: 'Mikrofon-Zugriff verweigert.' })
    render(<MediaCapture {...baseProps()} />)
    expect(screen.getByText(/Mikrofon-Zugriff verweigert/)).toBeTruthy()
  })
})

describe('MediaCapture – preview & confirm', () => {
  function previewProps(overrides: Partial<UseAudioRecorder> = {}) {
    recorder.current = makeRecorder({
      state: 'preview',
      previewBlob: new Blob(['x'], { type: 'audio/webm' }),
      previewUrl: 'blob:preview',
      transcript: 'transkribiert',
      ...overrides,
    })
  }

  it('offers Übernehmen / Neu aufnehmen / Verwerfen in the preview state', () => {
    previewProps()
    render(<MediaCapture {...baseProps()} />)
    expect(screen.getByRole('button', { name: /Übernehmen/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Neu aufnehmen/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Verwerfen/ })).toBeTruthy()
  })

  it('Übernehmen calls onSaveAudio with the transcript and no blob by default', async () => {
    previewProps()
    const onSaveAudio = vi.fn(async () => {})
    render(<MediaCapture {...baseProps({ onSaveAudio })} />)
    fireEvent.click(screen.getByRole('button', { name: /Übernehmen/ }))
    // Allow the click's async handler to resolve
    await Promise.resolve()
    expect(onSaveAudio).toHaveBeenCalledWith('transkribiert', null, true)
  })

  it('Übernehmen passes the blob when the "als Audio-Datei speichern" toggle is on', async () => {
    previewProps()
    const onSaveAudio = vi.fn(async () => {})
    render(<MediaCapture {...baseProps({ onSaveAudio })} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /Aufnahme als Audio-Datei speichern/ }))
    fireEvent.click(screen.getByRole('button', { name: /Übernehmen/ }))
    await Promise.resolve()
    const call = onSaveAudio.mock.calls[0] as unknown as [string, Blob | null, boolean]
    expect(call[1]).toBeInstanceOf(Blob)
    expect(call[2]).toBe(true)
  })

  it('shows the text-conflict chooser when transcript and currentValue differ', () => {
    previewProps({ transcript: 'neue transkription' })
    render(<MediaCapture {...baseProps({ currentValue: 'alter text' })} />)
    expect(screen.getByText(/Welchen Text übernehmen/)).toBeTruthy()
  })

  it('keeps existing text when the user picks "Bisherigen Text behalten"', async () => {
    previewProps({ transcript: 'neu' })
    const onSaveAudio = vi.fn(async () => {})
    render(<MediaCapture {...baseProps({ currentValue: 'alt', onSaveAudio })} />)

    fireEvent.click(screen.getByRole('button', { name: /Bisherigen Text behalten/ }))
    fireEvent.click(screen.getByRole('button', { name: /Übernehmen/ }))
    await Promise.resolve()
    expect(onSaveAudio).toHaveBeenCalledWith('neu', null, false)
  })

  it('falls back to a no-transcription hint when SpeechRecognition is unsupported', () => {
    previewProps({ transcript: '', hasTranscription: false })
    render(<MediaCapture {...baseProps()} />)
    expect(screen.getByText(/Keine automatische Transkription verfügbar/)).toBeTruthy()
  })
})

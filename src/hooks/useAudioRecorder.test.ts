import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// ── Test doubles for MediaRecorder / MediaStream / SpeechRecognition ─────

class FakeMediaStream {
  tracks: { stop: () => void; stopped: boolean }[]
  constructor() {
    this.tracks = [{ stop() { this.stopped = true }, stopped: false }]
  }
  getTracks() { return this.tracks }
}

let lastRecorder: FakeMediaRecorder | null = null

class FakeMediaRecorder {
  static isTypeSupported(type: string) { return type === 'audio/webm;codecs=opus' }
  state: 'inactive' | 'recording' = 'inactive'
  mimeType: string
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  constructor(_stream: unknown, opts?: { mimeType?: string }) {
    this.mimeType = opts?.mimeType ?? ''
    lastRecorder = this
  }
  start() { this.state = 'recording' }
  stop() {
    if (this.state === 'inactive') return
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['AUDIO'], { type: this.mimeType || 'audio/webm' }) })
    this.onstop?.()
  }
}

let lastRecognition: FakeSpeechRecognition | null = null

class FakeSpeechRecognition {
  continuous = false
  interimResults = false
  lang = ''
  maxAlternatives = 0
  onresult: ((e: { results: Array<{ 0: { transcript: string } }> }) => void) | null = null
  onerror: (() => void) | null = null
  started = false
  aborted = false
  constructor() { lastRecognition = this }
  start() { this.started = true }
  stop() { this.started = false }
  abort() { this.aborted = true; this.started = false }
  emitResult(transcript: string) {
    this.onresult?.({ results: [{ 0: { transcript } }] })
  }
}

let getUserMediaMock: ReturnType<typeof vi.fn>
let cleanupFns: Array<() => void> = []

function installMediaAPIs(opts: { withSpeechRecognition?: boolean } = {}) {
  getUserMediaMock = vi.fn().mockResolvedValue(new FakeMediaStream())
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: getUserMediaMock },
  })
  ;(globalThis as unknown as { MediaRecorder: unknown }).MediaRecorder = FakeMediaRecorder
  ;(window as unknown as { MediaRecorder: unknown }).MediaRecorder = FakeMediaRecorder
  if (opts.withSpeechRecognition) {
    ;(window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeSpeechRecognition
  }
  const origCreate = URL.createObjectURL
  const origRevoke = URL.revokeObjectURL
  URL.createObjectURL = vi.fn(() => 'blob:mock')
  URL.revokeObjectURL = vi.fn()
  cleanupFns.push(() => { URL.createObjectURL = origCreate; URL.revokeObjectURL = origRevoke })
}

describe('useAudioRecorder', () => {
  beforeEach(() => {
    lastRecorder = null
    lastRecognition = null
    vi.resetModules()
    installMediaAPIs()
  })

  afterEach(() => {
    cleanupFns.forEach(fn => fn())
    cleanupFns = []
    delete (window as { SpeechRecognition?: unknown }).SpeechRecognition
    delete (window as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
    delete (globalThis as { MediaRecorder?: unknown }).MediaRecorder
    delete (window as { MediaRecorder?: unknown }).MediaRecorder
    vi.restoreAllMocks()
  })

  it('starts in "idle" and reports no transcription support by default', async () => {
    const { useAudioRecorder } = await import('./useAudioRecorder')
    const { result } = renderHook(() => useAudioRecorder())
    expect(result.current.state).toBe('idle')
    expect(result.current.hasTranscription).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('start → recording → stop → preview yields a blob and object URL', async () => {
    const { useAudioRecorder } = await import('./useAudioRecorder')
    const { result } = renderHook(() => useAudioRecorder())

    await act(async () => { await result.current.start() })
    expect(getUserMediaMock).toHaveBeenCalledWith({ audio: true })
    expect(result.current.state).toBe('recording')

    await act(async () => { result.current.stop() })
    await waitFor(() => expect(result.current.state).toBe('preview'))

    expect(result.current.previewBlob).toBeInstanceOf(Blob)
    expect(result.current.previewUrl).toBe('blob:mock')
  })

  it('surfaces a user-friendly error when the microphone is denied', async () => {
    getUserMediaMock.mockRejectedValueOnce(new Error('NotAllowedError'))
    const { useAudioRecorder } = await import('./useAudioRecorder')
    const { result } = renderHook(() => useAudioRecorder())

    await act(async () => { await result.current.start() })
    expect(result.current.state).toBe('idle')
    expect(result.current.error).toMatch(/Mikrofon-Zugriff verweigert/)
  })

  it('cancel() releases resources and returns to idle', async () => {
    const { useAudioRecorder } = await import('./useAudioRecorder')
    const { result } = renderHook(() => useAudioRecorder())

    await act(async () => { await result.current.start() })
    expect(result.current.state).toBe('recording')

    act(() => { result.current.cancel() })
    expect(result.current.state).toBe('idle')
    expect(result.current.previewBlob).toBeNull()
    expect(result.current.previewUrl).toBeNull()
  })

  it('reset() clears preview state after stopping a recording', async () => {
    const { useAudioRecorder } = await import('./useAudioRecorder')
    const { result } = renderHook(() => useAudioRecorder())

    await act(async () => { await result.current.start() })
    await act(async () => { result.current.stop() })
    await waitFor(() => expect(result.current.state).toBe('preview'))

    act(() => { result.current.reset() })
    expect(result.current.state).toBe('idle')
    expect(result.current.previewBlob).toBeNull()
  })

  it('wires SpeechRecognition and exposes a live transcript when supported', async () => {
    // Reinstall with SpeechRecognition enabled
    cleanupFns.forEach(fn => fn()); cleanupFns = []
    installMediaAPIs({ withSpeechRecognition: true })
    const { useAudioRecorder } = await import('./useAudioRecorder')
    const { result } = renderHook(() => useAudioRecorder())
    expect(result.current.hasTranscription).toBe(true)

    await act(async () => { await result.current.start() })
    expect(lastRecognition?.started).toBe(true)

    act(() => { lastRecognition?.emitResult('hallo welt') })
    expect(result.current.transcript).toBe('hallo welt')

    await act(async () => { result.current.stop() })
    await waitFor(() => expect(result.current.state).toBe('preview'))
    expect(lastRecognition?.aborted).toBe(true)
  })

  it('picks a supported mime type for the MediaRecorder (audio/webm;codecs=opus)', async () => {
    const { useAudioRecorder } = await import('./useAudioRecorder')
    const { result } = renderHook(() => useAudioRecorder())

    await act(async () => { await result.current.start() })
    expect(lastRecorder?.mimeType).toBe('audio/webm;codecs=opus')
  })
})

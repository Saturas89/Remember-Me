import { useState, useRef, useCallback, useEffect } from 'react'

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'preview'

export interface UseAudioRecorder {
  state: RecorderState
  duration: number          // seconds elapsed while recording
  transcript: string        // live + final transcript from SpeechRecognition
  previewBlob: Blob | null  // available once recording stops
  previewUrl:  string | null
  hasTranscription: boolean // true if browser supports SpeechRecognition
  error: string | null
  start:  () => Promise<void>
  stop:   () => void
  cancel: () => void
  reset:  () => void
}

// Minimal interface for the parts of SpeechRecognition we use
interface SRLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  onresult: ((event: { results: SpeechRecognitionResultList }) => void) | null
  onerror: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

// Resolve the Speech Recognition constructor across browsers
function getSpeechRecognition(): (new () => SRLike) | null {
  if (typeof window === 'undefined') return null
  type WinWithSR = { SpeechRecognition?: new () => SRLike; webkitSpeechRecognition?: new () => SRLike }
  const w = window as unknown as WinWithSR
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function useAudioRecorder(): UseAudioRecorder {
  const [recState,    setRecState]    = useState<RecorderState>('idle')
  const [duration,    setDuration]    = useState(0)
  const [transcript,  setTranscript]  = useState('')
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
  const [previewUrl,  setPreviewUrl]  = useState<string | null>(null)
  const [error,       setError]       = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef        = useRef<Blob[]>([])
  const streamRef        = useRef<MediaStream | null>(null)
  const recognitionRef   = useRef<SRLike | null>(null)
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null)
  const transcriptRef    = useRef('')   // snapshot accessible from MediaRecorder callbacks
  const previewUrlRef    = useRef<string | null>(null)

  const hasTranscription = getSpeechRecognition() !== null

  // Full cleanup – stops all resources
  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch { /* ignore */ }
      recognitionRef.current = null
    }
    if (mediaRecorderRef.current?.state !== 'inactive') {
      try { mediaRecorderRef.current?.stop() } catch { /* ignore */ }
    }
    mediaRecorderRef.current = null
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => () => {
    cleanup()
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
  }, [cleanup])

  // ── start ──────────────────────────────────────────────────
  const start = useCallback(async () => {
    setError(null)
    setTranscript('')
    setDuration(0)
    transcriptRef.current = ''
    chunksRef.current = []
    setRecState('requesting')

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('Mikrofon-Zugriff verweigert. Bitte erlaube den Zugriff in den Browser-Einstellungen.')
      setRecState('idle')
      return
    }
    streamRef.current = stream

    // ── MediaRecorder ──────────────────────────────────────
    const mimeType =
      MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' :
      MediaRecorder.isTypeSupported('audio/webm')             ? 'audio/webm' :
      MediaRecorder.isTypeSupported('audio/mp4')              ? 'audio/mp4'  : ''

    const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    mediaRecorderRef.current = mr

    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }

    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
      const url  = URL.createObjectURL(blob)
      previewUrlRef.current = url
      setPreviewBlob(blob)
      setPreviewUrl(url)
      setTranscript(transcriptRef.current)
      setRecState('preview')
    }

    mr.start(500)  // collect chunks every 500 ms

    // ── SpeechRecognition ──────────────────────────────────
    const SRClass = getSpeechRecognition()
    if (SRClass) {
      const sr = new SRClass()
      sr.continuous       = true
      sr.interimResults   = true
      sr.lang             = 'de-DE'
      sr.maxAlternatives  = 1
      sr.onresult = (event) => {
        let text = ''
        for (let i = 0; i < event.results.length; i++) {
          text += event.results[i][0].transcript
        }
        transcriptRef.current = text
        setTranscript(text)
      }
      sr.onerror = () => { /* transcript simply stays empty */ }
      recognitionRef.current = sr
      try { sr.start() } catch { /* silently ignore */ }
    }

    // ── Duration timer (max 10 min = 600 s) ───────────────
    let secs = 0
    timerRef.current = setInterval(() => {
      secs++
      setDuration(secs)
      if (secs >= 600) {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        // stop() will be called via the exported stop fn below
        stopRecording()
      }
    }, 1000)

    setRecState('recording')
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // Internal stop – does not depend on state
  function stopRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch { /* ignore */ }
      recognitionRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()  // triggers mr.onstop → sets preview state
    }
  }

  const stop = useCallback(() => stopRecording(), [])  // eslint-disable-line react-hooks/exhaustive-deps

  const cancel = useCallback(() => {
    cleanup()
    if (previewUrlRef.current) { URL.revokeObjectURL(previewUrlRef.current); previewUrlRef.current = null }
    setPreviewUrl(null)
    setPreviewBlob(null)
    setTranscript('')
    setDuration(0)
    setError(null)
    chunksRef.current = []
    setRecState('idle')
  }, [cleanup])

  const reset = useCallback(() => {
    if (previewUrlRef.current) { URL.revokeObjectURL(previewUrlRef.current); previewUrlRef.current = null }
    setPreviewUrl(null)
    setPreviewBlob(null)
    setTranscript('')
    setDuration(0)
    setError(null)
    chunksRef.current = []
    setRecState('idle')
  }, [])

  return { state: recState, duration, transcript, previewBlob, previewUrl, hasTranscription, error, start, stop, cancel, reset }
}

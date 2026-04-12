import { useState, useRef, useEffect, useCallback } from 'react'
import { getAudioBlob } from '../hooks/useAudioStore'

interface Props {
  audioId: string
}

function fmt(secs: number): string {
  if (!isFinite(secs) || secs < 0) return '0:00'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export function AudioPlayer({ audioId }: Props) {
  const [url,         setUrl]         = useState<string | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(false)
  const [playing,     setPlaying]     = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration,    setDuration]    = useState(0)

  const audioRef      = useRef<HTMLAudioElement>(null)
  const urlRef        = useRef<string | null>(null)
  const pendingPlay   = useRef(false)

  // Revoke Object URL on unmount
  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
  }, [])

  // Auto-play once URL is available if the user already clicked play
  useEffect(() => {
    if (url && pendingPlay.current && audioRef.current) {
      pendingPlay.current = false
      audioRef.current.play().catch(() => { /* ignore autoplay block */ })
    }
  }, [url])

  const load = useCallback(async () => {
    if (url || loading) return
    setLoading(true)
    setError(false)
    try {
      const blob = await getAudioBlob(audioId)
      if (!blob) { setError(true); return }
      const objectUrl = URL.createObjectURL(blob)
      urlRef.current = objectUrl
      setUrl(objectUrl)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [audioId, url, loading])

  function handlePlayPause() {
    if (!url) {
      pendingPlay.current = true
      load()
      return
    }
    const audio = audioRef.current
    if (!audio) return
    if (playing) audio.pause()
    else audio.play().catch(() => { /* ignore */ })
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current
    if (!audio || !duration) return
    audio.currentTime = Number(e.target.value)
  }

  if (error) {
    return <p className="audio-player__error">Audiodatei nicht verfügbar.</p>
  }

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="audio-player">
      <span className="audio-player__icon" aria-hidden="true">🎙</span>

      <button
        type="button"
        className="audio-player__play"
        onClick={handlePlayPause}
        aria-label={playing ? 'Pause' : 'Aufnahme abspielen'}
        disabled={loading}
      >
        {loading ? '…' : playing ? '⏸' : '▶'}
      </button>

      <div className="audio-player__track" aria-hidden="true">
        <div className="audio-player__fill" style={{ width: `${pct}%` }} />
        {url && (
          <input
            type="range"
            className="audio-player__seek"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            aria-label="Abspielposition"
          />
        )}
      </div>

      <span className="audio-player__time">
        {duration > 0
          ? `${fmt(currentTime)} / ${fmt(duration)}`
          : fmt(currentTime)}
      </span>

      {/* Hidden audio element — always rendered so ref is available */}
      <audio
        ref={audioRef}
        src={url ?? undefined}
        onPlay={()         => setPlaying(true)}
        onPause={()        => setPlaying(false)}
        onEnded={()        => { setPlaying(false); setCurrentTime(0) }}
        onTimeUpdate={()   => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        style={{ display: 'none' }}
        preload="none"
      />
    </div>
  )
}

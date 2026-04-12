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

// Decorative waveform heights (percent of max bar height, 30 bars)
const WAVEFORM = [40,62,80,55,90,70,45,85,60,75,50,92,65,82,40,70,88,55,92,60,74,48,82,65,52,94,70,42,86,60]

export function AudioPlayer({ audioId }: Props) {
  const [url,         setUrl]         = useState<string | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(false)
  const [playing,     setPlaying]     = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration,    setDuration]    = useState(0)

  const audioRef    = useRef<HTMLAudioElement>(null)
  const urlRef      = useRef<string | null>(null)
  const pendingPlay = useRef(false)

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
  }, [])

  useEffect(() => {
    if (url && pendingPlay.current && audioRef.current) {
      pendingPlay.current = false
      audioRef.current.play().catch(() => {})
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
    else audio.play().catch(() => {})
  }

  function handleWaveformClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    if (!url || !audioRef.current || !duration) return
    audioRef.current.currentTime = pct * duration
  }

  if (error) return <p className="audio-player__error">Audiodatei nicht verfügbar.</p>

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="audio-player">
      <button
        type="button"
        className="audio-player__play"
        onClick={handlePlayPause}
        aria-label={playing ? 'Pause' : 'Aufnahme abspielen'}
        disabled={loading}
      >
        {loading
          ? <span className="audio-player__spinner" />
          : playing
            ? <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><rect x="5" y="4" width="4" height="16" rx="1"/><rect x="15" y="4" width="4" height="16" rx="1"/></svg>
            : <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><polygon points="6,3 21,12 6,21"/></svg>
        }
      </button>

      <div className="audio-player__body">
        <div
          className="audio-waveform"
          onClick={handleWaveformClick}
          role="slider"
          aria-label="Abspielposition"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          {WAVEFORM.map((h, i) => {
            const barPct = (i / WAVEFORM.length) * 100
            return (
              <span
                key={i}
                className={`audio-waveform__bar${barPct < pct ? ' audio-waveform__bar--played' : ''}`}
                style={{ height: `${h}%` }}
              />
            )
          })}
        </div>
        <div className="audio-player__times">
          <span>{fmt(currentTime)}</span>
          {duration > 0 && <span>{fmt(duration)}</span>}
        </div>
      </div>

      <audio
        ref={audioRef}
        src={url ?? undefined}
        onPlay={()          => setPlaying(true)}
        onPause={()         => setPlaying(false)}
        onEnded={()         => { setPlaying(false); setCurrentTime(0) }}
        onTimeUpdate={()    => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        style={{ display: 'none' }}
        preload="none"
      />
    </div>
  )
}

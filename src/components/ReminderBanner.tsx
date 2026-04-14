import { useState, useEffect } from 'react'

interface Props {
  onEnable: () => void
  onDismiss: () => void
  visible: boolean
}

export function ReminderBanner({ onEnable, onDismiss, visible }: Props) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Delay slightly so it doesn't pop up immediately on first paint
    if (visible) {
      const t = setTimeout(() => setMounted(true), 1500)
      return () => clearTimeout(t)
    } else {
      setMounted(false)
    }
  }, [visible])

  if (!visible || !mounted) return null

  return (
    <div className="update-banner reminder-banner" role="alert" aria-live="polite">
      <span className="update-banner__icon" aria-hidden="true">🔔</span>
      <div className="update-banner__text">
        <strong>Erinnerungen aktivieren</strong>
        <span>Wir erinnern dich nach 2 Tagen daran, dein Vermächtnis weiterzuschreiben.</span>
      </div>
      <button className="btn btn--primary btn--sm update-banner__btn" onClick={onEnable}>
        Erlauben
      </button>
      <button
        className="update-banner__close"
        onClick={onDismiss}
        aria-label="Benachrichtigung schließen"
      >
        ✕
      </button>
    </div>
  )
}

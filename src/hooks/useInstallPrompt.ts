import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallState =
  | { type: 'android'; prompt: BeforeInstallPromptEvent }
  | { type: 'ios' }
  | { type: 'installed' }
  | { type: 'none' }

const DISMISSED_KEY = 'rm-install-dismissed'

function isInstalled(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true)
  )
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !('MSStream' in window)
}

export function useInstallPrompt() {
  const [state, setState] = useState<InstallState>({ type: 'none' })
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === '1',
  )

  useEffect(() => {
    if (isInstalled()) { setState({ type: 'installed' }); return }

    const handler = (e: Event) => {
      e.preventDefault()
      setState({ type: 'android', prompt: e as BeforeInstallPromptEvent })
    }

    window.addEventListener('beforeinstallprompt', handler)

    // iOS: no beforeinstallprompt – show manual instructions
    if (isIOS()) {
      setState({ type: 'ios' })
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function triggerInstall() {
    if (state.type !== 'android') return
    await state.prompt.prompt()
    const { outcome } = await state.prompt.userChoice
    if (outcome === 'accepted') setState({ type: 'installed' })
  }

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setDismissed(true)
  }

  const visible = !dismissed && (state.type === 'android' || state.type === 'ios')

  return { state, visible, triggerInstall, dismiss }
}

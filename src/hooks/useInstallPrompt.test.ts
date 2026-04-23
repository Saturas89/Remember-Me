import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const DISMISSED_KEY = 'rm-install-dismissed'

// ── matchMedia / userAgent / standalone helpers ───────────────────────────
function setStandalone(value: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(display-mode: standalone)' ? value : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true })
}

async function loadHook() {
  vi.resetModules()
  return (await import('./useInstallPrompt')).useInstallPrompt
}

describe('useInstallPrompt', () => {
  beforeEach(() => {
    localStorage.clear()
    setStandalone(false)
    setUserAgent('Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36')
    // Remove any existing 'standalone' property on navigator
    if ('standalone' in window.navigator) {
      delete (window.navigator as Record<string, unknown>).standalone
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts in "none" state and is not visible on desktop browsers', async () => {
    const useInstallPrompt = await loadHook()
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.state.type).toBe('none')
    expect(result.current.visible).toBe(false)
  })

  it('reports "installed" when the PWA is running in standalone display mode', async () => {
    setStandalone(true)
    const useInstallPrompt = await loadHook()
    const { result } = renderHook(() => useInstallPrompt())
    await waitFor(() => expect(result.current.state.type).toBe('installed'))
    expect(result.current.visible).toBe(false)
  })

  it('detects iOS Safari and surfaces manual-install instructions', async () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605')
    const useInstallPrompt = await loadHook()
    const { result } = renderHook(() => useInstallPrompt())
    await waitFor(() => expect(result.current.state.type).toBe('ios'))
    expect(result.current.visible).toBe(true)
  })

  it('captures beforeinstallprompt on Android and flips to "android" state', async () => {
    const useInstallPrompt = await loadHook()
    const { result } = renderHook(() => useInstallPrompt())

    const promptMock = vi.fn().mockResolvedValue(undefined)
    const userChoice = Promise.resolve({ outcome: 'accepted' as const })
    const event = Object.assign(new Event('beforeinstallprompt'), {
      prompt: promptMock,
      userChoice,
    })

    await act(async () => {
      window.dispatchEvent(event)
    })

    expect(result.current.state.type).toBe('android')
    expect(result.current.visible).toBe(true)
  })

  it('triggerInstall calls prompt() and flips to "installed" on accept', async () => {
    const useInstallPrompt = await loadHook()
    const { result } = renderHook(() => useInstallPrompt())

    const promptMock = vi.fn().mockResolvedValue(undefined)
    const event = Object.assign(new Event('beforeinstallprompt'), {
      prompt: promptMock,
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    })
    await act(async () => { window.dispatchEvent(event) })

    await act(async () => { await result.current.triggerInstall() })

    expect(promptMock).toHaveBeenCalled()
    expect(result.current.state.type).toBe('installed')
  })

  it('triggerInstall on accept leaves state unchanged when the user dismisses', async () => {
    const useInstallPrompt = await loadHook()
    const { result } = renderHook(() => useInstallPrompt())

    const promptMock = vi.fn().mockResolvedValue(undefined)
    const event = Object.assign(new Event('beforeinstallprompt'), {
      prompt: promptMock,
      userChoice: Promise.resolve({ outcome: 'dismissed' as const }),
    })
    await act(async () => { window.dispatchEvent(event) })
    await act(async () => { await result.current.triggerInstall() })

    expect(result.current.state.type).toBe('android')
  })

  it('dismiss() persists the preference and hides the banner', async () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)')
    const useInstallPrompt = await loadHook()
    const { result } = renderHook(() => useInstallPrompt())

    await waitFor(() => expect(result.current.visible).toBe(true))
    act(() => result.current.dismiss())

    expect(localStorage.getItem(DISMISSED_KEY)).toBe('1')
    expect(result.current.visible).toBe(false)
  })

  it('respects a previously stored dismiss and keeps the banner hidden', async () => {
    localStorage.setItem(DISMISSED_KEY, '1')
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)')
    const useInstallPrompt = await loadHook()
    const { result } = renderHook(() => useInstallPrompt())

    await waitFor(() => expect(result.current.state.type).toBe('ios'))
    expect(result.current.visible).toBe(false)
  })
})

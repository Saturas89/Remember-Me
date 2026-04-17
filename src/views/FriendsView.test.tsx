import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { FriendsView } from './FriendsView'

afterEach(cleanup)

const defaultProps = {
  profileName: 'Anna',
  inviteUrl: 'https://example.com/invite',
  friends: [],
  friendAnswers: [],
  onRemoveFriend: vi.fn(),
  onImportZip: vi.fn(),
  onBack: vi.fn(),
}

describe('FriendsView – Einladungstext', () => {
  it('zeigt den zusammengeführten Erklärungstext', () => {
    const { container } = render(<FriendsView {...defaultProps} />)
    const hint = container.querySelector('.friends-hint')
    expect(hint?.textContent).toContain('Lade Freunde und Familie ein')
    expect(hint?.textContent).toContain('automatisch in deinem persönlichen Lebensarchiv gespeichert')
  })

  it('hat keinen separaten friends-intro-Absatz mehr', () => {
    const { container } = render(<FriendsView {...defaultProps} />)
    expect(container.querySelector('.friends-intro')).toBeNull()
  })

  it('zeigt den Teilen-Button', () => {
    const { container } = render(<FriendsView {...defaultProps} />)
    const btn = container.querySelector('.share-cta-btn')
    expect(btn).toBeTruthy()
    expect(btn?.textContent).toContain('Link teilen')
  })

  it('zeigt Personalisierungs-Hinweis wenn kein Profilname gesetzt', () => {
    const { container } = render(<FriendsView {...defaultProps} profileName="" />)
    expect(container.querySelector('.friends-hint--warn')).toBeTruthy()
  })

  it('versteckt Personalisierungs-Hinweis wenn Profilname gesetzt ist', () => {
    const { container } = render(<FriendsView {...defaultProps} profileName="Anna" />)
    expect(container.querySelector('.friends-hint--warn')).toBeNull()
  })
})

describe('FriendsView – Logo-Prefetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ blob: () => Promise.resolve(new Blob(['x'], { type: 'image/png' })) }))
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('lädt das App-Icon beim Mounten vor', async () => {
    render(<FriendsView {...defaultProps} />)
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/pwa-192x192.png'))
  })
})

describe('FriendsView – Teilen mit Datei (iOS WhatsApp)', () => {
  const logoBlob = new Blob(['png'], { type: 'image/png' })

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ blob: () => Promise.resolve(logoBlob) }))
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('teilt Icon + Text wenn Datei-Share verfügbar', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const canShare = vi.fn().mockReturnValue(true)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    Object.defineProperty(navigator, 'canShare', { value: canShare, configurable: true })

    const { container } = render(<FriendsView {...defaultProps} />)
    // Wait for logo to load
    await waitFor(() => expect(fetch).toHaveBeenCalled())

    fireEvent.click(container.querySelector('.share-cta-btn')!)

    expect(share).toHaveBeenCalledWith(expect.objectContaining({
      files: expect.arrayContaining([expect.any(File)]),
      text: expect.stringContaining('https://example.com/invite'),
    }))
    // text should contain the personal message
    const call = share.mock.calls[0][0]
    expect(call.text).toContain('Erinnerungen ergänzen')
    expect(call.text).toContain('https://example.com/invite')
  })

  it('fällt auf Text-Share zurück wenn Datei-Share nicht unterstützt', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const canShare = vi.fn().mockReturnValue(false)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    Object.defineProperty(navigator, 'canShare', { value: canShare, configurable: true })

    const { container } = render(<FriendsView {...defaultProps} />)
    await waitFor(() => expect(fetch).toHaveBeenCalled())

    fireEvent.click(container.querySelector('.share-cta-btn')!)

    expect(share).toHaveBeenCalledWith(expect.objectContaining({
      text: expect.stringContaining('https://example.com/invite'),
    }))
    const call = share.mock.calls[0][0]
    expect(call.files).toBeUndefined()
  })
})

describe('FriendsView – Clipboard-Fallback', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('kopiert Text + URL in die Zwischenablage wenn kein Share verfügbar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no fetch')))
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    const { container } = render(<FriendsView {...defaultProps} />)
    fireEvent.click(container.querySelector('.share-cta-btn')!)

    await waitFor(() => expect(writeText).toHaveBeenCalled())
    const copied = writeText.mock.calls[0][0] as string
    expect(copied).toContain('Erinnerungen ergänzen')
    expect(copied).toContain('https://example.com/invite')
  })
})

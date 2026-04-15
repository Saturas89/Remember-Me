import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { FriendsView } from './FriendsView'

afterEach(cleanup)

const defaultProps = {
  profileName: 'Anna',
  inviteUrl: 'https://example.com/invite',
  friends: [],
  friendAnswers: [],
  onRemoveFriend: vi.fn(),
  onImportAnswers: vi.fn(),
  onBack: vi.fn(),
}

describe('FriendsView – Einladungstext', () => {
  it('zeigt den zusammengeführten Erklärungstext', () => {
    const { container } = render(<FriendsView {...defaultProps} />)
    const hint = container.querySelector('.friends-hint')
    expect(hint?.textContent).toContain('Lade Freunde und Familie ein')
    expect(hint?.textContent).toContain('Teil deines persönlichen Lebensarchivs')
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

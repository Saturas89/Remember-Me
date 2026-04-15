import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

afterEach(cleanup)
import { BottomNav } from './BottomNav'

const onNavigate = vi.fn()

describe('BottomNav – Menüstruktur', () => {
  it('zeigt genau 5 Tabs', () => {
    render(<BottomNav current="home" onNavigate={onNavigate} />)
    const tabs = screen.getAllByRole('button')
    expect(tabs).toHaveLength(5)
  })

  it('zeigt die Labels in der korrekten Reihenfolge', () => {
    render(<BottomNav current="home" onNavigate={onNavigate} />)
    const tabs = screen.getAllByRole('button')
    const labels = tabs.map(t => t.querySelector('.bottom-nav__label')?.textContent)
    expect(labels).toEqual(['Lebensweg', 'Freunde', 'Vermächtnis', 'Features', 'Profil'])
  })

  it('platziert Vermächtnis als mittleren (3.) Tab', () => {
    render(<BottomNav current="home" onNavigate={onNavigate} />)
    const tabs = screen.getAllByRole('button')
    expect(tabs[2].querySelector('.bottom-nav__label')?.textContent).toBe('Vermächtnis')
  })

  it('enthält keinen Fragen-Tab mehr', () => {
    render(<BottomNav current="home" onNavigate={onNavigate} />)
    const tabs = screen.getAllByRole('button')
    const labels = tabs.map(t => t.querySelector('.bottom-nav__label')?.textContent)
    expect(labels).not.toContain('Fragen')
  })

  it('markiert den aktiven Tab korrekt', () => {
    render(<BottomNav current="archive" onNavigate={onNavigate} />)
    const activeTab = document.querySelector('.bottom-nav__tab--active')
    expect(activeTab?.querySelector('.bottom-nav__label')?.textContent).toBe('Vermächtnis')
  })

  it('ruft onNavigate mit dem richtigen Tab-Id auf', () => {
    const nav = vi.fn()
    render(<BottomNav current="home" onNavigate={nav} />)
    const tabs = screen.getAllByRole('button')
    fireEvent.click(tabs[2]) // Vermächtnis
    expect(nav).toHaveBeenCalledWith('archive')
  })
})

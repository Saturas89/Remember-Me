import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HomeView } from './HomeView'
import type { CustomQuestion } from '../types'

function getCustomCard(container: HTMLElement) {
  const btn = container.querySelector('.category-card--custom') as HTMLElement
  if (!btn) throw new Error('custom card button not found')
  return btn
}

const defaultProps = {
  profileName: 'Test',
  friends: [],
  friendAnswers: [],
  customQuestions: [] as CustomQuestion[],
  getCategoryProgress: () => 0,
  onSelectCategory: vi.fn(),
  onOpenFaq: vi.fn(),
}

describe('HomeView – Eigene Erinnerung card', () => {
  it('renders "Eigene Erinnerung" as the card title', () => {
    render(<HomeView {...defaultProps} />)
    expect(screen.getByRole('heading', { name: 'Eigene Erinnerung' })).toBeTruthy()
  })

  it('does not render the old label "Eigene Fragen"', () => {
    render(<HomeView {...defaultProps} />)
    expect(screen.queryByRole('heading', { name: 'Eigene Fragen' })).toBeNull()
  })

  it('shows placeholder text when no custom entries exist', () => {
    const { container } = render(<HomeView {...defaultProps} />)
    expect(getCustomCard(container).textContent).toContain('Was hat dich geprägt?')
    expect(getCustomCard(container).textContent).toContain('lade Liebste ein')
  })

  it('shows count text when custom entries exist', () => {
    const customQuestions: CustomQuestion[] = [
      { id: 'cq-1', text: 'Frage 1', type: 'text', createdAt: '2024-01-01T00:00:00.000Z' },
      { id: 'cq-2', text: 'Frage 2', type: 'text', createdAt: '2024-01-01T00:00:00.000Z' },
    ]
    const { container } = render(<HomeView {...defaultProps} customQuestions={customQuestions} />)
    expect(getCustomCard(container).textContent).not.toContain('2')
    expect(getCustomCard(container).textContent).toContain('Deine Erinnerungen')
    expect(getCustomCard(container).textContent).toContain('teile sie')
  })

  it('calls onSelectCategory with "custom" when the card is clicked', () => {
    const onSelectCategory = vi.fn()
    const { container } = render(<HomeView {...defaultProps} onSelectCategory={onSelectCategory} />)
    fireEvent.click(getCustomCard(container))
    expect(onSelectCategory).toHaveBeenCalledWith('custom')
  })
})

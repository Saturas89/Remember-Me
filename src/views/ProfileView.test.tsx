import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ProfileView } from './ProfileView'
import type { Answer } from '../types'

afterEach(cleanup)

// 60 Fragen insgesamt in CATEGORIES
// 3 Antworten → Math.round(3/60*100) = 5 %
// 6 Antworten → Math.round(6/60*100) = 10 %

function makeAnswers(count: number): Record<string, Answer> {
  const result: Record<string, Answer> = {}
  for (let i = 0; i < count; i++) {
    result[`q-${i}`] = {
      categoryId: 'childhood',
      value: 'Testantwort',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    }
  }
  return result
}

const defaultProps = {
  profile: { name: 'Anna', createdAt: '2024-01-01T00:00:00.000Z' },
  answers: {} as Record<string, Answer>,
  friendCount: 0,
  exportData: {
    profile: null,
    answers: {},
    friends: [],
    friendAnswers: [],
    customQuestions: [],
  },
  safeName: 'anna',
  onSave: vi.fn(),
  onBack: vi.fn(),
  onExportMarkdown: vi.fn(),
  onExportJson: vi.fn(),
  onImportBackup: vi.fn(() => ({ ok: true })),
  onOpenImport: vi.fn(),
  onOpenFaq: vi.fn(),
}

function getFill(container: HTMLElement) {
  return container.querySelector('.tree-progress-logo__fill') as HTMLElement | null
}

describe('ProfileView – TreeProgressLogo', () => {
  it('zeigt das tree-progress-logo statt dem alten Initialen-Avatar', () => {
    const { container } = render(<ProfileView {...defaultProps} />)
    expect(container.querySelector('.tree-progress-logo')).toBeTruthy()
    expect(container.querySelector('.profile-avatar')).toBeNull()
  })

  it('Fill-Höhe ist 0 % bei 0 Antworten (0 %)', () => {
    const { container } = render(<ProfileView {...defaultProps} answers={makeAnswers(0)} />)
    expect(getFill(container)?.style.height).toBe('0%')
  })

  it('Fill-Höhe ist 10 % (1 Segment) ab 5 % Fortschritt (3 von 60 Antworten)', () => {
    const { container } = render(<ProfileView {...defaultProps} answers={makeAnswers(3)} />)
    expect(getFill(container)?.style.height).toBe('10%')
  })

  it('Fill-Höhe bleibt 10 % bei 8 % Fortschritt (5 von 60 – unter 10%-Schwelle)', () => {
    const { container } = render(<ProfileView {...defaultProps} answers={makeAnswers(5)} />)
    expect(getFill(container)?.style.height).toBe('10%')
  })

  it('Fill-Höhe springt auf 20 % (2 Segmente) ab 10 % Fortschritt (6 von 60)', () => {
    const { container } = render(<ProfileView {...defaultProps} answers={makeAnswers(6)} />)
    expect(getFill(container)?.style.height).toBe('20%')
  })

  it('Fill-Höhe ist 50 % (5 Segmente) bei 40 % Fortschritt (24 von 60 Antworten)', () => {
    // 24/60 = 40 % → Schwellen [5,10,20,30,40] erfüllt → 5 Segmente
    const { container } = render(<ProfileView {...defaultProps} answers={makeAnswers(24)} />)
    expect(getFill(container)?.style.height).toBe('50%')
  })

  it('Fill-Höhe ist 60 % (6 Segmente) sobald Schwelle 50 % erreicht (30 von 60)', () => {
    // 30/60 = 50 % → Schwellen [5,10,20,30,40,50] erfüllt → 6 Segmente
    const { container } = render(<ProfileView {...defaultProps} answers={makeAnswers(30)} />)
    expect(getFill(container)?.style.height).toBe('60%')
  })

  it('Fill-Höhe ist 100 % (10 Segmente) ab 90 % Fortschritt (54 von 60)', () => {
    const { container } = render(<ProfileView {...defaultProps} answers={makeAnswers(54)} />)
    expect(getFill(container)?.style.height).toBe('100%')
  })

  it('Fill-Höhe ist 100 % (10 Segmente) bei vollständig ausgefülltem Profil (60 von 60)', () => {
    const { container } = render(<ProfileView {...defaultProps} answers={makeAnswers(60)} />)
    expect(getFill(container)?.style.height).toBe('100%')
  })
})

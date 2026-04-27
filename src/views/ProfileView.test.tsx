import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import { ProfileView } from './ProfileView'
import type { Answer } from '../types'

// Mock the hooks that ProfileView will use
vi.mock('../hooks/useStreak', () => ({
  useStreak: () => ({
    streak: {
      current: 5,
      longest: 12,
      lastAnswerDate: '2024-01-15'
    },
    totalAnswered: 25,
    recordAnswer: vi.fn(),
    checkStreakReset: vi.fn()
  })
}))

vi.mock('../hooks/useReminder', () => ({
  useReminder: () => ({
    state: {
      permission: 'none',
      backoffStage: 0,
      lastShownAt: undefined,
      lastVariantIdx: undefined
    },
    enable: vi.fn(),
    disable: vi.fn(),
    reschedule: vi.fn()
  })
}))

afterEach(cleanup)

// 60 Fragen insgesamt in CATEGORIES
// 3 Antworten → Math.round(3/60*100) = 5 %
// 6 Antworten → Math.round(6/60*100) = 10 %

function makeAnswers(count: number): Record<string, Answer> {
  const result: Record<string, Answer> = {}
  for (let i = 0; i < count; i++) {
    result[`q-${i}`] = {
      id: `q-${i}`,
      questionId: `q-${i}`,
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
  onShowReleaseNotes: vi.fn(),
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

describe('ProfileView – Reminder Settings (REQ-016)', () => {
  it('renders reminder settings card with correct testid', () => {
    render(<ProfileView {...defaultProps} />)
    
    // Spec: FR-16.10 - Settings-UI mit data-testid="reminder-settings"
    const settingsCard = screen.getByTestId('reminder-settings')
    expect(settingsCard).not.toBeNull()
  })

  it('displays reminder toggle with correct testid and type', () => {
    render(<ProfileView {...defaultProps} />)
    
    // Spec: data-testid="reminder-toggle", <input type="checkbox"> mit <label>
    const toggle = screen.getByTestId('reminder-toggle') as HTMLInputElement
    expect(toggle).not.toBeNull()
    expect(toggle.type).toBe('checkbox')
    
    // Should have associated label
    const labels = screen.getAllByText(/benachrichtigungen|reminder/i)
    expect(labels.length).toBeGreaterThan(0)
  })

  it('shows cadence explanation text without selector', () => {
    render(<ProfileView {...defaultProps} />)
    
    // Spec: Erklär-Text zur automatischen Cadence ohne Selector
    const settingsCard = screen.getByTestId('reminder-settings')
    const text = settingsCard.textContent?.toLowerCase()
    
    expect(text).toMatch(/(3|10|24).*(tag|day)/i) // Should mention the cadence stages
    expect(text).toMatch(/(automatisch|automatic)/i) // Should mention automatic
    
    // Should NOT have cadence selector
    expect(screen.queryByRole('select')).toBeNull()
    expect(screen.queryByRole('slider')).toBeNull()
  })

  it('shows quiet hours information as read-only', () => {
    render(<ProfileView {...defaultProps} />)
    
    // Spec: "Stille Stunden"-Info (read-only Hinweis)
    const settingsCard = screen.getByTestId('reminder-settings')
    const text = settingsCard.textContent?.toLowerCase()
    
    expect(text).toMatch(/(stille|quiet).*(stunden|hours|22|8)/i)
  })

  it('displays streak stats with current and longest values', () => {
    render(<ProfileView {...defaultProps} />)
    
    // Spec: Streak-Stats (current / longest) 
    const settingsCard = screen.getByTestId('reminder-settings')
    const text = settingsCard.textContent
    
    // Should show the mocked streak values: current: 5, longest: 12
    expect(text).toMatch(/5/) // current streak
    expect(text).toMatch(/12/) // longest streak
    expect(text).toMatch(/(aktuell|current|längste|longest)/i)
  })

  it('reminder toggle can be toggled and calls enable/disable', () => {
    const mockEnable = vi.fn()
    const mockDisable = vi.fn()
    
    // Mock enabled state
    vi.mocked(vi.importMock('../hooks/useReminder')).useReminder.mockReturnValue({
      state: {
        permission: 'none',
        backoffStage: 0,
        lastShownAt: undefined,
        lastVariantIdx: undefined
      },
      enable: mockEnable,
      disable: mockDisable,
      reschedule: vi.fn()
    })
    
    render(<ProfileView {...defaultProps} />)
    
    const toggle = screen.getByTestId('reminder-toggle') as HTMLInputElement
    
    // Toggle should be unchecked for 'none' permission
    expect(toggle.checked).toBe(false)
    
    fireEvent.click(toggle)
    
    expect(mockEnable).toHaveBeenCalled()
  })

  it('shows permission denied hint when notification permission is denied', () => {
    // Mock denied permission state
    vi.mocked(vi.importMock('../hooks/useReminder')).useReminder.mockReturnValue({
      state: {
        permission: 'dismissed',
        backoffStage: 0,
        lastShownAt: undefined,
        lastVariantIdx: undefined
      },
      enable: vi.fn(),
      disable: vi.fn(),
      reschedule: vi.fn()
    })
    
    // Mock Notification.permission as denied
    Object.defineProperty(window, 'Notification', {
      value: { permission: 'denied' },
      configurable: true
    })
    
    render(<ProfileView {...defaultProps} />)
    
    // Spec: Bei permission === 'denied' Hinweis statt Toggle
    const settingsCard = screen.getByTestId('reminder-settings')
    const text = settingsCard.textContent?.toLowerCase()
    
    expect(text).toMatch(/(browser|os).*(einstellung|setting)/i)
    
    // Toggle should be disabled or hidden
    const toggle = screen.queryByTestId('reminder-toggle') as HTMLInputElement
    if (toggle) {
      expect(toggle.disabled).toBe(true)
    }
  })

  it('shows iOS fallback hint when showTrigger is not available', () => {
    // Mock iOS environment (no showTrigger)
    Object.defineProperty(Notification.prototype, 'showTrigger', { 
      value: undefined,
      configurable: true 
    })
    
    render(<ProfileView {...defaultProps} />)
    
    // Spec: NFR iOS-Verhalten - Hinweis "Auf iOS funktionieren Erinnerungen aktuell nur in der App"
    const settingsCard = screen.getByTestId('reminder-settings')
    const text = settingsCard.textContent?.toLowerCase()
    
    expect(text).toMatch(/(ios|iphone|ipad).*(app)/i)
  })

  it('reminder settings card has proper section structure', () => {
    render(<ProfileView {...defaultProps} />)
    
    const settingsCard = screen.getByTestId('reminder-settings')
    
    // Should be part of profile settings
    expect(settingsCard.tagName).toMatch(/DIV|SECTION|ARTICLE/i)
    
    // Should have a title/heading
    const headings = settingsCard.querySelectorAll('h1, h2, h3, h4, h5, h6, .title, .heading')
    expect(headings.length).toBeGreaterThan(0)
  })

  it('shows enabled reminder toggle when permission is granted', () => {
    // Mock enabled state
    vi.mocked(vi.importMock('../hooks/useReminder')).useReminder.mockReturnValue({
      state: {
        permission: 'enabled',
        backoffStage: 1,
        lastShownAt: Date.now() - 24 * 60 * 60 * 1000,
        lastVariantIdx: 3
      },
      enable: vi.fn(),
      disable: vi.fn(),
      reschedule: vi.fn()
    })
    
    render(<ProfileView {...defaultProps} />)
    
    const toggle = screen.getByTestId('reminder-toggle') as HTMLInputElement
    
    // Toggle should be checked for 'enabled' permission
    expect(toggle.checked).toBe(true)
  })
})

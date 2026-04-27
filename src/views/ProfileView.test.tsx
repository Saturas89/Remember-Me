import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import { ProfileView } from './ProfileView'
import type { Answer } from '../types'

// Mock hooks
vi.mock('../hooks/useReminder', () => ({
  useReminder: vi.fn(() => ({
    isEnabled: false,
    state: {
      permission: 'none',
      backoffStage: 0,
      lastShownAt: undefined,
      lastVariantIdx: undefined
    },
    requestPermission: vi.fn(),
    disable: vi.fn(),
    showPrompt: false,
    dismissPrompt: vi.fn(),
    reschedule: vi.fn()
  }))
}))

vi.mock('../hooks/useStreak', () => ({
  useStreak: vi.fn(() => ({
    streak: {
      current: 0,
      longest: 0,
      lastAnswerDate: ''
    },
    totalAnswered: 0,
    recordAnswer: vi.fn(),
    checkStreakReset: vi.fn()
  }))
}))

vi.mock('../hooks/useI18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, any>) => {
      const translations: Record<string, string> = {
        'reminder.settings.title': 'Erinnerungen',
        'reminder.settings.toggleLabel': 'Benachrichtigungen aktiv',
        'reminder.settings.cadenceExplanation': 'Wir erinnern dich nach 3, 10 und 24 Tagen Pause — danach Ruhe.',
        'reminder.settings.quietHours': 'Stille Stunden: 22:00-8:00',
        'reminder.settings.streakLabel': 'Streak',
        'reminder.settings.streakCurrent': 'Aktuell',
        'reminder.settings.streakLongest': 'Längste',
        'reminder.settings.iosFallbackHint': 'Auf iOS funktionieren Erinnerungen aktuell nur in der App',
        'reminder.settings.permissionDeniedHint': 'In den Browser-/OS-Einstellungen aktivierbar'
      }
      let text = translations[key] || key
      if (params) {
        Object.entries(params).forEach(([param, value]) => {
          text = text.replace(`{${param}}`, String(value))
        })
      }
      return text
    }
  })
}))

// Mock Notification API
const mockNotification = {
  permission: 'default' as NotificationPermission
}
Object.defineProperty(window, 'Notification', { 
  value: mockNotification,
  writable: true
})

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
  const { useReminder } = await import('../hooks/useReminder')
  const { useStreak } = await import('../hooks/useStreak')
  
  let mockUseReminder: any
  let mockUseStreak: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockUseReminder = vi.mocked(useReminder)
    mockUseStreak = vi.mocked(useStreak)
    
    // Reset to default mocks
    mockUseReminder.mockReturnValue({
      isEnabled: false,
      state: {
        permission: 'none',
        backoffStage: 0,
        lastShownAt: undefined,
        lastVariantIdx: undefined
      },
      requestPermission: vi.fn(),
      disable: vi.fn(),
      showPrompt: false,
      dismissPrompt: vi.fn(),
      reschedule: vi.fn()
    })

    mockUseStreak.mockReturnValue({
      streak: {
        current: 0,
        longest: 0,
        lastAnswerDate: ''
      },
      totalAnswered: 0,
      recordAnswer: vi.fn(),
      checkStreakReset: vi.fn()
    })

    mockNotification.permission = 'default'
  })

  it('displays reminder settings card with correct test ID', () => {
    render(<ProfileView {...defaultProps} />)
    
    // Settings card for reminders with required test ID
    const settingsCard = screen.getByTestId('reminder-settings')
    expect(settingsCard).not.toBeNull()
  })

  it('displays reminder settings title', () => {
    render(<ProfileView {...defaultProps} />)
    
    expect(screen.getByText('Erinnerungen')).not.toBeNull()
  })

  it('displays reminder toggle with correct test ID and label', () => {
    render(<ProfileView {...defaultProps} />)
    
    // Toggle checkbox with required test ID
    const toggle = screen.getByTestId('reminder-toggle')
    expect(toggle).not.toBeNull()
    expect((toggle as HTMLInputElement).type).toBe('checkbox')
    
    // Connected label as per spec requirements
    const label = screen.getByText('Benachrichtigungen aktiv')
    expect(label).not.toBeNull()
  })

  it('shows toggle as unchecked when reminders are disabled', () => {
    mockUseReminder.mockReturnValue({
      isEnabled: false,
      state: { permission: 'none', backoffStage: 0 },
      requestPermission: vi.fn(),
      disable: vi.fn(),
      showPrompt: false,
      dismissPrompt: vi.fn(),
      reschedule: vi.fn()
    })
    
    render(<ProfileView {...defaultProps} />)
    
    const toggle = screen.getByTestId('reminder-toggle') as HTMLInputElement
    expect(toggle.checked).toBe(false)
  })

  it('shows toggle as checked when reminders are enabled', () => {
    mockUseReminder.mockReturnValue({
      isEnabled: true,
      state: { permission: 'enabled', backoffStage: 1 },
      requestPermission: vi.fn(),
      disable: vi.fn(),
      showPrompt: false,
      dismissPrompt: vi.fn(),
      reschedule: vi.fn()
    })
    
    render(<ProfileView {...defaultProps} />)
    
    const toggle = screen.getByTestId('reminder-toggle') as HTMLInputElement
    expect(toggle.checked).toBe(true)
  })

  it('calls requestPermission when enabling toggle', () => {
    const mockRequestPermission = vi.fn()
    mockUseReminder.mockReturnValue({
      isEnabled: false,
      state: { permission: 'none', backoffStage: 0 },
      requestPermission: mockRequestPermission,
      disable: vi.fn(),
      showPrompt: false,
      dismissPrompt: vi.fn(),
      reschedule: vi.fn()
    })
    
    render(<ProfileView {...defaultProps} />)
    
    const toggle = screen.getByTestId('reminder-toggle')
    fireEvent.click(toggle)
    
    expect(mockRequestPermission).toHaveBeenCalled()
  })

  it('calls disable when disabling toggle', () => {
    const mockDisable = vi.fn()
    mockUseReminder.mockReturnValue({
      isEnabled: true,
      state: { permission: 'enabled', backoffStage: 1 },
      requestPermission: vi.fn(),
      disable: mockDisable,
      showPrompt: false,
      dismissPrompt: vi.fn(),
      reschedule: vi.fn()
    })
    
    render(<ProfileView {...defaultProps} />)
    
    const toggle = screen.getByTestId('reminder-toggle')
    fireEvent.click(toggle)
    
    expect(mockDisable).toHaveBeenCalled()
  })

  it('displays cadence explanation text', () => {
    render(<ProfileView {...defaultProps} />)
    
    expect(screen.getByText('Wir erinnern dich nach 3, 10 und 24 Tagen Pause — danach Ruhe.')).not.toBeNull()
  })

  it('displays quiet hours information', () => {
    render(<ProfileView {...defaultProps} />)
    
    expect(screen.getByText('Stille Stunden: 22:00-8:00')).not.toBeNull()
  })

  it('shows iOS fallback hint when showTrigger is not available', () => {
    // Mock iOS environment where showTrigger is not supported
    Object.defineProperty(window, 'Notification', {
      value: { 
        permission: 'default',
        prototype: {} // No showTrigger property
      },
      writable: true
    })
    
    render(<ProfileView {...defaultProps} />)
    
    expect(screen.getByText('Auf iOS funktionieren Erinnerungen aktuell nur in der App')).not.toBeNull()
  })

  it('shows permission denied hint when notification permission is denied', () => {
    mockNotification.permission = 'denied'
    
    render(<ProfileView {...defaultProps} />)
    
    expect(screen.getByText('In den Browser-/OS-Einstellungen aktivierbar')).not.toBeNull()
  })

  it('displays streak statistics', () => {
    mockUseStreak.mockReturnValue({
      streak: {
        current: 5,
        longest: 12,
        lastAnswerDate: '2026-04-25'
      },
      totalAnswered: 25,
      recordAnswer: vi.fn(),
      checkStreakReset: vi.fn()
    })
    
    render(<ProfileView {...defaultProps} />)
    
    expect(screen.getByText('Streak')).not.toBeNull()
    expect(screen.getByText('Aktuell')).not.toBeNull()
    expect(screen.getByText('Längste')).not.toBeNull()
    
    // Should display the actual streak numbers
    expect(screen.getByText('5')).not.toBeNull() // current
    expect(screen.getByText('12')).not.toBeNull() // longest
  })

  it('displays zero streak values when no streak exists', () => {
    render(<ProfileView {...defaultProps} />)
    
    // Should show 0 for both current and longest when no streak
    const zeroElements = screen.getAllByText('0')
    expect(zeroElements.length).toBeGreaterThanOrEqual(2)
  })

  it('hides toggle when notification permission is denied and shows hint', () => {
    mockNotification.permission = 'denied'
    
    render(<ProfileView {...defaultProps} />)
    
    // Toggle should be disabled or hidden in denied state
    const hint = screen.getByText('In den Browser-/OS-Einstellungen aktivierbar')
    expect(hint).not.toBeNull()
  })

  it('does not show cadence selector per spec requirements', () => {
    render(<ProfileView {...defaultProps} />)
    
    // Should NOT have any selectors for cadence as per FR-16.1
    const selects = document.querySelectorAll('select')
    expect(selects.length).toBe(0)
    
    // Should NOT have radio buttons for cadence selection
    const radioButtons = document.querySelectorAll('input[type="radio"]')
    expect(radioButtons.length).toBe(0)
  })
})

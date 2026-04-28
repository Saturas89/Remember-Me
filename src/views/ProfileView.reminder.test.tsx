import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ProfileView } from './ProfileView'
import type { Answer } from '../types'
import { UI_DE as de } from '../locales/de/ui'

// Mock the hooks
const mockUseReminder = {
  showPrompt: false,
  requestPermission: vi.fn(),
  dismissPrompt: vi.fn(),
  isEnabled: false,
  state: {
    permission: 'none' as 'none' | 'enabled' | 'dismissed',
    backoffStage: 0 as 0 | 1 | 2 | 3,
    lastShownAt: undefined as number | undefined,
    lastVariantIdx: undefined as number | undefined
  },
  reschedule: vi.fn(),
  disable: vi.fn()
}

const mockUseStreak = {
  streak: {
    current: 0,
    longest: 0,
    lastAnswerDate: ''
  },
  totalAnswered: 0,
  recordAnswer: vi.fn(),
  checkStreakReset: vi.fn()
}

vi.mock('../hooks/useReminder', () => ({
  useReminder: () => mockUseReminder
}))

vi.mock('../hooks/useStreak', () => ({
  useStreak: () => mockUseStreak
}))

// Mock Notification API — needs prototype.showTrigger so the supportsShowTrigger
// guard in ProfileView renders the toggle (not the iOS fallback).
const mockNotification = Object.assign(
  function Notification() { /* noop */ },
  {
    permission: 'default' as NotificationPermission,
    prototype: { showTrigger: undefined },
  },
)

Object.defineProperty(window, 'Notification', {
  value: mockNotification,
  configurable: true,
  writable: true,
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

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

describe('ProfileView - Reminder Settings (REQ-016)', () => {
  beforeEach(() => {
    mockUseReminder.isEnabled = false
    mockUseReminder.state.permission = 'none'
    mockNotification.permission = 'default'
    mockNotification.prototype = { showTrigger: undefined }
    // Re-anchor the global to our mock — earlier tests may have replaced it
    Object.defineProperty(window, 'Notification', {
      value: mockNotification,
      configurable: true,
      writable: true,
    })
  })

  it('renders reminder settings card with correct testid', () => {
    render(<ProfileView {...defaultProps} />)
    
    // Reminder settings card should have the required data-testid
    const reminderCard = screen.getByTestId('reminder-settings')
    expect(reminderCard).not.toBeNull()
  })

  it('displays reminder settings title', () => {
    render(<ProfileView {...defaultProps} />)
    
    expect(screen.getByText(de.reminder.settings.title)).not.toBeNull()
  })

  it('renders reminder toggle with correct testid and input type', () => {
    render(<ProfileView {...defaultProps} />)
    
    // Toggle should have required data-testid and be a checkbox
    const toggle = screen.getByTestId('reminder-toggle')
    expect(toggle).not.toBeNull()
    expect((toggle as HTMLInputElement).type).toBe('checkbox')
  })

  it('reminder toggle has associated label', () => {
    render(<ProfileView {...defaultProps} />)
    
    const toggle = screen.getByTestId('reminder-toggle') as HTMLInputElement
    const label = screen.getByText(de.reminder.settings.toggleLabel)
    
    // Label should be properly associated with input
    expect(label).not.toBeNull()
    expect(toggle.getAttribute('aria-labelledby') || toggle.id).toBeTruthy()
  })

  it('displays cadence explanation text', () => {
    render(<ProfileView {...defaultProps} />)
    
    expect(screen.getByText(de.reminder.settings.cadenceExplanation)).not.toBeNull()
  })

  it('displays quiet hours information', () => {
    render(<ProfileView {...defaultProps} />)
    
    expect(screen.getByText(de.reminder.settings.quietHours)).not.toBeNull()
  })

  it('shows toggle as unchecked when reminder disabled', () => {
    mockUseReminder.isEnabled = false
    
    render(<ProfileView {...defaultProps} />)
    
    const toggle = screen.getByTestId('reminder-toggle') as HTMLInputElement
    expect(toggle.checked).toBe(false)
  })

  it('shows toggle as checked when reminder enabled', () => {
    mockUseReminder.isEnabled = true
    mockUseReminder.state.permission = 'enabled'
    
    render(<ProfileView {...defaultProps} />)
    
    const toggle = screen.getByTestId('reminder-toggle') as HTMLInputElement
    expect(toggle.checked).toBe(true)
  })

  it('calls requestPermission when toggle enabled from off state', () => {
    mockUseReminder.isEnabled = false
    mockNotification.permission = 'default'
    
    render(<ProfileView {...defaultProps} />)
    
    const toggle = screen.getByTestId('reminder-toggle')
    fireEvent.click(toggle)
    
    expect(mockUseReminder.requestPermission).toHaveBeenCalledTimes(1)
  })

  it('calls disable when toggle turned off from enabled state', () => {
    mockUseReminder.isEnabled = true
    mockUseReminder.state.permission = 'enabled'
    
    render(<ProfileView {...defaultProps} />)
    
    const toggle = screen.getByTestId('reminder-toggle')
    fireEvent.click(toggle)
    
    expect(mockUseReminder.disable).toHaveBeenCalledTimes(1)
  })

  it('displays permission denied hint when notification permission denied', () => {
    mockNotification.permission = 'denied'
    
    render(<ProfileView {...defaultProps} />)
    
    expect(screen.getByText(de.reminder.settings.permissionDeniedHint)).not.toBeNull()
  })

  it('displays iOS fallback hint when showTrigger unavailable', () => {
    // Mock showTrigger as unavailable (simulates iOS)
    Object.defineProperty(window, 'Notification', {
      value: {
        permission: 'default',
        prototype: {} // no showTrigger
      },
      configurable: true
    })
    
    render(<ProfileView {...defaultProps} />)
    
    expect(screen.getByText(de.reminder.settings.iosFallbackHint)).not.toBeNull()
  })

  it('displays current streak value', () => {
    mockUseStreak.streak.current = 7
    
    render(<ProfileView {...defaultProps} />)
    
    expect(screen.getByText(de.reminder.settings.streakCurrent)).not.toBeNull()
    expect(screen.getByText('7')).not.toBeNull()
  })

  it('displays longest streak value', () => {
    mockUseStreak.streak.longest = 15
    
    render(<ProfileView {...defaultProps} />)
    
    expect(screen.getByText(de.reminder.settings.streakLongest)).not.toBeNull()
    expect(screen.getByText('15')).not.toBeNull()
  })

  it('shows streak label', () => {
    render(<ProfileView {...defaultProps} />)
    
    expect(screen.getByText(de.reminder.settings.streakLabel)).not.toBeNull()
  })

  it('displays zero streak when no streak data', () => {
    mockUseStreak.streak.current = 0
    mockUseStreak.streak.longest = 0
    
    render(<ProfileView {...defaultProps} />)
    
    // Should show zero values
    const currentElements = screen.getAllByText('0')
    expect(currentElements.length).toBeGreaterThanOrEqual(2) // current + longest
  })

  it('disables toggle and shows permission-denied hint when denied (FR-16.11)', () => {
    mockNotification.permission = 'denied'

    render(<ProfileView {...defaultProps} />)

    const toggle = screen.getByTestId('reminder-toggle') as HTMLInputElement
    expect(toggle.disabled).toBe(true)
    expect(screen.getByText(de.reminder.settings.permissionDeniedHint)).not.toBeNull()
  })

  it('disables toggle and shows iOS hint when showTrigger unavailable', () => {
    // Mock iOS environment
    Object.defineProperty(window, 'Notification', {
      value: {
        permission: 'default',
        prototype: {} // no showTrigger
      },
      configurable: true
    })

    render(<ProfileView {...defaultProps} />)

    const toggle = screen.getByTestId('reminder-toggle') as HTMLInputElement
    expect(toggle.disabled).toBe(true)
    expect(screen.getByText(de.reminder.settings.iosFallbackHint)).not.toBeNull()
  })

  it('streak stats show meaningful values for active users', () => {
    mockUseStreak.streak.current = 12
    mockUseStreak.streak.longest = 25
    mockUseStreak.totalAnswered = 45
    
    render(<ProfileView {...defaultProps} />)
    
    expect(screen.getByText('12')).not.toBeNull() // current streak
    expect(screen.getByText('25')).not.toBeNull() // longest streak
  })

  it('reminder settings appear in profile view structure', () => {
    render(<ProfileView {...defaultProps} />)
    
    // Should be within the profile view content
    const reminderSettings = screen.getByTestId('reminder-settings')
    expect(reminderSettings.closest('.profile-view')).not.toBeNull()
  })
})
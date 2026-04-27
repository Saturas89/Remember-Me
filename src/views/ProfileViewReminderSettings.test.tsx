import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

// Mock the hooks that ProfileView will use according to the API contract
const mockUseStreak = vi.fn(() => ({
  streak: { current: 0, longest: 0, lastAnswerDate: '' },
  totalAnswered: 0,
  recordAnswer: vi.fn(),
  checkStreakReset: vi.fn()
}))

const mockUseReminder = vi.fn(() => ({
  state: { permission: 'none', backoffStage: 0, lastShownAt: undefined, lastVariantIdx: undefined },
  enable: vi.fn(),
  disable: vi.fn(),
  reschedule: vi.fn()
}))

vi.mock('../hooks/useStreak', () => ({ useStreak: mockUseStreak }))
vi.mock('../hooks/useReminder', () => ({ useReminder: mockUseReminder }))

// Mock Notification API
function installNotification(permission: NotificationPermission) {
  const Notif = Object.assign(
    function Notification() { /* no-op */ },
    { permission, requestPermission: vi.fn() },
  )
  ;(globalThis as unknown as { Notification: unknown }).Notification = Notif
  ;(window as unknown as { Notification: unknown }).Notification = Notif
}

function uninstallNotification() {
  delete (globalThis as { Notification?: unknown }).Notification
  delete (window as { Notification?: unknown }).Notification
}

async function loadProfileView() {
  vi.resetModules()
  const module = await import('./ProfileView')
  return module.ProfileView
}

const defaultProps = {
  profile: { name: 'TestUser', createdAt: '2024-01-01T00:00:00.000Z' },
  answers: {},
  friendCount: 0,
  exportData: {
    profile: null,
    answers: {},
    friends: [],
    friendAnswers: [],
    customQuestions: [],
  },
  safeName: 'testuser',
  onSave: vi.fn(),
  onBack: vi.fn(),
  onExportMarkdown: vi.fn(),
  onExportJson: vi.fn(),
  onImportBackup: vi.fn(() => ({ ok: true })),
  onOpenImport: vi.fn(),
  onOpenFaq: vi.fn(),
  onShowReleaseNotes: vi.fn(),
}

describe('ProfileView - Reminder Settings Section', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    uninstallNotification()
    installNotification('default')
  })

  afterEach(() => {
    cleanup()
    uninstallNotification()
  })

  it('renders reminder settings card with correct testid', async () => {
    const ProfileView = await loadProfileView()
    
    render(<ProfileView {...defaultProps} />)
    
    // Uses spec-derived testid for reminder settings identification
    const reminderCard = screen.getByTestId('reminder-settings')
    expect(reminderCard).toBeInTheDocument()
  })

  it('renders reminder toggle with correct testid and label', async () => {
    const ProfileView = await loadProfileView()
    
    render(<ProfileView {...defaultProps} />)
    
    // Uses spec-derived testid for toggle identification
    const toggle = screen.getByTestId('reminder-toggle')
    expect(toggle).toBeInTheDocument()
    expect(toggle.tagName).toBe('INPUT')
    expect(toggle).toHaveAttribute('type', 'checkbox')
    
    // Should have associated label
    const label = screen.getByLabelText(/Benachrichtigungen aktiv/)
    expect(label).toBeInTheDocument()
  })

  it('toggle is unchecked when reminder state is none or dismissed', async () => {
    mockUseReminder.mockReturnValue({
      state: { permission: 'none', backoffStage: 0 },
      enable: vi.fn(),
      disable: vi.fn(),
      reschedule: vi.fn()
    })
    
    const ProfileView = await loadProfileView()
    render(<ProfileView {...defaultProps} />)
    
    const toggle = screen.getByTestId('reminder-toggle')
    expect(toggle).not.toBeChecked()
  })

  it('toggle is checked when reminder state is enabled', async () => {
    mockUseReminder.mockReturnValue({
      state: { permission: 'enabled', backoffStage: 1 },
      enable: vi.fn(),
      disable: vi.fn(),
      reschedule: vi.fn()
    })
    
    const ProfileView = await loadProfileView()
    render(<ProfileView {...defaultProps} />)
    
    const toggle = screen.getByTestId('reminder-toggle')
    expect(toggle).toBeChecked()
  })

  it('calls enable() when toggle is turned on', async () => {
    const mockEnable = vi.fn()
    mockUseReminder.mockReturnValue({
      state: { permission: 'none', backoffStage: 0 },
      enable: mockEnable,
      disable: vi.fn(),
      reschedule: vi.fn()
    })
    
    const ProfileView = await loadProfileView()
    render(<ProfileView {...defaultProps} />)
    
    const toggle = screen.getByTestId('reminder-toggle')
    fireEvent.click(toggle)
    
    expect(mockEnable).toHaveBeenCalledTimes(1)
  })

  it('calls disable() when toggle is turned off', async () => {
    const mockDisable = vi.fn()
    mockUseReminder.mockReturnValue({
      state: { permission: 'enabled', backoffStage: 1 },
      enable: vi.fn(),
      disable: mockDisable,
      reschedule: vi.fn()
    })
    
    const ProfileView = await loadProfileView()
    render(<ProfileView {...defaultProps} />)
    
    const toggle = screen.getByTestId('reminder-toggle')
    fireEvent.click(toggle)
    
    expect(mockDisable).toHaveBeenCalledTimes(1)
  })

  it('displays cadence explanation text', async () => {
    const ProfileView = await loadProfileView()
    render(<ProfileView {...defaultProps} />)
    
    expect(screen.getByText(/Wir erinnern dich nach 3, 10 und 24 Tagen Pause/)).toBeInTheDocument()
  })

  it('displays quiet hours information', async () => {
    const ProfileView = await loadProfileView()
    render(<ProfileView {...defaultProps} />)
    
    expect(screen.getByText(/22:00.*8:00/)).toBeInTheDocument()
  })

  it('displays streak information with current and longest values', async () => {
    mockUseStreak.mockReturnValue({
      streak: { current: 5, longest: 12, lastAnswerDate: '2026-04-25' },
      totalAnswered: 25,
      recordAnswer: vi.fn(),
      checkStreakReset: vi.fn()
    })
    
    const ProfileView = await loadProfileView()
    render(<ProfileView {...defaultProps} />)
    
    expect(screen.getByText(/Aktuell.*5/)).toBeInTheDocument()
    expect(screen.getByText(/Längste.*12/)).toBeInTheDocument()
  })

  it('displays zero streak values when no streak exists', async () => {
    mockUseStreak.mockReturnValue({
      streak: { current: 0, longest: 0, lastAnswerDate: '' },
      totalAnswered: 0,
      recordAnswer: vi.fn(),
      checkStreakReset: vi.fn()
    })
    
    const ProfileView = await loadProfileView()
    render(<ProfileView {...defaultProps} />)
    
    expect(screen.getByText(/Aktuell.*0/)).toBeInTheDocument()
    expect(screen.getByText(/Längste.*0/)).toBeInTheDocument()
  })

  it('shows permission denied hint when Notification.permission is denied', async () => {
    installNotification('denied')
    
    const ProfileView = await loadProfileView()
    render(<ProfileView {...defaultProps} />)
    
    expect(screen.getByText(/Browser-\/OS-Einstellungen aktivierbar/)).toBeInTheDocument()
    // Toggle should not be visible when permission is denied
    expect(screen.queryByTestId('reminder-toggle')).not.toBeInTheDocument()
  })

  it('shows iOS fallback hint when showTrigger is not available', async () => {
    const Notif = Object.assign(
      function Notification() { /* no-op */ },
      { permission: 'default', requestPermission: vi.fn(), prototype: {} }, // No showTrigger
    )
    ;(globalThis as unknown as { Notification: unknown }).Notification = Notif
    ;(window as unknown as { Notification: unknown }).Notification = Notif
    
    const ProfileView = await loadProfileView()
    render(<ProfileView {...defaultProps} />)
    
    expect(screen.getByText(/Auf iOS funktionieren Erinnerungen aktuell nur in der App/)).toBeInTheDocument()
    // Toggle should be disabled on iOS
    const toggle = screen.queryByTestId('reminder-toggle')
    if (toggle) {
      expect(toggle).toBeDisabled()
    }
  })

  it('displays settings card title', async () => {
    const ProfileView = await loadProfileView()
    render(<ProfileView {...defaultProps} />)
    
    expect(screen.getByText(/Erinnerungen/)).toBeInTheDocument()
  })

  it('streak labels are displayed correctly', async () => {
    const ProfileView = await loadProfileView()
    render(<ProfileView {...defaultProps} />)
    
    expect(screen.getByText(/Streak/)).toBeInTheDocument()
    expect(screen.getByText(/Aktuell/)).toBeInTheDocument()
    expect(screen.getByText(/Längste/)).toBeInTheDocument()
  })

  it('persists after ProfileView re-render without additional props', async () => {
    const ProfileView = await loadProfileView()
    const { rerender } = render(<ProfileView {...defaultProps} />)
    
    expect(screen.getByTestId('reminder-settings')).toBeInTheDocument()
    
    // Re-render without changing props - reminder settings should still be there
    rerender(<ProfileView {...defaultProps} />)
    
    expect(screen.getByTestId('reminder-settings')).toBeInTheDocument()
    expect(screen.getByTestId('reminder-toggle')).toBeInTheDocument()
  })

  it('does not break existing ProfileView functionality', async () => {
    const ProfileView = await loadProfileView()
    render(<ProfileView {...defaultProps} />)
    
    // Existing ProfileView elements should still be present
    expect(screen.getByText('TestUser')).toBeInTheDocument()
    
    // Tree progress logo should still exist (from existing tests)
    const container = screen.getByTestId('reminder-settings').closest('body')
    expect(container?.querySelector('.tree-progress-logo')).toBeTruthy()
  })
})
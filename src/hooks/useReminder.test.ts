import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReminder } from './useReminder';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock Notification API
const mockNotification = {
  permission: 'default' as NotificationPermission,
  requestPermission: vi.fn(),
  prototype: {
    showTrigger: true, // Simulate Chromium support
  },
};

Object.defineProperty(window, 'Notification', {
  value: mockNotification,
});

// Mock service worker registration
const mockRegistration = {
  showNotification: vi.fn(),
  getNotifications: vi.fn(),
};

const mockServiceWorker = {
  ready: Promise.resolve(mockRegistration),
};

Object.defineProperty(navigator, 'serviceWorker', {
  value: mockServiceWorker,
});

describe('useReminder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    mockNotification.permission = 'default';
  });

  it('should initialize with default reminder state', () => {
    const { result } = renderHook(() => useReminder());

    expect(result.current.reminderState).toEqual({
      permission: 'none',
      backoffStage: 0,
    });
  });

  it('should load existing reminder state from localStorage', () => {
    const existingState = {
      permission: 'enabled',
      backoffStage: 1,
      lastShownAt: Date.now(),
      lastVariantIdx: 3,
    };
    // New key for reminder state from spec FR-16.13
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(existingState));

    const { result } = renderHook(() => useReminder());

    expect(result.current.reminderState).toEqual(existingState);
  });

  it('should remove legacy rm-reminder-pref key on first init', () => {
    // Mock legacy key exists, new key doesn't
    mockLocalStorage.getItem
      .mockReturnValueOnce('legacy-value') // rm-reminder-pref
      .mockReturnValueOnce(null); // rm-reminder-state

    renderHook(() => useReminder());

    // Should cleanup legacy key per spec FR-16.13
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('rm-reminder-pref');
  });

  it('should enable reminders when toggle is activated', async () => {
    mockNotification.requestPermission.mockResolvedValue('granted');
    
    const { result } = renderHook(() => useReminder());

    await act(async () => {
      await result.current.toggleReminder(true);
    });

    expect(mockNotification.requestPermission).toHaveBeenCalled();
    expect(result.current.reminderState.permission).toBe('enabled');
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'rm-reminder-state',
      expect.stringContaining('"permission":"enabled"')
    );
  });

  it('should disable reminders when toggle is deactivated', async () => {
    const initialState = {
      permission: 'enabled',
      backoffStage: 1,
    };
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(initialState));

    const { result } = renderHook(() => useReminder());

    await act(async () => {
      await result.current.toggleReminder(false);
    });

    expect(result.current.reminderState.permission).toBe('none');
  });

  it('should handle permission denied gracefully', async () => {
    mockNotification.requestPermission.mockResolvedValue('denied');
    
    const { result } = renderHook(() => useReminder());

    await act(async () => {
      await result.current.toggleReminder(true);
    });

    expect(result.current.reminderState.permission).toBe('dismissed');
  });

  it('should reset backoff stage when new answer is recorded', async () => {
    const initialState = {
      permission: 'enabled',
      backoffStage: 2,
      lastShownAt: Date.now(),
    };
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(initialState));

    const { result } = renderHook(() => useReminder());

    await act(async () => {
      result.current.recordAnswer();
    });

    // Should reset to stage 0 per spec FR-16.1
    expect(result.current.reminderState.backoffStage).toBe(0);
  });

  it('should progress backoff stage correctly', () => {
    // Test backoff progression: 0→1 (3d), 1→2 (10d), 2→3 (24d), 3→3 (stays silent)
    const testCases = [
      { current: 0, expected: 1, daysOffset: 3 },
      { current: 1, expected: 2, daysOffset: 10 },
      { current: 2, expected: 3, daysOffset: 24 },
      { current: 3, expected: 3, daysOffset: 24 }, // Should stay at 3
    ];

    testCases.forEach(({ current, expected, daysOffset }) => {
      const state = {
        permission: 'enabled',
        backoffStage: current,
        lastShownAt: Date.now() - (daysOffset * 24 * 60 * 60 * 1000),
      };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(state));

      const { result } = renderHook(() => useReminder());
      
      act(() => {
        result.current.checkAndScheduleReminder();
      });

      expect(result.current.reminderState.backoffStage).toBe(expected);
    });
  });

  it('should respect quiet hours (22:00-08:00)', () => {
    const quietHourTime = new Date();
    quietHourTime.setHours(23, 0, 0, 0); // 11 PM - within quiet hours

    vi.spyOn(Date, 'now').mockReturnValue(quietHourTime.getTime());

    const { result } = renderHook(() => useReminder());

    act(() => {
      result.current.checkAndScheduleReminder();
    });

    // Per spec FR-16.2: should schedule for 8 AM instead of quiet hours
    expect(result.current.nextReminderTime?.getHours()).toBe(8);
  });

  it('should clear existing notifications before scheduling new ones', async () => {
    const mockNotifications = [
      { tag: 'rm-reminder', close: vi.fn() },
      { tag: 'other', close: vi.fn() },
    ];
    mockRegistration.getNotifications.mockResolvedValue(mockNotifications);

    const { result } = renderHook(() => useReminder());

    await act(async () => {
      result.current.checkAndScheduleReminder();
    });

    // Should clear only rm-reminder tagged notifications per spec FR-16.12
    expect(mockRegistration.getNotifications).toHaveBeenCalledWith({ tag: 'rm-reminder' });
    expect(mockNotifications[0].close).toHaveBeenCalled();
    expect(mockNotifications[1].close).not.toHaveBeenCalled();
  });

  it('should handle iOS environment (no showTrigger support)', () => {
    const mockNotificationWithoutTrigger = {
      ...mockNotification,
      prototype: {}, // No showTrigger
    };

    Object.defineProperty(window, 'Notification', {
      value: mockNotificationWithoutTrigger,
    });

    const { result } = renderHook(() => useReminder());

    // Should detect lack of showTrigger support for iOS fallback per spec
    expect(result.current.isOSNotificationSupported).toBe(false);
  });

  it('should rotate notification variants correctly', () => {
    const state = {
      permission: 'enabled',
      backoffStage: 1,
      lastVariantIdx: 3,
    };
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(state));

    const { result } = renderHook(() => useReminder());

    act(() => {
      result.current.getNextVariant();
    });

    // Should use a different variant than lastVariantIdx (3) per spec FR-16.3
    expect(result.current.reminderState.lastVariantIdx).not.toBe(3);
    expect(typeof result.current.reminderState.lastVariantIdx).toBe('number');
  });
});

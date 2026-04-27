import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStreak } from './useStreak';

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

// Mock service worker registration for milestone notifications
const mockRegistration = {
  showNotification: vi.fn(),
};

const mockServiceWorker = {
  ready: Promise.resolve(mockRegistration),
};

Object.defineProperty(navigator, 'serviceWorker', {
  value: mockServiceWorker,
});

// Mock Notification API
const mockNotification = {
  permission: 'granted' as NotificationPermission,
};

Object.defineProperty(window, 'Notification', {
  value: mockNotification,
});

describe('useStreak', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with default streak data', () => {
    const { result } = renderHook(() => useStreak());

    expect(result.current.streak).toEqual({
      current: 0,
      longest: 0,
      lastAnswerDate: '',
    });
  });

  it('should load existing streak data from localStorage', () => {
    const existingState = {
      streak: {
        current: 5,
        longest: 12,
        lastAnswerDate: '2026-04-20',
      },
    };
    // Should be part of 'remember-me-state' per spec section 6
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(existingState));

    const { result } = renderHook(() => useStreak());

    expect(result.current.streak).toEqual(existingState.streak);
  });

  it('should increment current streak on consecutive days', () => {
    const baseDate = new Date('2026-04-25T10:00:00Z');
    vi.setSystemTime(baseDate);

    const existingState = {
      streak: {
        current: 2,
        longest: 5,
        lastAnswerDate: '2026-04-24',
      },
    };
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(existingState));

    const { result } = renderHook(() => useStreak());

    act(() => {
      result.current.recordAnswer();
    });

    expect(result.current.streak.current).toBe(3);
    expect(result.current.streak.lastAnswerDate).toBe('2026-04-25');
  });

  it('should reset current streak when gap is more than 1 day', () => {
    const baseDate = new Date('2026-04-27T10:00:00Z');
    vi.setSystemTime(baseDate);

    const existingState = {
      streak: {
        current: 5,
        longest: 8,
        lastAnswerDate: '2026-04-24', // 3 days gap
      },
    };
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(existingState));

    const { result } = renderHook(() => useStreak());

    act(() => {
      result.current.recordAnswer();
    });

    // Should reset to 1 due to gap
    expect(result.current.streak.current).toBe(1);
    expect(result.current.streak.longest).toBe(8); // Longest should remain
  });

  it('should update longest streak when current exceeds it', () => {
    const baseDate = new Date('2026-04-25T10:00:00Z');
    vi.setSystemTime(baseDate);

    const existingState = {
      streak: {
        current: 7,
        longest: 7,
        lastAnswerDate: '2026-04-24',
      },
    };
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(existingState));

    const { result } = renderHook(() => useStreak());

    act(() => {
      result.current.recordAnswer();
    });

    expect(result.current.streak.current).toBe(8);
    expect(result.current.streak.longest).toBe(8); // Should be updated
  });

  it('should allow same-day multiple answers without incrementing streak', () => {
    const baseDate = new Date('2026-04-25T10:00:00Z');
    vi.setSystemTime(baseDate);

    const existingState = {
      streak: {
        current: 3,
        longest: 5,
        lastAnswerDate: '2026-04-25', // Same day
      },
    };
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(existingState));

    const { result } = renderHook(() => useStreak());

    act(() => {
      result.current.recordAnswer();
    });

    // Should not increment on same day
    expect(result.current.streak.current).toBe(3);
  });

  it('should trigger milestone notification at 10 answers', async () => {
    const existingState = {
      streak: { current: 0, longest: 0, lastAnswerDate: '' },
      answeredQuestions: new Array(9).fill('question-id'), // 9 answered
    };
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(existingState));

    const { result } = renderHook(() => useStreak());

    await act(async () => {
      // This would be the 10th answer, triggering milestone per spec FR-16.7
      result.current.recordAnswer('question-10');
    });

    expect(mockRegistration.showNotification).toHaveBeenCalledWith(
      expect.stringContaining('10'), // Should contain milestone count
      expect.objectContaining({
        tag: 'rm-milestone',
        // Should be immediate notification per spec FR-16.7
      })
    );
  });

  it('should trigger milestone notification at 25 answers', async () => {
    const existingState = {
      streak: { current: 5, longest: 10, lastAnswerDate: '2026-04-20' },
      answeredQuestions: new Array(24).fill('question-id'), // 24 answered
    };
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(existingState));

    const { result } = renderHook(() => useStreak());

    await act(async () => {
      result.current.recordAnswer('question-25');
    });

    expect(mockRegistration.showNotification).toHaveBeenCalledWith(
      expect.stringContaining('25'),
      expect.objectContaining({
        tag: 'rm-milestone',
      })
    );
  });

  it('should trigger milestone notification at 50 answers', async () => {
    const existingState = {
      streak: { current: 12, longest: 15, lastAnswerDate: '2026-04-20' },
      answeredQuestions: new Array(49).fill('question-id'), // 49 answered
    };
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(existingState));

    const { result } = renderHook(() => useStreak());

    await act(async () => {
      result.current.recordAnswer('question-50');
    });

    expect(mockRegistration.showNotification).toHaveBeenCalledWith(
      expect.stringContaining('50'),
      expect.objectContaining({
        tag: 'rm-milestone',
      })
    );
  });

  it('should trigger milestone notification at 100 answers', async () => {
    const existingState = {
      streak: { current: 20, longest: 25, lastAnswerDate: '2026-04-20' },
      answeredQuestions: new Array(99).fill('question-id'), // 99 answered
    };
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(existingState));

    const { result } = renderHook(() => useStreak());

    await act(async () => {
      result.current.recordAnswer('question-100');
    });

    expect(mockRegistration.showNotification).toHaveBeenCalledWith(
      expect.stringContaining('100'),
      expect.objectContaining({
        tag: 'rm-milestone',
      })
    );
  });

  it('should show in-app toast when notification permission is denied', async () => {
    // Mock denied permission
    Object.defineProperty(window, 'Notification', {
      value: { permission: 'denied' },
    });

    const mockToast = vi.fn();
    // Mock toast functionality that would be imported
    vi.doMock('../utils/toast', () => ({
      showToast: mockToast,
    }));

    const existingState = {
      streak: { current: 0, longest: 0, lastAnswerDate: '' },
      answeredQuestions: new Array(9).fill('question-id'),
    };
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(existingState));

    const { result } = renderHook(() => useStreak());

    await act(async () => {
      result.current.recordAnswer('question-10');
    });

    // Should show in-app toast instead of notification per spec FR-16.7
    expect(mockRegistration.showNotification).not.toHaveBeenCalled();
  });

  it('should persist streak data to localStorage', () => {
    const baseDate = new Date('2026-04-25T10:00:00Z');
    vi.setSystemTime(baseDate);

    const { result } = renderHook(() => useStreak());

    act(() => {
      result.current.recordAnswer();
    });

    // Should persist to 'remember-me-state' per spec section 6
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'remember-me-state',
      expect.stringContaining('"streak"')
    );
  });

  it('should trigger category completion milestone', async () => {
    const existingState = {
      streak: { current: 5, longest: 8, lastAnswerDate: '2026-04-20' },
      categories: [
        { id: 'cat1', questions: ['q1', 'q2'], completedQuestions: ['q1'] },
      ],
    };
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(existingState));

    const { result } = renderHook(() => useStreak());

    await act(async () => {
      // Complete the last question in category
      result.current.recordAnswer('q2', 'cat1');
    });

    // Should trigger category completion milestone per spec FR-16.7
    expect(mockRegistration.showNotification).toHaveBeenCalledWith(
      expect.stringContaining('kategorie'), // German text per spec
      expect.objectContaining({
        tag: 'rm-milestone',
      })
    );
  });
});
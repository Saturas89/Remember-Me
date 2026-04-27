import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getNotificationContent } from './notificationContent';

// Mock the reminder messages
vi.mock('../data/reminderMessages', () => ({
  REMINDER_MESSAGES: {
    de: [
      'Erinnerung 1 auf Deutsch',
      'Erinnerung 2 auf Deutsch', 
      'Erinnerung 3 auf Deutsch',
      'Erinnerung 4 auf Deutsch',
      'Erinnerung 5 auf Deutsch',
      'Erinnerung 6 auf Deutsch',
      'Erinnerung 7 auf Deutsch',
      'Erinnerung 8 auf Deutsch',
    ],
    en: [
      'Reminder 1 in English',
      'Reminder 2 in English',
      'Reminder 3 in English', 
      'Reminder 4 in English',
      'Reminder 5 in English',
      'Reminder 6 in English',
      'Reminder 7 in English',
      'Reminder 8 in English',
    ],
  },
}));

describe('getNotificationContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return German content by default', () => {
    const content = getNotificationContent({
      lastVariantIdx: 0,
    });

    expect(content.title).toBe('Remember Me');
    expect(content.body).toContain('auf Deutsch');
    expect(typeof content.nextVariantIdx).toBe('number');
  });

  it('should return English content when locale is "en"', () => {
    const content = getNotificationContent({
      lastVariantIdx: 0,
      locale: 'en',
    });

    expect(content.title).toBe('Remember Me');
    expect(content.body).toContain('in English');
  });

  it('should rotate variants and avoid repeating lastVariantIdx', () => {
    // Test that we don't get the same variant as last time per spec FR-16.3
    const content1 = getNotificationContent({
      lastVariantIdx: 2,
    });
    
    expect(content1.nextVariantIdx).not.toBe(2);
    expect(content1.nextVariantIdx).toBeGreaterThanOrEqual(0);
    expect(content1.nextVariantIdx).toBeLessThan(8); // Should be within range

    const content2 = getNotificationContent({
      lastVariantIdx: content1.nextVariantIdx,
    });

    // Should not repeat the previous variant
    expect(content2.nextVariantIdx).not.toBe(content1.nextVariantIdx);
  });

  it('should handle edge case when lastVariantIdx is at array boundary', () => {
    // Test last index
    const contentFromLast = getNotificationContent({
      lastVariantIdx: 7, // Last index in 8-item array
    });
    
    expect(contentFromLast.nextVariantIdx).not.toBe(7);
    expect(contentFromLast.nextVariantIdx).toBeGreaterThanOrEqual(0);
    expect(contentFromLast.nextVariantIdx).toBeLessThan(8);

    // Test first index  
    const contentFromFirst = getNotificationContent({
      lastVariantIdx: 0,
    });
    
    expect(contentFromFirst.nextVariantIdx).not.toBe(0);
    expect(contentFromFirst.nextVariantIdx).toBeGreaterThanOrEqual(0);
    expect(contentFromFirst.nextVariantIdx).toBeLessThan(8);
  });

  it('should use personalized question title when provided', () => {
    const questionTitle = 'Was ist dein Lieblingshobby?';
    
    const content = getNotificationContent({
      lastVariantIdx: 1,
      nextQuestionTitle: questionTitle,
    });

    // Should use personalized question instead of generic message per spec FR-16.4
    expect(content.body).toBe(questionTitle);
  });

  it('should fallback to variant message when no question title provided', () => {
    const content = getNotificationContent({
      lastVariantIdx: 3,
      nextQuestionTitle: null,
    });

    // Should use variant from pool when no question title per spec FR-16.4
    expect(content.body).toContain('auf Deutsch');
    expect(content.body).not.toContain('null');
  });

  it('should include correct notification data for routing', () => {
    const questionId = 'question-123';
    
    const content = getNotificationContent({
      lastVariantIdx: 1,
      nextQuestionId: questionId,
    });

    // Should include questionId for tap-routing per spec FR-16.5
    expect(content.data).toEqual({
      questionId: questionId,
    });
  });

  it('should handle missing questionId gracefully', () => {
    const content = getNotificationContent({
      lastVariantIdx: 2,
    });

    // Should provide fallback data when no questionId
    expect(content.data).toEqual({
      questionId: null,
    });
  });

  it('should ensure minimum 8 variants per language per spec', () => {
    // Test that all indices 0-7 work for German
    for (let i = 0; i < 8; i++) {
      const content = getNotificationContent({
        lastVariantIdx: (i + 1) % 8, // Ensure we don't repeat
        locale: 'de',
      });
      
      expect(content.body).toBeTruthy();
      expect(content.body).toContain('auf Deutsch');
    }

    // Test that all indices 0-7 work for English
    for (let i = 0; i < 8; i++) {
      const content = getNotificationContent({
        lastVariantIdx: (i + 1) % 8,
        locale: 'en',
      });
      
      expect(content.body).toBeTruthy();
      expect(content.body).toContain('in English');
    }
  });

  it('should handle undefined lastVariantIdx on first use', () => {
    const content = getNotificationContent({
      lastVariantIdx: undefined,
    });

    expect(content.nextVariantIdx).toBeGreaterThanOrEqual(0);
    expect(content.nextVariantIdx).toBeLessThan(8);
    expect(content.body).toBeTruthy();
  });

  it('should return different content on subsequent calls', () => {
    const content1 = getNotificationContent({
      lastVariantIdx: 0,
    });
    
    const content2 = getNotificationContent({
      lastVariantIdx: content1.nextVariantIdx,
    });

    // Rotation should ensure different content per spec FR-16.3
    expect(content1.body).not.toBe(content2.body);
    expect(content1.nextVariantIdx).not.toBe(content2.nextVariantIdx);
  });

  it('should preserve question data when using personalized content', () => {
    const questionId = 'question-456';
    const questionTitle = 'Welche Musik hörst du gerne?';
    
    const content = getNotificationContent({
      lastVariantIdx: 2,
      nextQuestionId: questionId,
      nextQuestionTitle: questionTitle,
    });

    expect(content.body).toBe(questionTitle);
    expect(content.data.questionId).toBe(questionId);
    // Should still rotate variant index even when using personalized content
    expect(content.nextVariantIdx).not.toBe(2);
  });

  it('should handle invalid lastVariantIdx gracefully', () => {
    // Test with out-of-bounds index
    const content = getNotificationContent({
      lastVariantIdx: 999,
    });

    expect(content.nextVariantIdx).toBeGreaterThanOrEqual(0);
    expect(content.nextVariantIdx).toBeLessThan(8);
    expect(content.body).toBeTruthy();
  });

  it('should maintain consistent title across all variants', () => {
    const content1 = getNotificationContent({
      lastVariantIdx: 0,
      locale: 'de',
    });
    
    const content2 = getNotificationContent({
      lastVariantIdx: 5,
      locale: 'en',
    });

    const content3 = getNotificationContent({
      lastVariantIdx: 3,
      nextQuestionTitle: 'Custom question',
    });

    // Title should be consistent regardless of variant or personalization
    expect(content1.title).toBe('Remember Me');
    expect(content2.title).toBe('Remember Me');
    expect(content3.title).toBe('Remember Me');
  });
});
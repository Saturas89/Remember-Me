import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getNotificationContent, type NotificationContentOptions, type NotificationContentResult } from './notificationContent'

// Mock REMINDER_MESSAGES data
vi.mock('../data/reminderMessages', () => ({
  REMINDER_MESSAGES: {
    de: [
      'Zeit für eine kleine Reflexion',
      'Wie geht es dir heute?',
      'Ein kurzer Moment der Selbstbesinnung',
      'Deine Gedanken warten auf dich',
      'Was beschäftigt dich gerade?',
      'Zeit für dich selbst',
      'Lass uns gemeinsam reflektieren',
      'Deine Antworten machen den Unterschied'
    ],
    en: [
      'Time for a little reflection',
      'How are you feeling today?',
      'A moment of self-awareness',
      'Your thoughts are waiting',
      'What\'s on your mind?',
      'Time for yourself',
      'Let\'s reflect together',
      'Your answers make a difference'
    ]
  }
}))

describe('getNotificationContent', () => {
  it('returns German content with deterministic variant selection', () => {
    const options: NotificationContentOptions = {
      locale: 'de'
    }
    
    const result = getNotificationContent(options)
    
    expect(result.title).toBe('Remember Me')
    expect(typeof result.body).toBe('string')
    expect(result.body.length).toBeGreaterThan(0)
    expect(typeof result.variantIdx).toBe('number')
    expect(result.variantIdx).toBeGreaterThanOrEqual(0)
    expect(result.variantIdx).toBeLessThan(8)
  })

  it('returns English content when locale is en', () => {
    const options: NotificationContentOptions = {
      locale: 'en'
    }
    
    const result = getNotificationContent(options)
    
    expect(result.title).toBe('Remember Me')
    expect(typeof result.body).toBe('string')
    expect(result.body.length).toBeGreaterThan(0)
    expect(result.variantIdx).toBeGreaterThanOrEqual(0)
    expect(result.variantIdx).toBeLessThan(8)
  })

  it('uses questionTitle in body when provided', () => {
    const options: NotificationContentOptions = {
      locale: 'de',
      questionTitle: 'Was war das Beste an deinem Tag?'
    }
    
    const result = getNotificationContent(options)
    
    expect(result.body).toBe('Was war das Beste an deinem Tag?')
    expect(result.title).toBe('Remember Me')
    expect(typeof result.variantIdx).toBe('number')
  })

  it('avoids repeating the same variant when lastVariantIdx provided', () => {
    const options1: NotificationContentOptions = {
      locale: 'de',
      lastVariantIdx: 2
    }
    
    const result1 = getNotificationContent(options1)
    
    // Should not be index 2 (avoid immediate repeat)
    expect(result1.variantIdx).not.toBe(2)
    expect(result1.variantIdx).toBeGreaterThanOrEqual(0)
    expect(result1.variantIdx).toBeLessThan(8)
    
    // Try with different lastVariantIdx
    const options2: NotificationContentOptions = {
      locale: 'de',
      lastVariantIdx: 0
    }
    
    const result2 = getNotificationContent(options2)
    expect(result2.variantIdx).not.toBe(0)
  })

  it('handles edge case when lastVariantIdx is last index', () => {
    const options: NotificationContentOptions = {
      locale: 'de',
      lastVariantIdx: 7  // Last index
    }
    
    const result = getNotificationContent(options)
    
    // Should wrap around to avoid index 7
    expect(result.variantIdx).not.toBe(7)
    expect(result.variantIdx).toBeGreaterThanOrEqual(0)
    expect(result.variantIdx).toBeLessThan(7)
  })

  it('handles lastVariantIdx -1 as no previous variant', () => {
    const options: NotificationContentOptions = {
      locale: 'en',
      lastVariantIdx: -1
    }
    
    const result = getNotificationContent(options)
    
    // Any variant should be acceptable
    expect(result.variantIdx).toBeGreaterThanOrEqual(0)
    expect(result.variantIdx).toBeLessThan(8)
  })

  it('handles undefined lastVariantIdx as no previous variant', () => {
    const options: NotificationContentOptions = {
      locale: 'en',
      lastVariantIdx: undefined
    }
    
    const result = getNotificationContent(options)
    
    expect(result.variantIdx).toBeGreaterThanOrEqual(0)
    expect(result.variantIdx).toBeLessThan(8)
  })

  it('returns different variants on consecutive calls with rotation', () => {
    const firstCall = getNotificationContent({
      locale: 'de'
    })
    
    const secondCall = getNotificationContent({
      locale: 'de',
      lastVariantIdx: firstCall.variantIdx
    })
    
    // Second call should not repeat the first variant
    expect(secondCall.variantIdx).not.toBe(firstCall.variantIdx)
  })

  it('prioritizes questionTitle over pool message even with lastVariantIdx', () => {
    const options: NotificationContentOptions = {
      locale: 'en',
      questionTitle: 'What made you smile today?',
      lastVariantIdx: 3
    }
    
    const result = getNotificationContent(options)
    
    expect(result.body).toBe('What made you smile today?')
    expect(result.title).toBe('Remember Me')
    // variantIdx should still be set for consistency
    expect(typeof result.variantIdx).toBe('number')
  })

  it('ensures deterministic behavior for same input', () => {
    const options: NotificationContentOptions = {
      locale: 'de',
      lastVariantIdx: 1
    }
    
    const result1 = getNotificationContent(options)
    const result2 = getNotificationContent(options)
    
    // Same inputs should produce same outputs (deterministic)
    expect(result1.variantIdx).toBe(result2.variantIdx)
    expect(result1.body).toBe(result2.body)
    expect(result1.title).toBe(result2.title)
  })
})
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getNotificationContent, type NotificationContentOptions } from './notificationContent'

// Mock the REMINDER_MESSAGES import
vi.mock('../data/reminderMessages', () => ({
  REMINDER_MESSAGES: {
    de: [
      'Zeit für eine kleine Auszeit!',
      'Wie geht es dir heute?',
      'Lass uns kurz reflektieren.',
      'Ein Moment der Besinnung.',
      'Zeit für dich selbst.',
      'Was bewegt dich gerade?',
      'Kurz innehalten und nachdenken.',
      'Deine Gedanken sind wichtig.'
    ],
    en: [
      'Time for a little break!',
      'How are you today?',
      'Let\'s reflect for a moment.',
      'A moment of contemplation.',
      'Time for yourself.',
      'What\'s on your mind?',
      'Take a moment to pause and think.',
      'Your thoughts matter.'
    ]
  }
}))

// Mock i18n
vi.mock('../locales/de/ui', () => ({
  de: {
    reminder: {
      notificationTitle: 'Remember Me'
    }
  }
}))

vi.mock('../locales/en/ui', () => ({
  en: {
    reminder: {
      notificationTitle: 'Remember Me'
    }
  }
}))

describe('getNotificationContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns German content with rotated variant', () => {
    const options: NotificationContentOptions = {
      locale: 'de',
      lastVariantIdx: 0
    }

    const result = getNotificationContent(options)

    expect(result.title).toBe('Remember Me')
    expect(result.body).toBe('Wie geht es dir heute?') // index 1, rotated from 0
    expect(result.variantIdx).toBe(1)
  })

  it('returns English content with rotated variant', () => {
    const options: NotificationContentOptions = {
      locale: 'en',
      lastVariantIdx: 2
    }

    const result = getNotificationContent(options)

    expect(result.title).toBe('Remember Me')
    expect(result.body).toBe('A moment of contemplation.') // index 3, rotated from 2
    expect(result.variantIdx).toBe(3)
  })

  it('wraps around to start when at end of array', () => {
    const options: NotificationContentOptions = {
      locale: 'de',
      lastVariantIdx: 7 // last index
    }

    const result = getNotificationContent(options)

    expect(result.variantIdx).toBe(0) // wrapped to start
    expect(result.body).toBe('Zeit für eine kleine Auszeit!')
  })

  it('uses questionTitle as body when provided', () => {
    const options: NotificationContentOptions = {
      locale: 'de',
      questionTitle: 'Was war dein schönster Moment heute?',
      lastVariantIdx: 3
    }

    const result = getNotificationContent(options)

    expect(result.title).toBe('Remember Me')
    expect(result.body).toBe('Was war dein schönster Moment heute?')
    expect(result.variantIdx).toBe(4) // still rotates for tracking
  })

  it('handles no lastVariantIdx (first time)', () => {
    const options: NotificationContentOptions = {
      locale: 'en'
    }

    const result = getNotificationContent(options)

    expect(result.title).toBe('Remember Me')
    expect(result.variantIdx).toBe(0) // starts at 0
    expect(result.body).toBe('Time for a little break!')
  })

  it('handles lastVariantIdx -1', () => {
    const options: NotificationContentOptions = {
      locale: 'de',
      lastVariantIdx: -1
    }

    const result = getNotificationContent(options)

    expect(result.variantIdx).toBe(0)
    expect(result.body).toBe('Zeit für eine kleine Auszeit!')
  })

  it('skips same variant when rotating', () => {
    const options: NotificationContentOptions = {
      locale: 'de',
      lastVariantIdx: 5
    }

    const result = getNotificationContent(options)

    // Should move to next variant (6), not stay at 5
    expect(result.variantIdx).toBe(6)
    expect(result.body).toBe('Kurz innehalten und nachdenken.')
  })

  it('combines questionTitle with variant rotation tracking', () => {
    const options: NotificationContentOptions = {
      locale: 'en',
      questionTitle: 'What are you grateful for today?',
      lastVariantIdx: 1
    }

    const result = getNotificationContent(options)

    expect(result.title).toBe('Remember Me')
    expect(result.body).toBe('What are you grateful for today?') // uses questionTitle
    expect(result.variantIdx).toBe(2) // still tracks rotation for next time
  })
})
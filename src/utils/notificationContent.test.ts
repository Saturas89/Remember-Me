import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getNotificationContent } from './notificationContent'

// Mock the reminderMessages data
vi.mock('../data/reminderMessages', () => ({
  REMINDER_MESSAGES: {
    de: [
      'Zeit für eine neue Selbstreflexion!',
      'Deine Gedanken warten auf dich.',
      'Noch eine Frage zu beantworten!',
      'Lass uns weitermachen!',
      'Zeit für die nächste Frage.',
      'Dein Fortschritt wartet.',
      'Bereit für mehr?',
      'Eine weitere Erinnerung.',
      'Noch offene Fragen da!'
    ],
    en: [
      'Time for a new self-reflection!',
      'Your thoughts are waiting for you.',
      'Still a question to answer!',
      'Let\'s continue!',
      'Time for the next question.',
      'Your progress is waiting.',
      'Ready for more?',
      'Another reminder.',
      'Still open questions there!'
    ]
  }
}))

describe('getNotificationContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns content for German locale', () => {
    const result = getNotificationContent({ 
      locale: 'de' 
    })

    expect(result.title).toBe('Remember Me')
    expect(result.body).toMatch(/^(Zeit für eine neue Selbstreflexion!|Deine Gedanken warten auf dich\.|Noch eine Frage zu beantworten!|Lass uns weitermachen!|Zeit für die nächste Frage\.|Dein Fortschritt wartet\.|Bereit für mehr\?|Eine weitere Erinnerung\.|Noch offene Fragen da!)$/)
    expect(result.variantIdx).toBeGreaterThanOrEqual(0)
    expect(result.variantIdx).toBeLessThan(9)
  })

  it('returns content for English locale', () => {
    const result = getNotificationContent({ 
      locale: 'en' 
    })

    expect(result.title).toBe('Remember Me')
    expect(result.body).toMatch(/^(Time for a new self-reflection!|Your thoughts are waiting for you\.|Still a question to answer!|Let's continue!|Time for the next question\.|Your progress is waiting\.|Ready for more\?|Another reminder\.|Still open questions there!)$/)
    expect(result.variantIdx).toBeGreaterThanOrEqual(0)
    expect(result.variantIdx).toBeLessThan(9)
  })

  it('uses questionTitle as body when provided', () => {
    const questionTitle = 'Was macht dich heute glücklich?'
    const result = getNotificationContent({ 
      locale: 'de',
      questionTitle 
    })

    expect(result.title).toBe('Remember Me')
    expect(result.body).toBe(questionTitle)
    expect(result.variantIdx).toBeGreaterThanOrEqual(0)
  })

  it('rotates variants and avoids consecutive repeats', () => {
    // Test that consecutive calls don't return the same variant
    const result1 = getNotificationContent({ 
      locale: 'de',
      lastVariantIdx: undefined 
    })
    
    const result2 = getNotificationContent({ 
      locale: 'de',
      lastVariantIdx: result1.variantIdx 
    })

    expect(result2.variantIdx).not.toBe(result1.variantIdx)
  })

  it('handles lastVariantIdx = -1 as no previous variant', () => {
    const result = getNotificationContent({ 
      locale: 'de',
      lastVariantIdx: -1 
    })

    expect(result.variantIdx).toBeGreaterThanOrEqual(0)
    expect(result.variantIdx).toBeLessThan(9)
  })

  it('wraps around variant selection when lastVariantIdx is at end', () => {
    // Force selection when last variant was index 8 (last in array)
    const result = getNotificationContent({ 
      locale: 'de',
      lastVariantIdx: 8 
    })

    // Should pick from 0-7, not 8
    expect(result.variantIdx).toBeGreaterThanOrEqual(0)
    expect(result.variantIdx).toBeLessThan(8)
    expect(result.variantIdx).not.toBe(8)
  })

  it('ensures deterministic rotation behavior', () => {
    // Test consistent rotation pattern
    const results: number[] = []
    let lastIdx: number | undefined = undefined

    // Generate several variants to test rotation
    for (let i = 0; i < 5; i++) {
      const result = getNotificationContent({ 
        locale: 'de',
        lastVariantIdx: lastIdx 
      })
      results.push(result.variantIdx)
      lastIdx = result.variantIdx
    }

    // Verify no consecutive duplicates
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).not.toBe(results[i - 1])
    }
  })

  it('works with questionTitle in English', () => {
    const questionTitle = 'What makes you happy today?'
    const result = getNotificationContent({ 
      locale: 'en',
      questionTitle 
    })

    expect(result.title).toBe('Remember Me')
    expect(result.body).toBe(questionTitle)
  })

  it('handles edge case with single-item variant pool', () => {
    // Mock a minimal pool to test edge case
    vi.doMock('../data/reminderMessages', () => ({
      REMINDER_MESSAGES: {
        de: ['Einzige Nachricht'],
        en: ['Only message']
      }
    }))

    const result = getNotificationContent({ 
      locale: 'de',
      lastVariantIdx: 0 
    })

    // Should still work even with only one option
    expect(result.variantIdx).toBe(0)
    expect(result.body).toBe('Einzige Nachricht')
  })
})
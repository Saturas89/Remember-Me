import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the reminder messages data
vi.mock('../data/reminderMessages', () => ({
  REMINDER_MESSAGES: {
    de: [
      'Zeit für eine Erinnerung!',
      'Erzähle deine Geschichte',
      'Deine Gedanken sind wertvoll',
      'Ein Moment für Reflexion',
      'Teile deine Erfahrungen',
      'Halte deine Erinnerungen fest',
      'Zeit für ein neues Kapitel',
      'Deine Geschichte wartet'
    ],
    en: [
      'Time for a memory!',
      'Tell your story',
      'Your thoughts matter',
      'A moment for reflection',
      'Share your experiences', 
      'Capture your memories',
      'Time for a new chapter',
      'Your story awaits'
    ]
  }
}))

async function loadUtil() {
  vi.resetModules()
  return await import('./notificationContent')
}

describe('getNotificationContent', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns German title and selects variant from pool', async () => {
    const { getNotificationContent } = await loadUtil()
    
    const result = getNotificationContent({
      locale: 'de'
    })
    
    expect(result.title).toBe('Remember Me')
    expect(result.body).toMatch(/^(Zeit für eine Erinnerung!|Erzähle deine Geschichte|Deine Gedanken sind wertvoll|Ein Moment für Reflexion|Teile deine Erfahrungen|Halte deine Erinnerungen fest|Zeit für ein neues Kapitel|Deine Geschichte wartet)$/)
    expect(result.variantIdx).toBeGreaterThanOrEqual(0)
    expect(result.variantIdx).toBeLessThan(8)
  })

  it('returns English title and selects variant from pool', async () => {
    const { getNotificationContent } = await loadUtil()
    
    const result = getNotificationContent({
      locale: 'en'
    })
    
    expect(result.title).toBe('Remember Me')
    expect(result.body).toMatch(/^(Time for a memory!|Tell your story|Your thoughts matter|A moment for reflection|Share your experiences|Capture your memories|Time for a new chapter|Your story awaits)$/)
    expect(result.variantIdx).toBeGreaterThanOrEqual(0)
    expect(result.variantIdx).toBeLessThan(8)
  })

  it('uses questionTitle as body when provided', async () => {
    const { getNotificationContent } = await loadUtil()
    
    const result = getNotificationContent({
      locale: 'de',
      questionTitle: 'Wie war dein erster Schultag?'
    })
    
    expect(result.body).toBe('Wie war dein erster Schultag?')
    expect(result.variantIdx).toBeGreaterThanOrEqual(0)
  })

  it('avoids repeating the same variant when lastVariantIdx is provided', async () => {
    const { getNotificationContent } = await loadUtil()
    
    // Get result with lastVariantIdx = 0
    const result1 = getNotificationContent({
      locale: 'de',
      lastVariantIdx: 0
    })
    
    // Should not return index 0 again
    expect(result1.variantIdx).not.toBe(0)
    expect(result1.variantIdx).toBeGreaterThanOrEqual(1)
    expect(result1.variantIdx).toBeLessThan(8)
  })

  it('handles edge case when lastVariantIdx is last index', async () => {
    const { getNotificationContent } = await loadUtil()
    
    // Last index is 7, should wrap around and avoid it
    const result = getNotificationContent({
      locale: 'de',
      lastVariantIdx: 7
    })
    
    expect(result.variantIdx).not.toBe(7)
    expect(result.variantIdx).toBeGreaterThanOrEqual(0)
    expect(result.variantIdx).toBeLessThan(7)
  })

  it('handles lastVariantIdx = -1 (no previous variant)', async () => {
    const { getNotificationContent } = await loadUtil()
    
    const result = getNotificationContent({
      locale: 'de',
      lastVariantIdx: -1
    })
    
    expect(result.variantIdx).toBeGreaterThanOrEqual(0)
    expect(result.variantIdx).toBeLessThan(8)
  })

  it('handles undefined lastVariantIdx', async () => {
    const { getNotificationContent } = await loadUtil()
    
    const result = getNotificationContent({
      locale: 'de',
      lastVariantIdx: undefined
    })
    
    expect(result.variantIdx).toBeGreaterThanOrEqual(0)
    expect(result.variantIdx).toBeLessThan(8)
  })

  it('prioritizes questionTitle over variant pool message', async () => {
    const { getNotificationContent } = await loadUtil()
    
    const questionTitle = 'Was ist dein schönstes Kindheitserlebnis?'
    const result = getNotificationContent({
      locale: 'de',
      questionTitle,
      lastVariantIdx: 3
    })
    
    expect(result.title).toBe('Remember Me')
    expect(result.body).toBe(questionTitle)
    // variantIdx should still be set for persistence even when questionTitle is used
    expect(result.variantIdx).toBeGreaterThanOrEqual(0)
    expect(result.variantIdx).not.toBe(3)
  })

  it('generates consistent but different variants across multiple calls', async () => {
    const { getNotificationContent } = await loadUtil()
    
    const results = []
    let lastIdx = -1
    
    // Generate 5 consecutive results to test rotation
    for (let i = 0; i < 5; i++) {
      const result = getNotificationContent({
        locale: 'de',
        lastVariantIdx: lastIdx
      })
      results.push(result)
      lastIdx = result.variantIdx
    }
    
    // Each result should be different from the previous one
    for (let i = 1; i < results.length; i++) {
      expect(results[i].variantIdx).not.toBe(results[i-1].variantIdx)
    }
  })

  it('handles empty questionTitle gracefully', async () => {
    const { getNotificationContent } = await loadUtil()
    
    const result = getNotificationContent({
      locale: 'de',
      questionTitle: ''
    })
    
    // Should fall back to variant pool when questionTitle is empty
    expect(result.body).toMatch(/^(Zeit für eine Erinnerung!|Erzähle deine Geschichte|Deine Gedanken sind wertvoll|Ein Moment für Reflexion|Teile deine Erfahrungen|Halte deine Erinnerungen fest|Zeit für ein neues Kapitel|Deine Geschichte wartet)$/)
  })
})
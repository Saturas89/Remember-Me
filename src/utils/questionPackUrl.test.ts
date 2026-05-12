// @vitest-environment node

import { describe, it, expect, beforeEach } from 'vitest'
import {
  isQuestionPackHash,
  generateQuestionPackUrl,
  generateQuestionPackUrlSync,
  parseQuestionPackFromHash,
  isPersonalQuestionPack
} from './secureLink'
import type { QuestionPack } from '../types'

// ── Minimal window/location polyfill for URL hash parsing ──

function setLocation({ hash = '', search = '' }: { hash?: string; search?: string }) {
  ;(globalThis as unknown as { 
    window: { 
      location: { 
        hash: string
        search: string
        origin: string
        pathname: string 
      } 
    } 
  }).window = {
    location: { hash, search, origin: 'https://example.com', pathname: '/' },
  }
}

function setSearch(search: string) { 
  setLocation({ search }) 
}

beforeEach(() => setLocation({}))

// ── Test Data ──

const basicQuestionPack: QuestionPack = {
  questions: [
    {
      id: 'q1',
      text: 'Was war dein schönster Moment?',
      type: 'text',
      createdAt: '2024-01-01T00:00:00.000Z'
    },
    {
      id: 'q2', 
      text: 'Erzähl von deiner Kindheit.',
      type: 'text',
      createdAt: '2024-01-01T00:01:00.000Z'
    }
  ]
}

const personalQuestionPack = {
  ...basicQuestionPack,
  personalPack: true,
  senderName: 'Sandra',
  recipientLabel: 'mama',
  anrede: 'Mama'
} as const

// ── isQuestionPackHash detection ──

describe('isQuestionPackHash', () => {
  it('returns true for ?qp= compressed format', () => {
    setSearch('?qp=abc123_-')
    expect(isQuestionPackHash()).toBe(true)
  })

  it('returns true for ?qp-plain= fallback format', () => {
    setSearch('?qp-plain=eyJxdWVzdGlvbnMiOltdfQ')
    expect(isQuestionPackHash()).toBe(true)
  })

  it('returns false for invite URLs', () => {
    setSearch('?mi=abc123:key')
    expect(isQuestionPackHash()).toBe(false)
  })

  it('returns false for answer URLs', () => {
    setSearch('?ma=abc123')
    expect(isQuestionPackHash()).toBe(false)
  })

  it('returns false for empty search', () => {
    setSearch('')
    expect(isQuestionPackHash()).toBe(false)
  })
})

// ── Question pack URL generation and parsing ──

describe('generateQuestionPackUrl / parseQuestionPackFromHash', () => {
  it('round-trips basic question pack through async compression', async () => {
    const url = await generateQuestionPackUrl(basicQuestionPack)
    expect(url).toContain('?qp=')
    
    setSearch('?' + url.split('?')[1])
    const parsed = await parseQuestionPackFromHash()
    
    expect(parsed).not.toBeNull()
    expect(parsed!.questions).toHaveLength(2)
    expect(parsed!.questions[0].text).toBe('Was war dein schönster Moment?')
    expect(parsed!.questions[1].text).toBe('Erzähl von deiner Kindheit.')
  })

  it('round-trips personal question pack with all meta fields', async () => {
    const url = await generateQuestionPackUrl(personalQuestionPack)
    
    setSearch('?' + url.split('?')[1])
    const parsed = await parseQuestionPackFromHash()
    
    expect(parsed).not.toBeNull()
    expect(isPersonalQuestionPack(parsed)).toBe(true)
    
    const personal = parsed as typeof personalQuestionPack
    expect(personal.personalPack).toBe(true)
    expect(personal.senderName).toBe('Sandra')
    expect(personal.recipientLabel).toBe('mama')
    expect(personal.anrede).toBe('Mama')
  })

  it('round-trips through sync fallback when compression unavailable', () => {
    const url = generateQuestionPackUrlSync(basicQuestionPack)
    expect(url).toContain('?qp-plain=')
    
    setSearch('?' + url.split('?')[1])
    const parsed = parseQuestionPackFromHash()
    
    // parseQuestionPackFromHash returns a Promise but should handle sync case
    expect(parsed).resolves.toEqual(basicQuestionPack)
  })

  it('handles empty question pack', async () => {
    const emptyPack: QuestionPack = { questions: [] }
    const url = await generateQuestionPackUrl(emptyPack)
    
    setSearch('?' + url.split('?')[1])
    const parsed = await parseQuestionPackFromHash()
    
    expect(parsed).not.toBeNull()
    expect(parsed!.questions).toHaveLength(0)
  })

  it('preserves German umlauts and special characters in question text', async () => {
    const umlautPack: QuestionPack = {
      questions: [{
        id: 'umlaut-q',
        text: 'Wie war deine Großmutter? Erzähl von früher – was hörtest du?',
        type: 'text',
        createdAt: '2024-01-01T00:00:00.000Z'
      }]
    }
    
    const url = await generateQuestionPackUrl(umlautPack)
    setSearch('?' + url.split('?')[1])
    const parsed = await parseQuestionPackFromHash()
    
    expect(parsed!.questions[0].text).toBe('Wie war deine Großmutter? Erzähl von früher – was hörtest du?')
  })

  it('returns null when URL search is empty', async () => {
    setSearch('')
    const parsed = await parseQuestionPackFromHash()
    expect(parsed).toBeNull()
  })

  it('returns null when pack payload is corrupted', async () => {
    setSearch('?qp=!!!invalid-base64url!!!')
    const parsed = await parseQuestionPackFromHash()
    expect(parsed).toBeNull()
  })
})

// ── Personal pack type guard ──

describe('isPersonalQuestionPack', () => {
  it('returns true for pack with all personal meta fields', () => {
    expect(isPersonalQuestionPack(personalQuestionPack)).toBe(true)
  })

  it('returns false for basic pack without personal fields', () => {
    expect(isPersonalQuestionPack(basicQuestionPack)).toBe(false)
  })

  it('returns false for pack with only personalPack flag but missing other fields', () => {
    const incompletePack = {
      ...basicQuestionPack,
      personalPack: true,
      senderName: 'Sandra'
      // missing recipientLabel and anrede
    }
    expect(isPersonalQuestionPack(incompletePack)).toBe(false)
  })

  it('returns false for null input', () => {
    expect(isPersonalQuestionPack(null)).toBe(false)
  })

  it('returns false for undefined input', () => {
    expect(isPersonalQuestionPack(undefined)).toBe(false)
  })

  it('returns false for pack with personalPack: false', () => {
    const explicitlyNotPersonal = {
      ...basicQuestionPack,
      personalPack: false,
      senderName: 'Sandra',
      recipientLabel: 'mama', 
      anrede: 'Mama'
    }
    expect(isPersonalQuestionPack(explicitlyNotPersonal)).toBe(false)
  })
})

// ── URL format validation according to spec §5 ──

describe('URL format compliance', () => {
  it('generates URL with base64url-safe characters only', async () => {
    const url = await generateQuestionPackUrl(personalQuestionPack)
    const qpParam = new URLSearchParams(url.split('?')[1]).get('qp')!
    
    // base64url alphabet: A-Za-z0-9_- (no + or / or = padding)
    expect(qpParam).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('sync fallback generates qp-plain with base64url encoding', () => {
    const url = generateQuestionPackUrlSync(basicQuestionPack)
    const plainParam = new URLSearchParams(url.split('?')[1]).get('qp-plain')!
    
    expect(plainParam).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('URL starts with origin from spec', async () => {
    const url = await generateQuestionPackUrl(basicQuestionPack)
    expect(url).toMatch(/^https:\/\/example\.com\/\?qp=/)
  })
})
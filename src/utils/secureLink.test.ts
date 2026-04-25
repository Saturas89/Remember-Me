// @vitest-environment node
//
// Runs in Node (not jsdom) so that CompressionStream, DecompressionStream,
// crypto.subtle, and the Fetch API (Response) are all available natively.

import { describe, it, expect, beforeEach } from 'vitest'
import {
  generateSecureInviteUrl,
  parseSecureInviteFromHash,
  isSecureInviteHash,
  generateAnswerUrl,
  generatePlainAnswerUrl,
  parseAnswerFromHash,
  parseAnswerFromUrl,
  isAnswerHash,
} from './secureLink'
import type { InviteData, AnswerExport } from '../types'

// ── Minimal window / location polyfill ───────────────────────────────────────

function setLocation({ hash = '', search = '' }: { hash?: string; search?: string }) {
  ;(globalThis as unknown as { window: { location: { hash: string; search: string; origin: string; pathname: string } } }).window = {
    location: { hash, search, origin: 'https://example.com', pathname: '/' },
  }
}

function setSearch(search: string) { setLocation({ search }) }

beforeEach(() => setLocation({}))

// ── isSecureInviteHash ────────────────────────────────────────────────────────

describe('isSecureInviteHash', () => {
  it('returns true for a well-formed ?mi= param', () => {
    setSearch('?mi=abc123_-:keyABC123_-')
    expect(isSecureInviteHash()).toBe(true)
  })

  it('returns true for the plain ?invite= fallback format', () => {
    setSearch('?invite=someb64data')
    expect(isSecureInviteHash()).toBe(true)
  })

  it('returns false for an answer param', () => {
    setSearch('?ma=abc123')
    expect(isSecureInviteHash()).toBe(false)
  })

  it('returns false for an empty search', () => {
    setSearch('')
    expect(isSecureInviteHash()).toBe(false)
  })
})

// ── isAnswerHash ──────────────────────────────────────────────────────────────

describe('isAnswerHash', () => {
  it('returns true for a well-formed ?ma= param', () => {
    setSearch('?ma=abc123_-')
    expect(isAnswerHash()).toBe(true)
  })

  it('returns true for a ?ma-plain= param', () => {
    setSearch('?ma-plain=abc123_-')
    expect(isAnswerHash()).toBe(true)
  })

  it('returns false for an invite param', () => {
    setSearch('?mi=abc:key')
    expect(isAnswerHash()).toBe(false)
  })

  it('returns false for an empty search', () => {
    setSearch('')
    expect(isAnswerHash()).toBe(false)
  })
})

// ── Secure invite round-trip ──────────────────────────────────────────────────

describe('generateSecureInviteUrl / parseSecureInviteFromHash', () => {
  const invite: InviteData = {
    profileName: 'Anna',
    friendId: 'f-123',
    topicId: 'friendship',
  }

  it('round-trips InviteData through URL + query parse', async () => {
    const url = await generateSecureInviteUrl(invite)
    setSearch('?' + url.split('?')[1])
    const parsed = await parseSecureInviteFromHash()
    expect(parsed).toEqual(invite)
  })

  it('round-trips InviteData without optional topicId', async () => {
    const minimal: InviteData = { profileName: 'Max', friendId: 'f-456' }
    const url = await generateSecureInviteUrl(minimal)
    setSearch('?' + url.split('?')[1])
    expect(await parseSecureInviteFromHash()).toEqual(minimal)
  })

  it('round-trips umlauts in profileName', async () => {
    const umlaut: InviteData = { profileName: 'Ünä-Müller', friendId: 'f-789' }
    const url = await generateSecureInviteUrl(umlaut)
    setSearch('?' + url.split('?')[1])
    expect(await parseSecureInviteFromHash()).toEqual(umlaut)
  })

  it('produces a different ciphertext on each call (random IV)', async () => {
    const url1 = await generateSecureInviteUrl(invite)
    const url2 = await generateSecureInviteUrl(invite)
    expect(url1).not.toBe(url2)
  })

  it('URL contains the ?mi= param', async () => {
    const url = await generateSecureInviteUrl(invite)
    expect(url).toContain('?mi=')
  })

  it('returns null when search is empty', async () => {
    setSearch('')
    expect(await parseSecureInviteFromHash()).toBeNull()
  })

  it('parses a ?invite= plain-Base64 fallback URL', async () => {
    // Simulate what generateSecureInviteUrl produces when crypto is unavailable
    const encoded = encodeURIComponent(btoa(encodeURIComponent(JSON.stringify(invite))))
    setSearch(`?invite=${encoded}`)
    expect(await parseSecureInviteFromHash()).toEqual(invite)
  })

  it('returns null when ciphertext is tampered with', async () => {
    const url = await generateSecureInviteUrl(invite)
    const miValue = new URLSearchParams(url.split('?')[1]).get('mi')!
    // Flip a few characters at the end to corrupt the ciphertext
    const corrupted = miValue.slice(0, -4) + 'XXXX'
    setSearch(`?mi=${corrupted}`)
    expect(await parseSecureInviteFromHash()).toBeNull()
  })
})

// ── Answer URL round-trip ─────────────────────────────────────────────────────

describe('generateAnswerUrl / parseAnswerFromHash', () => {
  const answers: AnswerExport = {
    friendId: 'f-001',
    friendName: 'Klaus',
    answers: [
      { questionId: 'q1', value: 'Antwort 1', questionText: 'Frage 1' },
      { questionId: 'q2', value: 'Antwort 2' },
    ],
  }

  it('round-trips AnswerExport through URL + query parse', async () => {
    const url = await generateAnswerUrl(answers)
    setSearch('?' + url.split('?')[1])
    expect(await parseAnswerFromHash()).toEqual(answers)
  })

  it('round-trips an empty answers list', async () => {
    const empty: AnswerExport = { friendId: 'f-x', friendName: 'Test', answers: [] }
    const url = await generateAnswerUrl(empty)
    setSearch('?' + url.split('?')[1])
    expect(await parseAnswerFromHash()).toEqual(empty)
  })

  it('URL contains the ?ma= param', async () => {
    const url = await generateAnswerUrl(answers)
    expect(url).toContain('?ma=')
  })

  it('returns null when search is empty', async () => {
    setSearch('')
    expect(await parseAnswerFromHash()).toBeNull()
  })

  it('returns null when payload is corrupted', async () => {
    setSearch('?ma=!!!notvalidbase64url!!!')
    expect(await parseAnswerFromHash()).toBeNull()
  })
})

// ── parseAnswerFromUrl ────────────────────────────────────────────────────────

describe('parseAnswerFromUrl', () => {
  const answers: AnswerExport = {
    friendId: 'f-002',
    friendName: 'Lena',
    answers: [{ questionId: 'q1', value: 'Hallo', questionText: 'Frage' }],
  }

  it('round-trips via full URL string', async () => {
    const url = await generateAnswerUrl(answers)
    expect(await parseAnswerFromUrl(url)).toEqual(answers)
  })

  it('round-trips via bare query string', async () => {
    const url = await generateAnswerUrl(answers)
    const search = '?' + url.split('?')[1]
    expect(await parseAnswerFromUrl(search)).toEqual(answers)
  })

  it('round-trips via generatePlainAnswerUrl (URL-safe base64url)', async () => {
    const url = generatePlainAnswerUrl(answers)
    expect(url).toContain('?ma-plain=')
    const value = new URLSearchParams(url.split('?')[1]).get('ma-plain')!
    expect(value).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(await parseAnswerFromUrl(url)).toEqual(answers)
  })

  it('returns null for an invite URL', async () => {
    expect(await parseAnswerFromUrl('https://example.com/?mi=abc:key')).toBeNull()
  })

  it('returns null for an empty string', async () => {
    expect(await parseAnswerFromUrl('')).toBeNull()
  })

  it('returns null for corrupted payload', async () => {
    expect(await parseAnswerFromUrl('?ma=!!!bad!!!')).toBeNull()
  })
})

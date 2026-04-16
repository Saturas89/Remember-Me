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

function setHash(hash: string) {
  ;(globalThis as unknown as { window: { location: { hash: string; origin: string; pathname: string } } }).window = {
    location: { hash, origin: 'https://example.com', pathname: '/' },
  }
}

beforeEach(() => setHash(''))

// ── isSecureInviteHash ────────────────────────────────────────────────────────

describe('isSecureInviteHash', () => {
  it('returns true for a well-formed #mi/ hash', () => {
    setHash('#mi/abc123_-:keyABC123_-')
    expect(isSecureInviteHash()).toBe(true)
  })

  it('returns true for the plain #invite/ fallback format', () => {
    setHash('#invite/someb64data')
    expect(isSecureInviteHash()).toBe(true)
  })

  it('returns false for an answer hash', () => {
    setHash('#ma/abc123')
    expect(isSecureInviteHash()).toBe(false)
  })

  it('returns false for an empty hash', () => {
    setHash('')
    expect(isSecureInviteHash()).toBe(false)
  })
})

// ── isAnswerHash ──────────────────────────────────────────────────────────────

describe('isAnswerHash', () => {
  it('returns true for a well-formed #ma/ hash', () => {
    setHash('#ma/abc123_-')
    expect(isAnswerHash()).toBe(true)
  })

  it('returns false for an invite hash', () => {
    setHash('#mi/abc:key')
    expect(isAnswerHash()).toBe(false)
  })

  it('returns false for an empty hash', () => {
    setHash('')
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

  it('round-trips InviteData through URL + hash parse', async () => {
    const url = await generateSecureInviteUrl(invite)
    // Extract the fragment from the generated URL and set it as the mock hash
    const hash = '#' + url.split('#')[1]
    setHash(hash)
    const parsed = await parseSecureInviteFromHash()
    expect(parsed).toEqual(invite)
  })

  it('round-trips InviteData without optional topicId', async () => {
    const minimal: InviteData = { profileName: 'Max', friendId: 'f-456' }
    const url = await generateSecureInviteUrl(minimal)
    setHash('#' + url.split('#')[1])
    expect(await parseSecureInviteFromHash()).toEqual(minimal)
  })

  it('round-trips umlauts in profileName', async () => {
    const umlaut: InviteData = { profileName: 'Ünä-Müller', friendId: 'f-789' }
    const url = await generateSecureInviteUrl(umlaut)
    setHash('#' + url.split('#')[1])
    expect(await parseSecureInviteFromHash()).toEqual(umlaut)
  })

  it('produces a different ciphertext on each call (random IV)', async () => {
    const url1 = await generateSecureInviteUrl(invite)
    const url2 = await generateSecureInviteUrl(invite)
    expect(url1).not.toBe(url2)
  })

  it('URL contains the #mi/ prefix', async () => {
    const url = await generateSecureInviteUrl(invite)
    expect(url).toContain('#mi/')
  })

  it('returns null when hash is empty', async () => {
    setHash('')
    expect(await parseSecureInviteFromHash()).toBeNull()
  })

  it('parses an #invite/ plain-Base64 fallback URL', async () => {
    // Simulate what generateSecureInviteUrl produces when crypto is unavailable
    const encoded = btoa(encodeURIComponent(JSON.stringify(invite)))
    setHash(`#invite/${encoded}`)
    expect(await parseSecureInviteFromHash()).toEqual(invite)
  })

  it('returns null when ciphertext is tampered with', async () => {
    const url = await generateSecureInviteUrl(invite)
    const parts = url.split('#mi/')
    // Flip a few characters in the payload to corrupt the ciphertext
    const corrupted = parts[1].slice(0, -4) + 'XXXX'
    setHash(`#mi/${corrupted}`)
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

  it('round-trips AnswerExport through URL + hash parse', async () => {
    const url = await generateAnswerUrl(answers)
    setHash('#' + url.split('#')[1])
    expect(await parseAnswerFromHash()).toEqual(answers)
  })

  it('round-trips an empty answers list', async () => {
    const empty: AnswerExport = { friendId: 'f-x', friendName: 'Test', answers: [] }
    const url = await generateAnswerUrl(empty)
    setHash('#' + url.split('#')[1])
    expect(await parseAnswerFromHash()).toEqual(empty)
  })

  it('URL contains the #ma/ prefix', async () => {
    const url = await generateAnswerUrl(answers)
    expect(url).toContain('#ma/')
  })

  it('returns null when hash is empty', async () => {
    setHash('')
    expect(await parseAnswerFromHash()).toBeNull()
  })

  it('returns null when payload is corrupted', async () => {
    setHash('#ma/!!!notvalidbase64url!!!')
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

  it('round-trips via bare hash string', async () => {
    const url = await generateAnswerUrl(answers)
    const hash = '#' + url.split('#')[1]
    expect(await parseAnswerFromUrl(hash)).toEqual(answers)
  })

  it('round-trips via generatePlainAnswerUrl (URL-safe base64url)', async () => {
    setHash('')
    const url = generatePlainAnswerUrl(answers)
    expect(url).toContain('#ma-plain/')
    const fragment = url.split('#ma-plain/')[1]
    expect(fragment).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(await parseAnswerFromUrl(url)).toEqual(answers)
  })

  it('returns null for an invite URL', async () => {
    expect(await parseAnswerFromUrl('https://example.com/#mi/abc:key')).toBeNull()
  })

  it('returns null for an empty string', async () => {
    expect(await parseAnswerFromUrl('')).toBeNull()
  })

  it('returns null for corrupted payload', async () => {
    expect(await parseAnswerFromUrl('#ma/!!!bad!!!')).toBeNull()
  })
})

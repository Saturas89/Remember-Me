// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { toB64u, fromB64u } from './base64url'

describe('base64url (RFC 4648 §5)', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 127, 128, 253, 254, 255])
    expect(Array.from(fromB64u(toB64u(bytes)))).toEqual(Array.from(bytes))
  })

  it('emits url-safe characters only (no +, /, or =)', () => {
    const bytes = new Uint8Array(32)
    for (let i = 0; i < bytes.length; i++) bytes[i] = i * 7
    const encoded = toB64u(bytes)
    expect(encoded).not.toMatch(/[+/=]/)
    // Only url-safe base64 alphabet: A-Z a-z 0-9 - _
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('converts "+" to "-" and "/" to "_" versus standard base64', () => {
    // Bytes that produce + and / under standard base64: 0xFB, 0xFF, 0x3F
    const bytes = new Uint8Array([0xfb, 0xff, 0xbf])
    const b64u = toB64u(bytes)
    expect(b64u).toContain('-')
    expect(b64u).toContain('_')
  })

  it('produces no padding (= stripped)', () => {
    // 1-byte input → standard base64 has 2 '=' padding chars
    expect(toB64u(new Uint8Array([42]))).toBe('Kg')
    // 2-byte input → 1 '=' padding char
    expect(toB64u(new Uint8Array([42, 43]))).toBe('Kis')
    // 3-byte input → no padding either way
    expect(toB64u(new Uint8Array([42, 43, 44]))).toHaveLength(4)
  })

  it('fromB64u accepts padding-free input of any length mod 4', () => {
    // 1-byte output (len 2 mod 4)
    expect(Array.from(fromB64u('Kg'))).toEqual([42])
    // 2-byte output (len 3 mod 4)
    expect(Array.from(fromB64u('Kis'))).toEqual([42, 43])
    // 3-byte output (len 0 mod 4)
    expect(Array.from(fromB64u('Kiss'))).toEqual([42, 43, 44])
  })

  it('round-trips the empty input', () => {
    expect(toB64u(new Uint8Array(0))).toBe('')
    expect(fromB64u('')).toEqual(new Uint8Array(0))
  })

  it('round-trips 1 KB of random bytes', () => {
    const bytes = new Uint8Array(1024)
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 31 + 7) & 0xff
    const restored = fromB64u(toB64u(bytes))
    expect(Array.from(restored)).toEqual(Array.from(bytes))
  })
})

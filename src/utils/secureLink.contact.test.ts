// @vitest-environment node
//
// Covers the ?contact= handshake parser/generator added for the optional
// online-sharing feature. Does not touch the existing ?mi/, ?ma/, ?ms/ paths.

import { describe, it, expect, beforeEach } from 'vitest'
import {
  generateContactUrl,
  isContactHash,
  parseContactFromHash,
} from './secureLink'
import type { ContactHandshake } from '../types'

function setLocation({ hash = '', search = '' }: { hash?: string; search?: string }) {
  ;(globalThis as unknown as { window: { location: { hash: string; search: string; origin: string; pathname: string } } }).window = {
    location: { hash, search, origin: 'https://example.com', pathname: '/' },
  }
}

function setSearch(search: string) { setLocation({ search }) }

beforeEach(() => setLocation({}))

describe('contact handshake URL', () => {
  const handshake: ContactHandshake = {
    $type: 'remember-me-contact',
    version: 1,
    deviceId: '11111111-2222-3333-4444-555555555555',
    publicKey: 'dGVzdC1wdWJsaWMta2V5LWRhdGE',
    displayName: 'Oma Gerda',
  }

  it('round-trips via query param', () => {
    const url = generateContactUrl(handshake)
    expect(url.startsWith('https://example.com/?contact=')).toBe(true)
    setSearch('?' + url.split('?')[1])
    expect(isContactHash()).toBe(true)
    expect(parseContactFromHash()).toEqual(handshake)
  })

  it('isContactHash ignores other query params', () => {
    setSearch('?mi=abc:def')
    expect(isContactHash()).toBe(false)
    setSearch('?ma=abc')
    expect(isContactHash()).toBe(false)
    setSearch('?ms=abc')
    expect(isContactHash()).toBe(false)
    setSearch('')
    expect(isContactHash()).toBe(false)
  })

  it('parseContactFromHash returns null when no contact param', () => {
    setSearch('')
    expect(parseContactFromHash()).toBeNull()
  })

  it('parseContactFromHash rejects malformed payload', () => {
    setSearch('?contact=not-valid-base64-!!!')
    expect(parseContactFromHash()).toBeNull()
  })

  it('parseContactFromHash rejects wrong $type', () => {
    const bad = JSON.stringify({ $type: 'something-else', deviceId: 'x', publicKey: 'y' })
    const b64 = btoa(bad).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    setSearch(`?contact=${b64}`)
    expect(parseContactFromHash()).toBeNull()
  })

  it('parseContactFromHash rejects missing fields', () => {
    const bad = JSON.stringify({ $type: 'remember-me-contact', version: 1 })
    const b64 = btoa(bad).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    setSearch(`?contact=${b64}`)
    expect(parseContactFromHash()).toBeNull()
  })
})

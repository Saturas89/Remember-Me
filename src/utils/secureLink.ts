import type { InviteData, AnswerExport, MemorySharePayload, ContactHandshake } from '../types'
import { toB64u, fromB64u } from './base64url'
import {
  validateInviteData,
  validateAnswerExport,
  validateMemorySharePayload,
  validateContactHandshake,
} from './payloadGuards'

// ── Plain Base64 fallback (no crypto required) ────────────────────────────────

function encodeInvitePlain(data: InviteData): string {
  return btoa(encodeURIComponent(JSON.stringify(data)))
}

function decodeInvitePlain(str: string): InviteData | null {
  try {
    return validateInviteData(JSON.parse(decodeURIComponent(atob(str))))
  } catch {
    return null
  }
}

// ── Plain answer encoding (URL-safe, no compression) ─────────────────────────
//
// Standard btoa() produces chars (+, /, =) that are special in query strings.
// We use base64url (RFC 4648 §5) so the value can be placed in a ?ma-plain=
// query parameter without percent-encoding.

function encodeAnswerPlain(data: AnswerExport): string {
  return btoa(encodeURIComponent(JSON.stringify(data)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function decodeAnswerPlain(encoded: string): AnswerExport | null {
  try {
    const pad = (4 - (encoded.length % 4)) % 4
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad)
    return validateAnswerExport(JSON.parse(decodeURIComponent(atob(b64))))
  } catch {
    return null
  }
}

// ── Feature detection ─────────────────────────────────────────────────────────

function canUseSecureCrypto(): boolean {
  return (
    typeof CompressionStream !== 'undefined' &&
    typeof crypto !== 'undefined' &&
    !!crypto.subtle
  )
}

// ── Compression ───────────────────────────────────────────────────────────────

/** Read all chunks from a ReadableStream into a single Uint8Array. */
async function readAllChunks(readable: ReadableStream<Uint8Array<ArrayBuffer>>): Promise<Uint8Array<ArrayBuffer>> {
  const reader = readable.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      total += value.length
    }
  } finally {
    reader.releaseLock()
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.length }
  return out
}

async function compress(text: string): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new CompressionStream('deflate-raw')
  const writer = stream.writable.getWriter()
  await writer.write(new TextEncoder().encode(text))
  await writer.close()
  return readAllChunks(stream.readable)
}

async function decompress(data: Uint8Array<ArrayBuffer>): Promise<string> {
  const stream = new DecompressionStream('deflate-raw')
  const writer = stream.writable.getWriter()
  await writer.write(data)
  await writer.close()
  return new TextDecoder().decode(await readAllChunks(stream.readable))
}

// ── AES-GCM 256 ───────────────────────────────────────────────────────────────

async function newKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

async function keyToStr(key: CryptoKey): Promise<string> {
  return toB64u(new Uint8Array(await crypto.subtle.exportKey('raw', key)))
}

async function strToKey(str: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', fromB64u(str), { name: 'AES-GCM' }, false, ['decrypt'])
}

async function encryptBytes(data: Uint8Array<ArrayBuffer>, key: CryptoKey): Promise<Uint8Array<ArrayBuffer>> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data),
  )
  const out = new Uint8Array(12 + ciphertext.length)
  out.set(iv, 0)
  out.set(ciphertext, 12)
  return out
}

async function decryptBytes(data: Uint8Array<ArrayBuffer>, key: CryptoKey): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: data.slice(0, 12) }, key, data.slice(12)),
  )
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Synchronously generate a plain (unencrypted) invite URL.
 *
 * The payload is `btoa(encodeURIComponent(JSON))` percent-encoded for the
 * query string. No crypto, no compression, no await. Useful as a
 * never-blocking fallback for UI that needs a URL immediately.
 * Functionally equivalent to the plain path of `generateSecureInviteUrl`.
 */
export function generatePlainInviteUrl(data: InviteData): string {
  return `${window.location.origin}/?invite=${encodeURIComponent(encodeInvitePlain(data))}`
}

/**
 * Generate an invite URL.
 *
 * Tries AES-256-GCM + deflate-raw first (?mi= format).
 * Automatically falls back to plain Base64 (?invite= format) when
 * crypto.subtle or CompressionStream are unavailable (e.g. plain HTTP).
 */
export async function generateSecureInviteUrl(data: InviteData): Promise<string> {
  if (canUseSecureCrypto()) {
    try {
      const key = await newKey()
      const encrypted = await encryptBytes(await compress(JSON.stringify(data)), key)
      return `${window.location.origin}/?mi=${toB64u(encrypted)}:${await keyToStr(key)}`
    } catch {
      // Fall through to plain encoding
    }
  }
  return generatePlainInviteUrl(data)
}

/**
 * Detect synchronously whether the current URL is any kind of invite.
 * Covers both the encrypted ?mi= format and the plain ?invite= fallback.
 */
export function isSecureInviteHash(): boolean {
  const p = new URLSearchParams(window.location.search)
  return p.has('mi') || p.has('invite')
}

/**
 * Parse an invite from the current URL query string.
 * Handles both the encrypted ?mi= format and the plain ?invite= fallback.
 */
export async function parseSecureInviteFromHash(): Promise<InviteData | null> {
  const p = new URLSearchParams(window.location.search)

  // Encrypted path: ?mi=[token]:[key]
  const mi = p.get('mi')
  if (mi) {
    const sep = mi.lastIndexOf(':')
    if (sep > 0) {
      try {
        const key = await strToKey(mi.slice(sep + 1))
        const plain = await decompress(await decryptBytes(fromB64u(mi.slice(0, sep)), key))
        return validateInviteData(JSON.parse(plain))
      } catch {
        return null
      }
    }
    return null
  }

  // Plain Base64 fallback: ?invite=[token]
  const inv = p.get('invite')
  if (inv) return decodeInvitePlain(inv)

  return null
}

/**
 * Generate a plain (uncompressed) answer URL synchronously.
 *
 * Use this when the URL must be available immediately inside a click handler –
 * any await before navigator.share() breaks Safari's user-gesture context.
 * The result is functionally equivalent to the ?ma-plain= fallback path of
 * generateAnswerUrl().
 */
export function generatePlainAnswerUrl(data: AnswerExport): string {
  return `${window.location.origin}/?ma-plain=${encodeAnswerPlain(data)}`
}

/**
 * Generate a compressed answer URL to share back with the inviter.
 * Falls back to plain base64url when CompressionStream is unavailable.
 *
 * Format: {origin}/?ma={base64url(compressed-json)}
 *      or {origin}/?ma-plain={base64url}
 */
export async function generateAnswerUrl(data: AnswerExport): Promise<string> {
  if (typeof CompressionStream !== 'undefined') {
    try {
      const compressed = await compress(JSON.stringify(data))
      return `${window.location.origin}/?ma=${toB64u(compressed)}`
    } catch {
      // fall through
    }
  }
  return `${window.location.origin}/?ma-plain=${encodeAnswerPlain(data)}`
}

/** Detect synchronously whether the current URL is an answer-import URL. */
export function isAnswerHash(): boolean {
  const p = new URLSearchParams(window.location.search)
  return p.has('ma') || p.has('ma-plain')
}

/**
 * Parse an answer export from an arbitrary string – either a full URL
 * (e.g. "https://example.com/?ma=xyz") or a bare query string ("?ma=xyz").
 * Useful for the manual-import text field where the user may paste either form.
 */
export async function parseAnswerFromUrl(input: string): Promise<AnswerExport | null> {
  let search: string
  try {
    search = new URL(input).search
  } catch {
    search = input.startsWith('?') ? input : ''
  }
  if (!search) return null
  const p = new URLSearchParams(search)

  const ma = p.get('ma')
  if (ma) {
    try {
      return validateAnswerExport(JSON.parse(await decompress(fromB64u(ma))))
    } catch {
      return null
    }
  }

  const maPlain = p.get('ma-plain')
  if (maPlain) return decodeAnswerPlain(maPlain)

  return null
}

/**
 * Parse an answer export from the current URL query string.
 */
export async function parseAnswerFromHash(): Promise<AnswerExport | null> {
  const p = new URLSearchParams(window.location.search)

  const ma = p.get('ma')
  if (ma) {
    try {
      return validateAnswerExport(JSON.parse(await decompress(fromB64u(ma))))
    } catch {
      return null
    }
  }

  const maPlain = p.get('ma-plain')
  if (maPlain) return decodeAnswerPlain(maPlain)

  return null
}

// ── Memory share URLs ─────────────────────────────────────────────────────────

/**
 * Generate a URL containing a compressed memory-share payload.
 * Format: {origin}/?ms={base64url(compressed-json)}
 *      or {origin}/?ms-plain={percent-encoded-base64} as fallback.
 */
export async function generateMemoryShareUrl(payload: MemorySharePayload): Promise<string> {
  if (typeof CompressionStream !== 'undefined') {
    try {
      const compressed = await compress(JSON.stringify(payload))
      return `${window.location.origin}/?ms=${toB64u(compressed)}`
    } catch {
      // fall through
    }
  }
  return `${window.location.origin}/?ms-plain=${encodeURIComponent(btoa(encodeURIComponent(JSON.stringify(payload))))}`
}

/**
 * Generate a memory-share URL synchronously (plain Base64, no compression).
 * Use this when the URL must be ready inside a click handler that calls
 * navigator.share() directly — any await before navigator.share() breaks the
 * browser's user-gesture context and prevents the share sheet from opening.
 */
export function generateMemoryShareUrlSync(payload: MemorySharePayload): string {
  return `${window.location.origin}/?ms-plain=${encodeURIComponent(btoa(encodeURIComponent(JSON.stringify(payload))))}`
}

/** Synchronously detect whether the current URL is a memory-share link. */
export function isMemoryShareHash(): boolean {
  const p = new URLSearchParams(window.location.search)
  return p.has('ms') || p.has('ms-plain')
}

/** Parse a memory-share payload from the current URL query string. */
export async function parseMemoryShareFromHash(): Promise<MemorySharePayload | null> {
  const p = new URLSearchParams(window.location.search)

  const ms = p.get('ms')
  if (ms) {
    try {
      return validateMemorySharePayload(JSON.parse(await decompress(fromB64u(ms))))
    } catch {
      return null
    }
  }

  const msPlain = p.get('ms-plain')
  if (msPlain) {
    try {
      return validateMemorySharePayload(JSON.parse(decodeURIComponent(atob(msPlain))))
    } catch {
      return null
    }
  }

  return null
}

// ── Contact handshake URLs ────────────────────────────────────────────────────
//
// Used only by the opt-in online-sharing feature. Encodes the sender's opaque
// device-id + ECDH public key + display name so the recipient can save them
// as an online-linked Friend and start E2E-encrypting memories to them.
//
// Format: {origin}/?contact={base64url(JSON(ContactHandshake))}
//
// The handshake is itself plaintext (the public key and device-id are not
// secrets — they're meant to be shared). All *content* that later gets
// exchanged between the two devices is AES-GCM-encrypted with a content-key
// that is wrapped per recipient using ECDH(private, public).

export function generateContactUrl(data: ContactHandshake): string {
  return `${window.location.origin}/?contact=${toB64u(new TextEncoder().encode(JSON.stringify(data)))}`
}

export function isContactHash(): boolean {
  return new URLSearchParams(window.location.search).has('contact')
}

export function parseContactFromHash(): ContactHandshake | null {
  const token = new URLSearchParams(window.location.search).get('contact')
  if (!token) return null
  try {
    const json = new TextDecoder().decode(fromB64u(token))
    return validateContactHandshake(JSON.parse(json))
  } catch {
    return null
  }
}

/**
 * Open the native Web Share sheet, or fall back to clipboard copy.
 * Returns `true` if Web Share was successfully invoked.
 */
export async function shareOrCopy(opts: {
  title: string
  text: string
  url: string
}): Promise<boolean> {
  if (navigator.share) {
    try {
      await navigator.share(opts)
      return true
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false
      // Other error → fall through to clipboard
    }
  }
  await navigator.clipboard.writeText(opts.url).catch(() => {})
  return false
}

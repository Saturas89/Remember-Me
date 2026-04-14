import type { InviteData, AnswerExport } from '../types'

// ── Base64-URL helpers ────────────────────────────────────────────────────────

function toB64u(data: Uint8Array): string {
  let str = ''
  for (const byte of data) str += String.fromCharCode(byte)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function fromB64u(str: string): Uint8Array {
  const pad = (4 - (str.length % 4)) % 4
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad)
  const raw = atob(padded)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

// ── Plain Base64 fallback (no crypto required) ────────────────────────────────

function encodeInvitePlain(data: InviteData): string {
  return btoa(encodeURIComponent(JSON.stringify(data)))
}

function decodeInvitePlain(str: string): InviteData | null {
  try {
    return JSON.parse(decodeURIComponent(atob(str))) as InviteData
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
async function readAllChunks(readable: ReadableStream<Uint8Array>): Promise<Uint8Array> {
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

async function compress(text: string): Promise<Uint8Array> {
  const stream = new CompressionStream('deflate-raw')
  const writer = stream.writable.getWriter()
  await writer.write(new TextEncoder().encode(text))
  await writer.close()
  return readAllChunks(stream.readable)
}

async function decompress(data: Uint8Array): Promise<string> {
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

async function encryptBytes(data: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data),
  )
  const out = new Uint8Array(12 + ciphertext.length)
  out.set(iv, 0)
  out.set(ciphertext, 12)
  return out
}

async function decryptBytes(data: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: data.slice(0, 12) }, key, data.slice(12)),
  )
}

// ── App base URL ──────────────────────────────────────────────────────────────

function appBase(): string {
  return window.location.origin + window.location.pathname
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate an invite URL.
 *
 * Tries AES-256-GCM + deflate-raw first (#mi/ format).
 * Automatically falls back to plain Base64 (#invite/ format) when
 * crypto.subtle or CompressionStream are unavailable (e.g. plain HTTP).
 */
export async function generateSecureInviteUrl(data: InviteData): Promise<string> {
  if (canUseSecureCrypto()) {
    try {
      const key = await newKey()
      const encrypted = await encryptBytes(await compress(JSON.stringify(data)), key)
      return `${appBase()}#mi/${toB64u(encrypted)}:${await keyToStr(key)}`
    } catch {
      // Fall through to plain encoding
    }
  }
  return `${appBase()}#invite/${encodeInvitePlain(data)}`
}

/**
 * Detect synchronously whether the current URL is any kind of invite.
 * Covers both the encrypted #mi/ format and the plain #invite/ fallback.
 */
export function isSecureInviteHash(): boolean {
  const h = window.location.hash
  return /^#mi\/[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/.test(h) || /^#invite\/.+$/.test(h)
}

/**
 * Parse an invite from the current URL hash.
 * Handles both the encrypted #mi/ format and the plain #invite/ fallback.
 */
export async function parseSecureInviteFromHash(): Promise<InviteData | null> {
  const h = window.location.hash

  // Encrypted path
  const m = h.match(/^#mi\/([A-Za-z0-9_-]+):([A-Za-z0-9_-]+)$/)
  if (m) {
    try {
      const key = await strToKey(m[2])
      const plain = await decompress(await decryptBytes(fromB64u(m[1]), key))
      return JSON.parse(plain) as InviteData
    } catch {
      return null
    }
  }

  // Plain Base64 fallback
  const mPlain = h.match(/^#invite\/(.+)$/)
  if (mPlain) return decodeInvitePlain(mPlain[1])

  return null
}

/**
 * Generate a compressed answer URL to share back with the inviter.
 * Falls back to plain Base64 when CompressionStream is unavailable.
 *
 * Format: {origin}#ma/{base64url(compressed-json)}
 *      or {origin}#ma-plain/{base64}
 */
export async function generateAnswerUrl(data: AnswerExport): Promise<string> {
  if (typeof CompressionStream !== 'undefined') {
    try {
      const compressed = await compress(JSON.stringify(data))
      return `${appBase()}#ma/${toB64u(compressed)}`
    } catch {
      // fall through
    }
  }
  return `${appBase()}#ma-plain/${btoa(encodeURIComponent(JSON.stringify(data)))}`
}

/** Detect synchronously whether the current URL is an answer-import URL. */
export function isAnswerHash(): boolean {
  const h = window.location.hash
  return /^#ma\/[A-Za-z0-9_-]+$/.test(h) || /^#ma-plain\/.+$/.test(h)
}

/**
 * Parse an answer export from the current URL hash.
 */
export async function parseAnswerFromHash(): Promise<AnswerExport | null> {
  const h = window.location.hash

  const m = h.match(/^#ma\/([A-Za-z0-9_-]+)$/)
  if (m) {
    try {
      return JSON.parse(await decompress(fromB64u(m[1]))) as AnswerExport
    } catch {
      return null
    }
  }

  const mPlain = h.match(/^#ma-plain\/(.+)$/)
  if (mPlain) {
    try {
      return JSON.parse(decodeURIComponent(atob(mPlain[1]))) as AnswerExport
    } catch {
      return null
    }
  }

  return null
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

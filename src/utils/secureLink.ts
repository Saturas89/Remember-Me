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

// ── Compression ───────────────────────────────────────────────────────────────

async function compress(text: string): Promise<Uint8Array> {
  const stream = new CompressionStream('deflate-raw')
  const writer = stream.writable.getWriter()
  writer.write(new TextEncoder().encode(text))
  writer.close()
  return new Uint8Array(await new Response(stream.readable).arrayBuffer())
}

async function decompress(data: Uint8Array): Promise<string> {
  const stream = new DecompressionStream('deflate-raw')
  const writer = stream.writable.getWriter()
  writer.write(data)
  writer.close()
  return new TextDecoder().decode(await new Response(stream.readable).arrayBuffer())
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
  // Prepend 12-byte IV
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
 * Generate a secure invite URL: payload is JSON-compressed and AES-256-GCM
 * encrypted. The key travels in the URL fragment and is never sent to a server.
 *
 * Format: {origin}#mi/{base64url(iv+ciphertext)}:{base64url(key)}
 */
export async function generateSecureInviteUrl(data: InviteData): Promise<string> {
  const key = await newKey()
  const encrypted = await encryptBytes(await compress(JSON.stringify(data)), key)
  return `${appBase()}#mi/${toB64u(encrypted)}:${await keyToStr(key)}`
}

/**
 * Detect synchronously (no crypto) whether the current URL looks like a secure invite.
 * Used for early routing before the async parse resolves.
 */
export function isSecureInviteHash(): boolean {
  return /^#mi\/[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/.test(window.location.hash)
}

/**
 * Parse and decrypt a secure invite from the current URL hash.
 * Returns null if the hash doesn't match or crypto/parse fails.
 */
export async function parseSecureInviteFromHash(): Promise<InviteData | null> {
  const m = window.location.hash.match(/^#mi\/([A-Za-z0-9_-]+):([A-Za-z0-9_-]+)$/)
  if (!m) return null
  try {
    const key = await strToKey(m[2])
    const plain = await decompress(await decryptBytes(fromB64u(m[1]), key))
    return JSON.parse(plain) as InviteData
  } catch {
    return null
  }
}

/**
 * Generate a compressed answer URL to share back with the inviter.
 * No encryption needed – the invite URL already scoped who participates.
 *
 * Format: {origin}#ma/{base64url(compressed-json)}
 */
export async function generateAnswerUrl(data: AnswerExport): Promise<string> {
  const compressed = await compress(JSON.stringify(data))
  return `${appBase()}#ma/${toB64u(compressed)}`
}

/** Detect synchronously whether the current URL is an answer-import URL. */
export function isAnswerHash(): boolean {
  return /^#ma\/[A-Za-z0-9_-]+$/.test(window.location.hash)
}

/**
 * Parse an answer export from the current URL hash.
 * Returns null if the hash doesn't match or decompression fails.
 */
export async function parseAnswerFromHash(): Promise<AnswerExport | null> {
  const m = window.location.hash.match(/^#ma\/([A-Za-z0-9_-]+)$/)
  if (!m) return null
  try {
    return JSON.parse(await decompress(fromB64u(m[1]))) as AnswerExport
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
      if ((e as Error).name === 'AbortError') return false // user dismissed
      // Other error → fall through to clipboard
    }
  }
  await navigator.clipboard.writeText(opts.url).catch(() => {})
  return false
}

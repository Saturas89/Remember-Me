// ── Crypto primitives for online sharing ────────────────────────────────────
//
// Everything here runs client-side. The server (Supabase) never sees plaintext
// content or raw keys — only ciphertext and ECDH public keys.
//
// Scheme:
//   • Device identity:  ECDH P-256, private key non-extractable (lives in IDB).
//   • Content key:      random 32 bytes per share/annotation/image.
//   • Key wrap:         ECDH(mine.priv, their.pub) → AES-GCM-256 wrapping key,
//                       used to encrypt the content-key bytes with a fresh IV.
//   • Payload encrypt:  AES-GCM-256 over compressed JSON (or raw image bytes).

// ── Base64URL (RFC 4648 §5) ──────────────────────────────────────────────────

export function toB64u(data: Uint8Array): string {
  let str = ''
  for (const byte of data) str += String.fromCharCode(byte)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export function fromB64u(str: string): Uint8Array {
  const pad = (4 - (str.length % 4)) % 4
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad)
  const raw = atob(padded)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

// ── Feature detection ────────────────────────────────────────────────────────

export function canUseOnlineCrypto(): boolean {
  return (
    typeof crypto !== 'undefined' &&
    !!crypto.subtle &&
    typeof crypto.getRandomValues === 'function'
  )
}

// ── ECDH device key pair ─────────────────────────────────────────────────────

export interface DeviceKeyPair {
  publicKey: CryptoKey   // extractable (SPKI)
  privateKey: CryptoKey  // non-extractable
}

export async function generateDeviceKeyPair(): Promise<DeviceKeyPair> {
  const kp = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false, // privateKey non-extractable; publicKey is always exportable via exportKey('spki')
    ['deriveKey', 'deriveBits'],
  )
  return { publicKey: kp.publicKey, privateKey: kp.privateKey }
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', key))
  return toB64u(spki)
}

export async function importPublicKey(b64u: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'spki',
    fromB64u(b64u).buffer as ArrayBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    [],
  )
}

// ── Shared wrapping key (ECDH → AES-GCM) ─────────────────────────────────────
//
// Derives a symmetric AES-GCM key from one party's private + the other party's
// public ECDH key. Both sides get the same key.

export async function deriveWrappingKey(
  ownPrivate: CryptoKey,
  otherPublic: CryptoKey,
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: otherPublic },
    ownPrivate,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

// ── Content key ──────────────────────────────────────────────────────────────
//
// 32 random bytes. Stays as raw bytes (never a CryptoKey) so it can be wrapped
// per recipient without the non-extractable constraint getting in the way.

export function generateContentKeyBytes(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32))
}

async function importAesGcm(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    raw.buffer as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  )
}

// ── AES-GCM encrypt/decrypt (binds IV + ciphertext together) ─────────────────

export interface EncryptedBlob {
  iv: Uint8Array        // 12 bytes
  ciphertext: Uint8Array
}

export async function encryptWithContentKey(
  data: Uint8Array,
  contentKey: Uint8Array,
): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await importAesGcm(contentKey)
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      key,
      data.buffer as ArrayBuffer,
    ),
  )
  return { iv, ciphertext: ct }
}

export async function decryptWithContentKey(
  blob: EncryptedBlob,
  contentKey: Uint8Array,
): Promise<Uint8Array> {
  const key = await importAesGcm(contentKey)
  return new Uint8Array(
    await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: blob.iv.buffer as ArrayBuffer },
      key,
      blob.ciphertext.buffer as ArrayBuffer,
    ),
  )
}

// ── Wrap / unwrap content keys per recipient ─────────────────────────────────

export interface WrappedKey {
  iv: string          // base64url(12 bytes)
  ciphertext: string  // base64url
}

export async function wrapContentKey(
  contentKey: Uint8Array,
  wrappingKey: CryptoKey,
): Promise<WrappedKey> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      wrappingKey,
      contentKey.buffer as ArrayBuffer,
    ),
  )
  return { iv: toB64u(iv), ciphertext: toB64u(ct) }
}

export async function unwrapContentKey(
  wrapped: WrappedKey,
  wrappingKey: CryptoKey,
): Promise<Uint8Array> {
  const iv = fromB64u(wrapped.iv)
  const ct = fromB64u(wrapped.ciphertext)
  return new Uint8Array(
    await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      wrappingKey,
      ct.buffer as ArrayBuffer,
    ),
  )
}

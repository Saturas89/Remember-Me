// ── High-level end-to-end encryption for online sharing ─────────────────────
//
// Composes the primitives from ./crypto into share-level operations:
//   • encryptShare   – owner prepares a memory for N recipients
//   • decryptShare   – recipient decrypts the memory for themselves
//   • encryptAnnotation / decryptAnnotation – Ergänzungen
//   • encryptImage / decryptImage – per-image content-key + AES-GCM
//
// All heavy lifting is AES-GCM with a random content-key per share. The
// content-key is then wrapped once per recipient device (including the owner
// themselves) via ECDH(own.priv, their.pub). The server never sees the
// content-key in plaintext.

import {
  toB64u,
  fromB64u,
  generateContentKeyBytes,
  encryptWithContentKey,
  decryptWithContentKey,
  deriveWrappingKey,
  wrapContentKey,
  unwrapContentKey,
  importPublicKey,
  type DeviceKeyPair,
  type EncryptedBlob,
  type WrappedKey,
} from './crypto'
import type { ShareBody, AnnotationBody } from '../types'

// ── Recipient descriptor ─────────────────────────────────────────────────────

export interface Recipient {
  deviceId: string
  publicKey: string      // base64url SPKI
}

// ── Share envelope stored on the server ──────────────────────────────────────

export interface ShareEnvelope {
  /** Envelope format version.
   *
   *  - undefined / 1: legacy. AES-GCM ciphertext binds only to the random
   *    content-key. The server can in principle re-label which device-id
   *    authored the envelope — decryption still works but the recipient
   *    has no cryptographic proof of the sender beyond the implicit ECDH
   *    wrap binding.
   *  - 2: AES-GCM ciphertext is additionally bound to
   *    `senderDeviceId | envelopeId` via AAD. Any mismatch on decrypt
   *    (server lying about sender, swapping ciphertext between rows)
   *    fails the GCM auth tag and rejects the envelope.
   */
  v?: number
  ciphertext: string     // base64url AES-GCM(compressed JSON)
  iv: string             // base64url 12 bytes
  /** deviceId → wrapped content-key */
  encryptedKeys: Record<string, WrappedKey>
}

const AAD_VERSION = 'v2'

/** Build the AAD that binds the ciphertext to its sender + envelope row.
 *  Domain-separated by `"v2|"` so future schema versions don't collide. */
function makeAad(senderDeviceId: string, envelopeId: string, kind: 'share' | 'annotation'): Uint8Array {
  return new TextEncoder().encode(
    `${AAD_VERSION}|${kind}|${senderDeviceId}|${envelopeId}`,
  )
}

export interface EncryptedImage {
  ciphertext: Uint8Array
  iv: Uint8Array
}

// ── Compression helpers (gzip via CompressionStream) ─────────────────────────
//
// Copy of the helpers in secureLink.ts, kept here to avoid coupling the
// online-sharing module to the existing invite-link code. When Vite chunks
// the bundle, offline-only users never pull in this file.

// Compress via the Blob → pipeThrough → Response pipeline. The earlier
// manual `getWriter().write() → close() → readAllChunks()` form deadlocks
// in some Chromium builds when the bundled module is invoked from a React
// event handler: `close()` awaits backpressure resolution, which only
// happens once the readable side is consumed – but the read happens
// *after* close. Using Response.arrayBuffer over the piped stream lets the
// browser interleave writing and reading internally.
async function compress(text: string): Promise<Uint8Array<ArrayBuffer>> {
  const bytes = new TextEncoder().encode(text)
  if (typeof CompressionStream === 'undefined') {
    return bytes
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  const buf = await new Response(stream).arrayBuffer()
  return new Uint8Array(buf)
}

async function decompress(data: Uint8Array<ArrayBuffer>): Promise<string> {
  if (typeof DecompressionStream === 'undefined') {
    return new TextDecoder().decode(data)
  }
  try {
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
    const buf = await new Response(stream).arrayBuffer()
    return new TextDecoder().decode(new Uint8Array(buf))
  } catch {
    // Payload wasn't compressed – treat as raw UTF-8 (forwards-compat fallback)
    return new TextDecoder().decode(data)
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function wrapForRecipients(
  contentKey: Uint8Array,
  owner: DeviceKeyPair,
  ownerDeviceId: string,
  recipients: Recipient[],
): Promise<Record<string, WrappedKey>> {
  const result: Record<string, WrappedKey> = {}

  // Owner's own copy — otherwise the author can't decrypt their own share later.
  // Wrap with ECDH(own.priv, own.pub) so it behaves like any other recipient.
  const ownerWrapKey = await deriveWrappingKey(owner.privateKey, owner.publicKey)
  result[ownerDeviceId] = await wrapContentKey(contentKey, ownerWrapKey)

  for (const r of recipients) {
    if (r.deviceId === ownerDeviceId) continue // already covered
    const pub = await importPublicKey(r.publicKey)
    const wk = await deriveWrappingKey(owner.privateKey, pub)
    result[r.deviceId] = await wrapContentKey(contentKey, wk)
  }

  return result
}

async function unwrapForSelf(
  envelope: { encryptedKeys: Record<string, WrappedKey> },
  self: DeviceKeyPair,
  selfDeviceId: string,
  senderPublicKeyB64: string,
): Promise<Uint8Array> {
  const mine = envelope.encryptedKeys[selfDeviceId]
  if (!mine) {
    throw new Error('share not addressed to this device')
  }
  const senderPub = await importPublicKey(senderPublicKeyB64)
  const wk = await deriveWrappingKey(self.privateKey, senderPub)
  return unwrapContentKey(mine, wk)
}

// ── Share (memory) ───────────────────────────────────────────────────────────

export async function encryptShare(
  body: ShareBody,
  owner: DeviceKeyPair,
  ownerDeviceId: string,
  recipients: Recipient[],
  /** Client-generated UUID for the share row. Pinning the id pre-encrypt
   *  lets us bind the ciphertext to its eventual storage location via AAD,
   *  so a server that re-shuffles rows can't pass another row's payload
   *  off as this one. */
  envelopeId: string,
): Promise<ShareEnvelope> {
  const contentKey = generateContentKeyBytes()
  const compressed = await compress(JSON.stringify(body))
  const aad = makeAad(ownerDeviceId, envelopeId, 'share')
  const blob = await encryptWithContentKey(compressed, contentKey, aad)
  const encryptedKeys = await wrapForRecipients(contentKey, owner, ownerDeviceId, recipients)

  return {
    v: 2,
    ciphertext: toB64u(blob.ciphertext),
    iv: toB64u(blob.iv),
    encryptedKeys,
  }
}

export async function decryptShare(
  envelope: ShareEnvelope,
  self: DeviceKeyPair,
  selfDeviceId: string,
  senderPublicKey: string,
  /** Claimed sender + envelope-row id. For v2 envelopes both pieces are
   *  fed into AES-GCM as additional authenticated data, so a server
   *  lying about either fails the auth tag check. For legacy v1 the
   *  parameters are accepted but unused. */
  senderDeviceId: string,
  envelopeId: string,
): Promise<{ body: ShareBody; contentKey: Uint8Array }> {
  const contentKey = await unwrapForSelf(envelope, self, selfDeviceId, senderPublicKey)
  const blob: EncryptedBlob = {
    iv: fromB64u(envelope.iv),
    ciphertext: fromB64u(envelope.ciphertext),
  }
  const aad = envelope.v === 2
    ? makeAad(senderDeviceId, envelopeId, 'share')
    : undefined
  const compressed = await decryptWithContentKey(blob, contentKey, aad)
  const json = await decompress(compressed)
  const body = JSON.parse(json) as ShareBody
  if (body.$type !== 'remember-me-share') {
    throw new Error('invalid share body: $type mismatch')
  }
  return { body, contentKey }
}

// ── Annotation ───────────────────────────────────────────────────────────────
//
// Annotations are re-wrapped for everyone who already has access to the
// parent share. The caller passes in the parent share's recipient list +
// owner so the annotation is readable by the same set.

export async function encryptAnnotation(
  body: AnnotationBody,
  author: DeviceKeyPair,
  authorDeviceId: string,
  audience: Recipient[],
  /** Client-generated UUID for the annotation row. See encryptShare. */
  envelopeId: string,
): Promise<ShareEnvelope> {
  const contentKey = generateContentKeyBytes()
  const compressed = await compress(JSON.stringify(body))
  const aad = makeAad(authorDeviceId, envelopeId, 'annotation')
  const blob = await encryptWithContentKey(compressed, contentKey, aad)
  const encryptedKeys = await wrapForRecipients(contentKey, author, authorDeviceId, audience)
  return {
    v: 2,
    ciphertext: toB64u(blob.ciphertext),
    iv: toB64u(blob.iv),
    encryptedKeys,
  }
}

export async function decryptAnnotation(
  envelope: ShareEnvelope,
  self: DeviceKeyPair,
  selfDeviceId: string,
  authorPublicKey: string,
  authorDeviceId: string,
  envelopeId: string,
): Promise<AnnotationBody> {
  const contentKey = await unwrapForSelf(envelope, self, selfDeviceId, authorPublicKey)
  const blob: EncryptedBlob = {
    iv: fromB64u(envelope.iv),
    ciphertext: fromB64u(envelope.ciphertext),
  }
  const aad = envelope.v === 2
    ? makeAad(authorDeviceId, envelopeId, 'annotation')
    : undefined
  const compressed = await decryptWithContentKey(blob, contentKey, aad)
  const json = await decompress(compressed)
  const body = JSON.parse(json) as AnnotationBody
  if (body.$type !== 'remember-me-annotation') {
    throw new Error('invalid annotation body: $type mismatch')
  }
  return body
}

// ── Image bytes ──────────────────────────────────────────────────────────────
//
// Images use the same content-key as their parent share, so once the
// recipient decrypts the share they can decrypt all its images without any
// extra round-trip to the server.

export async function encryptImage(
  bytes: Uint8Array,
  contentKey: Uint8Array,
): Promise<EncryptedImage> {
  const blob = await encryptWithContentKey(bytes, contentKey)
  return { ciphertext: blob.ciphertext, iv: blob.iv }
}

export async function decryptImage(
  img: EncryptedImage,
  contentKey: Uint8Array,
): Promise<Uint8Array> {
  return decryptWithContentKey({ iv: img.iv, ciphertext: img.ciphertext }, contentKey)
}

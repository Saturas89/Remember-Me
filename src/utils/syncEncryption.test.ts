// @vitest-environment node
//
// Tests for the media-blob encryption helpers shipped with the REQ-017 H1
// fix. Runs in Node so crypto.subtle is available natively without a
// browser/jsdom shim, and so Blob is the platform native (Node 22+).

import { describe, it, expect, beforeAll } from 'vitest'
import { encryptMediaBlob, decryptMediaBlob } from './syncEncryption'
import { SyncError } from './privateSyncProvider'

let vaultKey: CryptoKey
let otherKey: CryptoKey

beforeAll(async () => {
  vaultKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )
  otherKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )
})

async function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer())
}

describe('encryptMediaBlob / decryptMediaBlob', () => {
  it('round-trips identical bytes and preserves the original MIME type', async () => {
    const original = new Blob([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])], {
      type: 'image/png',
    })
    const sealed = await encryptMediaBlob(original, vaultKey)

    expect(sealed.mimeType).toBe('image/png')
    expect(sealed.ciphertext.type).toBe('application/octet-stream')
    // GCM adds a 16-byte auth tag, so ciphertext is plaintext + 16.
    expect((await bytesOf(sealed.ciphertext)).length).toBe(10 + 16)

    const restored = await decryptMediaBlob(
      sealed.ciphertext,
      sealed.iv,
      sealed.mimeType,
      vaultKey,
    )
    expect(restored.type).toBe('image/png')
    expect(Array.from(await bytesOf(restored))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('produces a fresh IV per call (no nonce reuse under the vault key)', async () => {
    const blob = new Blob([new Uint8Array([42])], { type: 'image/jpeg' })
    const a = await encryptMediaBlob(blob, vaultKey)
    const b = await encryptMediaBlob(blob, vaultKey)
    expect(a.iv).not.toBe(b.iv)
    // Identical plaintext + identical key + different IV → different ciphertext.
    expect(Array.from(await bytesOf(a.ciphertext)))
      .not.toEqual(Array.from(await bytesOf(b.ciphertext)))
  })

  it('rejects ciphertext signed under a different key (auth tag mismatch)', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mpeg' })
    const sealed = await encryptMediaBlob(blob, vaultKey)
    await expect(
      decryptMediaBlob(sealed.ciphertext, sealed.iv, sealed.mimeType, otherKey),
    ).rejects.toBeInstanceOf(SyncError)
  })

  it('rejects tampered ciphertext (last byte flipped)', async () => {
    const blob = new Blob([new Uint8Array([10, 20, 30, 40])], { type: 'video/mp4' })
    const sealed = await encryptMediaBlob(blob, vaultKey)

    const ctBytes = await bytesOf(sealed.ciphertext)
    ctBytes[ctBytes.length - 1] ^= 0xff
    const tampered = new Blob([ctBytes.buffer as ArrayBuffer], { type: 'application/octet-stream' })

    await expect(
      decryptMediaBlob(tampered, sealed.iv, sealed.mimeType, vaultKey),
    ).rejects.toBeInstanceOf(SyncError)
  })

  it('defaults to application/octet-stream when the source blob has no MIME', async () => {
    const blob = new Blob([new Uint8Array([99])])
    const sealed = await encryptMediaBlob(blob, vaultKey)
    expect(sealed.mimeType).toBe('application/octet-stream')

    const restored = await decryptMediaBlob(
      sealed.ciphertext,
      sealed.iv,
      sealed.mimeType,
      vaultKey,
    )
    expect(restored.type).toBe('application/octet-stream')
  })
})

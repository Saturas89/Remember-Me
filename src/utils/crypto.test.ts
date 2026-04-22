// @vitest-environment node
//
// Runs in Node so crypto.subtle (ECDH P-256, AES-GCM) is available natively.

import { describe, it, expect } from 'vitest'
import {
  generateDeviceKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveWrappingKey,
  generateContentKeyBytes,
  encryptWithContentKey,
  decryptWithContentKey,
  wrapContentKey,
  unwrapContentKey,
  toB64u,
  fromB64u,
} from './crypto'

describe('toB64u / fromB64u', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 253, 254, 255, 42, 99])
    expect(fromB64u(toB64u(bytes))).toEqual(bytes)
  })

  it('produces URL-safe output (no +, /, =)', () => {
    const bytes = new Uint8Array(32)
    for (let i = 0; i < bytes.length; i++) bytes[i] = i
    const s = toB64u(bytes)
    expect(s).not.toMatch(/[+/=]/)
  })
})

describe('device key pair', () => {
  it('exports + re-imports a public key losslessly', async () => {
    const kp = await generateDeviceKeyPair()
    const spkiB64 = await exportPublicKey(kp.publicKey)
    const reimported = await importPublicKey(spkiB64)
    // Re-export and compare
    const spkiB64Again = await exportPublicKey(reimported)
    expect(spkiB64).toBe(spkiB64Again)
  })

  it('private key is non-extractable', async () => {
    const kp = await generateDeviceKeyPair()
    await expect(
      crypto.subtle.exportKey('pkcs8', kp.privateKey),
    ).rejects.toBeDefined()
  })
})

describe('ECDH wrapping key derivation', () => {
  it('both parties derive the same wrapping key', async () => {
    const alice = await generateDeviceKeyPair()
    const bob = await generateDeviceKeyPair()

    const aliceSeesBob = await importPublicKey(await exportPublicKey(bob.publicKey))
    const bobSeesAlice = await importPublicKey(await exportPublicKey(alice.publicKey))

    const aliceKey = await deriveWrappingKey(alice.privateKey, aliceSeesBob)
    const bobKey = await deriveWrappingKey(bob.privateKey, bobSeesAlice)

    // Wrap a test content-key with Alice's derived key, unwrap with Bob's → must match
    const ck = generateContentKeyBytes()
    const wrapped = await wrapContentKey(ck, aliceKey)
    const unwrapped = await unwrapContentKey(wrapped, bobKey)
    expect(unwrapped).toEqual(ck)
  })

  it('a third party cannot unwrap', async () => {
    const alice = await generateDeviceKeyPair()
    const bob = await generateDeviceKeyPair()
    const eve = await generateDeviceKeyPair()

    const aliceWrap = await deriveWrappingKey(
      alice.privateKey,
      await importPublicKey(await exportPublicKey(bob.publicKey)),
    )
    const eveWrap = await deriveWrappingKey(
      eve.privateKey,
      await importPublicKey(await exportPublicKey(alice.publicKey)),
    )

    const ck = generateContentKeyBytes()
    const wrapped = await wrapContentKey(ck, aliceWrap)
    await expect(unwrapContentKey(wrapped, eveWrap)).rejects.toBeDefined()
  })
})

describe('content encryption round-trip', () => {
  it('encrypts and decrypts arbitrary bytes', async () => {
    const ck = generateContentKeyBytes()
    const plaintext = new TextEncoder().encode('Hallo Familie! 🧡 Erinnerung vom Sommer 1984.')
    const blob = await encryptWithContentKey(plaintext, ck)
    expect(blob.iv.length).toBe(12)
    expect(blob.ciphertext.length).toBeGreaterThan(plaintext.length) // GCM tag added
    const out = await decryptWithContentKey(blob, ck)
    expect(new TextDecoder().decode(out)).toBe('Hallo Familie! 🧡 Erinnerung vom Sommer 1984.')
  })

  it('decrypt with wrong key fails', async () => {
    const ck1 = generateContentKeyBytes()
    const ck2 = generateContentKeyBytes()
    const blob = await encryptWithContentKey(new TextEncoder().encode('secret'), ck1)
    await expect(decryptWithContentKey(blob, ck2)).rejects.toBeDefined()
  })

  it('tamper-detection: modified ciphertext rejects', async () => {
    const ck = generateContentKeyBytes()
    const blob = await encryptWithContentKey(new TextEncoder().encode('x'), ck)
    blob.ciphertext[0] ^= 0xff
    await expect(decryptWithContentKey(blob, ck)).rejects.toBeDefined()
  })
})

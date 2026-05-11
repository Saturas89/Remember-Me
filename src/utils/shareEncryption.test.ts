// @vitest-environment node

import { describe, it, expect } from 'vitest'
import {
  encryptShare,
  decryptShare,
  encryptAnnotation,
  decryptAnnotation,
  encryptImage,
  decryptImage,
  type Recipient,
  type ShareEnvelope,
} from './shareEncryption'
import {
  generateDeviceKeyPair,
  exportPublicKey,
  generateContentKeyBytes,
} from './crypto'
import type { ShareBody, AnnotationBody } from '../types'

async function makeDevice() {
  const kp = await generateDeviceKeyPair()
  const publicKey = await exportPublicKey(kp.publicKey)
  // ECDH-SPKI public keys share a long DER prefix per-curve, so we use a
  // proper random UUID rather than a slice of the key bytes. In production
  // this is supabase auth.uid().
  const deviceId = crypto.randomUUID()
  return { kp, publicKey, deviceId }
}

const sampleBody: ShareBody = {
  $type: 'remember-me-share',
  version: 1,
  questionId: 'q-childhood-summer',
  questionText: 'Woran erinnerst du dich aus dem Sommer 1984?',
  value: 'Wir waren am See, Oma hat Eis gekauft. 🏖️',
  imageCount: 2,
  createdAt: '2026-04-21T10:00:00Z',
  ownerName: 'Anna',
}

describe('encryptShare / decryptShare', () => {
  it('owner can decrypt their own share', async () => {
    const owner = await makeDevice()
    const envelopeId = crypto.randomUUID()
    const envelope = await encryptShare(sampleBody, owner.kp, owner.deviceId, [], envelopeId)
    const { body } = await decryptShare(envelope, owner.kp, owner.deviceId, owner.publicKey, owner.deviceId, envelopeId)
    expect(body).toEqual(sampleBody)
  })

  it('recipient can decrypt a share addressed to them', async () => {
    const owner = await makeDevice()
    const bob = await makeDevice()
    const recipients: Recipient[] = [{ deviceId: bob.deviceId, publicKey: bob.publicKey }]
    const envelopeId = crypto.randomUUID()

    const envelope = await encryptShare(sampleBody, owner.kp, owner.deviceId, recipients, envelopeId)

    expect(Object.keys(envelope.encryptedKeys).sort()).toEqual(
      [owner.deviceId, bob.deviceId].sort(),
    )

    const { body } = await decryptShare(envelope, bob.kp, bob.deviceId, owner.publicKey, owner.deviceId, envelopeId)
    expect(body).toEqual(sampleBody)
  })

  it('each recipient gets an independent wrapped key', async () => {
    const owner = await makeDevice()
    const bob = await makeDevice()
    const charlie = await makeDevice()
    const envelopeId = crypto.randomUUID()

    const envelope = await encryptShare(sampleBody, owner.kp, owner.deviceId, [
      { deviceId: bob.deviceId, publicKey: bob.publicKey },
      { deviceId: charlie.deviceId, publicKey: charlie.publicKey },
    ], envelopeId)

    const bobResult = await decryptShare(envelope, bob.kp, bob.deviceId, owner.publicKey, owner.deviceId, envelopeId)
    const charlieResult = await decryptShare(envelope, charlie.kp, charlie.deviceId, owner.publicKey, owner.deviceId, envelopeId)

    expect(bobResult.body).toEqual(sampleBody)
    expect(charlieResult.body).toEqual(sampleBody)

    // Their wrapped-key ciphertexts must differ (different ECDH shared secrets + fresh IVs)
    expect(envelope.encryptedKeys[bob.deviceId].ciphertext)
      .not.toBe(envelope.encryptedKeys[charlie.deviceId].ciphertext)
  })

  it('a non-recipient cannot decrypt', async () => {
    const owner = await makeDevice()
    const bob = await makeDevice()
    const eve = await makeDevice()
    const envelopeId = crypto.randomUUID()

    const envelope = await encryptShare(sampleBody, owner.kp, owner.deviceId, [
      { deviceId: bob.deviceId, publicKey: bob.publicKey },
    ], envelopeId)

    await expect(
      decryptShare(envelope, eve.kp, eve.deviceId, owner.publicKey, owner.deviceId, envelopeId),
    ).rejects.toBeDefined()
  })

  it('tampering with ciphertext is detected', async () => {
    const owner = await makeDevice()
    const bob = await makeDevice()
    const envelopeId = crypto.randomUUID()
    const envelope = await encryptShare(sampleBody, owner.kp, owner.deviceId, [
      { deviceId: bob.deviceId, publicKey: bob.publicKey },
    ], envelopeId)
    // Flip a bit in the ciphertext body
    const ctBytes = Array.from(envelope.ciphertext)
    ctBytes[5] = ctBytes[5] === 'A' ? 'B' : 'A'
    envelope.ciphertext = ctBytes.join('')

    await expect(
      decryptShare(envelope, bob.kp, bob.deviceId, owner.publicKey, owner.deviceId, envelopeId),
    ).rejects.toBeDefined()
  })

  it('server (no keys) cannot see plaintext', async () => {
    const owner = await makeDevice()
    const bob = await makeDevice()
    const envelopeId = crypto.randomUUID()
    const envelope = await encryptShare(sampleBody, owner.kp, owner.deviceId, [
      { deviceId: bob.deviceId, publicKey: bob.publicKey },
    ], envelopeId)
    // Serialize as the server would store it
    const stored = JSON.stringify(envelope)
    expect(stored).not.toContain('Oma')
    expect(stored).not.toContain('Sommer 1984')
    expect(stored).not.toContain('Anna')
    expect(stored).not.toContain('q-childhood-summer')
  })

  // ── H2: sender + envelope-id binding via AAD ──────────────────────────────

  it('emits v=2 envelopes by default', async () => {
    const owner = await makeDevice()
    const envelope = await encryptShare(
      sampleBody, owner.kp, owner.deviceId, [], crypto.randomUUID(),
    )
    expect(envelope.v).toBe(2)
  })

  it('rejects decrypt when the server lies about the sender device id', async () => {
    const owner = await makeDevice()
    const bob = await makeDevice()
    const mallory = await makeDevice()
    const envelopeId = crypto.randomUUID()
    const envelope = await encryptShare(sampleBody, owner.kp, owner.deviceId, [
      { deviceId: bob.deviceId, publicKey: bob.publicKey },
    ], envelopeId)

    // Server claims Mallory is the author but the AAD was computed with
    // owner.deviceId on the encrypt side → AES-GCM tag must reject.
    await expect(
      decryptShare(envelope, bob.kp, bob.deviceId, owner.publicKey, mallory.deviceId, envelopeId),
    ).rejects.toBeDefined()
  })

  it('rejects decrypt when the server moves the envelope to a different row', async () => {
    const owner = await makeDevice()
    const bob = await makeDevice()
    const envelopeId = crypto.randomUUID()
    const envelope = await encryptShare(sampleBody, owner.kp, owner.deviceId, [
      { deviceId: bob.deviceId, publicKey: bob.publicKey },
    ], envelopeId)

    // Server presents the same ciphertext under a different row id →
    // AAD differs → GCM tag must reject.
    await expect(
      decryptShare(envelope, bob.kp, bob.deviceId, owner.publicKey, owner.deviceId, crypto.randomUUID()),
    ).rejects.toBeDefined()
  })

  it('accepts legacy v1 envelopes (no AAD) for backward compat', async () => {
    // Hand-craft a v1 envelope by stripping the v field after encrypt with
    // a mocked legacy encoder — easier: encrypt with v=2 then re-encrypt
    // without AAD by calling the raw helpers. Simplest: monkey-patch
    // envelope.v to undefined and re-encrypt without AAD.
    //
    // Instead, we round-trip through the new code path with v=2 and then
    // verify the *legacy fallback*: if we drop the v field, decryptShare
    // must NOT apply AAD — so a v1 envelope produced by the old release
    // (which used no AAD) still works.
    //
    // We simulate "old release" by calling the AES-GCM helpers directly
    // without AAD and assembling a ShareEnvelope by hand.
    const owner = await makeDevice()
    const bob = await makeDevice()
    const { generateContentKeyBytes, encryptWithContentKey, toB64u } = await import('./crypto')
    const { deriveWrappingKey, wrapContentKey, importPublicKey } = await import('./crypto')

    const contentKey = generateContentKeyBytes()
    const compressed = new TextEncoder().encode(JSON.stringify(sampleBody))
    const blob = await encryptWithContentKey(compressed, contentKey)
    const ownerWrap = await deriveWrappingKey(owner.kp.privateKey, owner.kp.publicKey)
    const bobPub = await importPublicKey(bob.publicKey)
    const bobWrap = await deriveWrappingKey(owner.kp.privateKey, bobPub)
    const legacyEnvelope: ShareEnvelope = {
      // v intentionally omitted — legacy shape
      ciphertext: toB64u(blob.ciphertext),
      iv: toB64u(blob.iv),
      encryptedKeys: {
        [owner.deviceId]: await wrapContentKey(contentKey, ownerWrap),
        [bob.deviceId]: await wrapContentKey(contentKey, bobWrap),
      },
    }

    // sender/envelope ids must be accepted but unused for v1.
    const { body } = await decryptShare(
      legacyEnvelope, bob.kp, bob.deviceId, owner.publicKey,
      owner.deviceId, crypto.randomUUID(),
    )
    expect(body).toEqual(sampleBody)
  })
})

describe('encryptAnnotation / decryptAnnotation', () => {
  const annotation: AnnotationBody = {
    $type: 'remember-me-annotation',
    version: 1,
    text: 'Das war der Sommer vor meiner Einschulung – ich habe dich angeschubst!',
    imageCount: 0,
    authorName: 'Bob',
    createdAt: '2026-04-22T09:00:00Z',
  }

  it('audience can decrypt an annotation', async () => {
    const bob = await makeDevice()        // annotation author
    const anna = await makeDevice()       // original memory owner
    const charlie = await makeDevice()    // another audience member
    const envelopeId = crypto.randomUUID()

    const envelope = await encryptAnnotation(annotation, bob.kp, bob.deviceId, [
      { deviceId: anna.deviceId, publicKey: anna.publicKey },
      { deviceId: charlie.deviceId, publicKey: charlie.publicKey },
    ], envelopeId)

    const annaView = await decryptAnnotation(envelope, anna.kp, anna.deviceId, bob.publicKey, bob.deviceId, envelopeId)
    const charlieView = await decryptAnnotation(envelope, charlie.kp, charlie.deviceId, bob.publicKey, bob.deviceId, envelopeId)
    expect(annaView).toEqual(annotation)
    expect(charlieView).toEqual(annotation)
  })

  it('rejects decrypt when the server lies about the annotation author', async () => {
    const bob = await makeDevice()
    const anna = await makeDevice()
    const mallory = await makeDevice()
    const envelopeId = crypto.randomUUID()

    const envelope = await encryptAnnotation(annotation, bob.kp, bob.deviceId, [
      { deviceId: anna.deviceId, publicKey: anna.publicKey },
    ], envelopeId)

    await expect(
      decryptAnnotation(envelope, anna.kp, anna.deviceId, bob.publicKey, mallory.deviceId, envelopeId),
    ).rejects.toBeDefined()
  })

  it('share-AAD and annotation-AAD are domain-separated', async () => {
    // Even with identical (senderId, envelopeId), a share envelope must not
    // decrypt as an annotation and vice-versa — the AAD's `share`/`annotation`
    // tag prevents type-confusion attacks.
    const owner = await makeDevice()
    const bob = await makeDevice()
    const envelopeId = crypto.randomUUID()
    const shareEnv = await encryptShare(sampleBody, owner.kp, owner.deviceId, [
      { deviceId: bob.deviceId, publicKey: bob.publicKey },
    ], envelopeId)

    await expect(
      decryptAnnotation(shareEnv, bob.kp, bob.deviceId, owner.publicKey, owner.deviceId, envelopeId),
    ).rejects.toBeDefined()
  })
})

describe('encryptImage / decryptImage', () => {
  it('round-trips image bytes with a content-key', async () => {
    const ck = generateContentKeyBytes()
    const bytes = crypto.getRandomValues(new Uint8Array(5000))
    const enc = await encryptImage(bytes, ck)
    const dec = await decryptImage(enc, ck)
    expect(dec).toEqual(bytes)
  })
})

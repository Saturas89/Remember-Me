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
    const envelope = await encryptShare(sampleBody, owner.kp, owner.deviceId, [])
    const { body } = await decryptShare(envelope, owner.kp, owner.deviceId, owner.publicKey)
    expect(body).toEqual(sampleBody)
  })

  it('recipient can decrypt a share addressed to them', async () => {
    const owner = await makeDevice()
    const bob = await makeDevice()
    const recipients: Recipient[] = [{ deviceId: bob.deviceId, publicKey: bob.publicKey }]

    const envelope = await encryptShare(sampleBody, owner.kp, owner.deviceId, recipients)

    expect(Object.keys(envelope.encryptedKeys).sort()).toEqual(
      [owner.deviceId, bob.deviceId].sort(),
    )

    const { body } = await decryptShare(envelope, bob.kp, bob.deviceId, owner.publicKey)
    expect(body).toEqual(sampleBody)
  })

  it('each recipient gets an independent wrapped key', async () => {
    const owner = await makeDevice()
    const bob = await makeDevice()
    const charlie = await makeDevice()

    const envelope = await encryptShare(sampleBody, owner.kp, owner.deviceId, [
      { deviceId: bob.deviceId, publicKey: bob.publicKey },
      { deviceId: charlie.deviceId, publicKey: charlie.publicKey },
    ])

    const bobResult = await decryptShare(envelope, bob.kp, bob.deviceId, owner.publicKey)
    const charlieResult = await decryptShare(envelope, charlie.kp, charlie.deviceId, owner.publicKey)

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

    const envelope = await encryptShare(sampleBody, owner.kp, owner.deviceId, [
      { deviceId: bob.deviceId, publicKey: bob.publicKey },
    ])

    await expect(
      decryptShare(envelope, eve.kp, eve.deviceId, owner.publicKey),
    ).rejects.toBeDefined()
  })

  it('tampering with ciphertext is detected', async () => {
    const owner = await makeDevice()
    const bob = await makeDevice()
    const envelope = await encryptShare(sampleBody, owner.kp, owner.deviceId, [
      { deviceId: bob.deviceId, publicKey: bob.publicKey },
    ])
    // Flip a bit in the ciphertext body
    const ctBytes = Array.from(envelope.ciphertext)
    ctBytes[5] = ctBytes[5] === 'A' ? 'B' : 'A'
    envelope.ciphertext = ctBytes.join('')

    await expect(
      decryptShare(envelope, bob.kp, bob.deviceId, owner.publicKey),
    ).rejects.toBeDefined()
  })

  it('server (no keys) cannot see plaintext', async () => {
    const owner = await makeDevice()
    const bob = await makeDevice()
    const envelope = await encryptShare(sampleBody, owner.kp, owner.deviceId, [
      { deviceId: bob.deviceId, publicKey: bob.publicKey },
    ])
    // Serialize as the server would store it
    const stored = JSON.stringify(envelope)
    expect(stored).not.toContain('Oma')
    expect(stored).not.toContain('Sommer 1984')
    expect(stored).not.toContain('Anna')
    expect(stored).not.toContain('q-childhood-summer')
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

    const envelope = await encryptAnnotation(annotation, bob.kp, bob.deviceId, [
      { deviceId: anna.deviceId, publicKey: anna.publicKey },
      { deviceId: charlie.deviceId, publicKey: charlie.publicKey },
    ])

    const annaView = await decryptAnnotation(envelope, anna.kp, anna.deviceId, bob.publicKey)
    const charlieView = await decryptAnnotation(envelope, charlie.kp, charlie.deviceId, bob.publicKey)
    expect(annaView).toEqual(annotation)
    expect(charlieView).toEqual(annotation)
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

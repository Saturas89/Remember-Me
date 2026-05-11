// ── Integration test: zwei User teilen Erinnerungen ─────────────────────────
//
// Was wir hier prüfen wollen, ohne Playwright:
//
//   1. User A bootstrapped seine Session und wird im `devices`-Backend bekannt.
//   2. User A teilt eine Erinnerung Ende-zu-Ende verschlüsselt mit User B.
//   3. User B fetched die eingehenden Shares und kann sie wieder entschlüsseln.
//   4. User B ergänzt eine Annotation; User A bekommt sie beim nächsten Sync.
//   5. Außenstehender User C sieht **nichts** — die ECDH-Wraps sind nicht für
//      ihn, also liefert `fetchIncomingShares` ein leeres Memory-Array.
//
// Das deckt `sharingService` + `shareEncryption` + `crypto` in einem Test
// gegen einen In-Memory-Supabase-Fake ab — was bisher nur in Playwright
// gegen denselben Fake im Browser möglich war. Jeder User läuft in einer
// eigenen `sharingService`-Modul-Instanz (siehe `loadIsolatedSharing`),
// teilt sich aber das `Backend`.

import { describe, it, expect, beforeEach } from 'vitest'
import { createInMemoryBackend, type Backend } from '../test-helpers/supabaseFake'
import { loadIsolatedSharing, type IsolatedSharingApi } from '../test-helpers/loadIsolatedSharing'
import type { ShareBody, AnnotationBody } from '../types'

function makeShareBody(overrides: Partial<ShareBody> = {}): ShareBody {
  return {
    $type: 'remember-me-share',
    version: 1,
    questionId: 'q-childhood-home',
    questionText: 'Wo bist du aufgewachsen?',
    value: 'In einem kleinen Dorf am Bodensee.',
    imageCount: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    ownerName: 'Alice',
    ...overrides,
  }
}

function makeAnnotationBody(overrides: Partial<AnnotationBody> = {}): AnnotationBody {
  return {
    $type: 'remember-me-annotation',
    version: 1,
    text: 'Wir haben dich dort 1985 besucht!',
    imageCount: 0,
    authorName: 'Bob',
    createdAt: '2024-01-02T00:00:00.000Z',
    ...overrides,
  }
}

describe('friend share flow (integration, two devices in one process)', () => {
  let backend: Backend
  let alice: IsolatedSharingApi
  let bob: IsolatedSharingApi
  let aliceDeviceId: string
  let alicePublicKey: string
  let bobDeviceId: string
  let bobPublicKey: string

  beforeEach(async () => {
    backend = createInMemoryBackend()
    alice = await loadIsolatedSharing(backend)
    bob = await loadIsolatedSharing(backend)

    const aliceSession = await alice.bootstrapSession()
    const bobSession = await bob.bootstrapSession()
    aliceDeviceId = aliceSession.deviceId
    alicePublicKey = aliceSession.publicKeyB64
    bobDeviceId = bobSession.deviceId
    bobPublicKey = bobSession.publicKeyB64
  })

  it('registriert beide Geräte im Backend mit unterschiedlichen Device-IDs', () => {
    expect(aliceDeviceId).not.toBe(bobDeviceId)
    expect(backend.devices).toHaveLength(2)
    const ids = backend.devices.map(d => d.id as string).sort()
    expect(ids).toEqual([aliceDeviceId, bobDeviceId].sort())
  })

  it('Alice teilt eine Erinnerung mit Bob, Bob kann sie entschlüsseln', async () => {
    const body = makeShareBody()

    const { shareId } = await alice.shareMemory({
      body,
      recipients: [{ deviceId: bobDeviceId, publicKey: bobPublicKey }],
      images: [],
    })

    expect(backend.shares).toHaveLength(1)
    expect(backend.shares[0].id).toBe(shareId)
    expect(backend.share_recipients).toHaveLength(2) // Alice (self) + Bob

    const incoming = await bob.fetchIncomingShares()
    expect(incoming.memories).toHaveLength(1)
    const memory = incoming.memories[0]
    expect(memory.shareId).toBe(shareId)
    expect(memory.ownerDeviceId).toBe(aliceDeviceId)
    expect(memory.questionText).toBe(body.questionText)
    expect(memory.value).toBe(body.value)
    expect(memory.ownerName).toBe(body.ownerName)
  })

  it('die geteilte Erinnerung ist auf dem Server nicht im Klartext lesbar', async () => {
    const body = makeShareBody({ value: 'Geheime Erinnerung, nur für Bob.' })
    await alice.shareMemory({
      body,
      recipients: [{ deviceId: bobDeviceId, publicKey: bobPublicKey }],
      images: [],
    })

    const stored = JSON.stringify(backend.shares[0])
    expect(stored).not.toContain('Geheime Erinnerung')
    expect(stored).not.toContain(body.questionText)
    expect(stored).not.toContain(body.ownerName)
  })

  it('eine fremde Drittpartei sieht den Klartext nicht, obwohl die Row im Backend existiert', async () => {
    const charlie = await loadIsolatedSharing(backend)
    await charlie.bootstrapSession()

    await alice.shareMemory({
      body: makeShareBody({ value: 'Nur für Bob bestimmt.' }),
      recipients: [{ deviceId: bobDeviceId, publicKey: bobPublicKey }],
      images: [],
    })

    // Der In-Memory-Fake hat keine RLS, also "sieht" Charlie die Row beim
    // SELECT (anders als in Produktion mit RLS). Trotzdem darf er den Inhalt
    // nicht entschlüsseln — die ECDH-Wraps enthalten keinen Eintrag für ihn.
    const charlieIncoming = await charlie.fetchIncomingShares()
    expect(charlieIncoming.memories).toEqual([])
  })

  it('Bob ergänzt eine Annotation, Alice sieht sie beim nächsten Fetch', async () => {
    const { shareId } = await alice.shareMemory({
      body: makeShareBody(),
      recipients: [{ deviceId: bobDeviceId, publicKey: bobPublicKey }],
      images: [],
    })

    const annotationBody = makeAnnotationBody({ text: 'Ich erinnere mich auch!' })
    await bob.addAnnotation({
      shareId,
      body: annotationBody,
      audience: [{ deviceId: aliceDeviceId, publicKey: alicePublicKey }],
    })

    const aliceIncoming = await alice.fetchIncomingShares()
    expect(aliceIncoming.annotations).toHaveLength(1)
    const note = aliceIncoming.annotations[0]
    expect(note.shareId).toBe(shareId)
    expect(note.authorDeviceId).toBe(bobDeviceId)
    expect(note.text).toBe(annotationBody.text)
    expect(note.authorName).toBe(annotationBody.authorName)
  })

  it('deactivateOnlineSharing löscht Bobs Daten kaskadiert vom Backend', async () => {
    await alice.shareMemory({
      body: makeShareBody(),
      recipients: [{ deviceId: bobDeviceId, publicKey: bobPublicKey }],
      images: [],
    })
    await bob.addAnnotation({
      shareId: backend.shares[0].id as string,
      body: makeAnnotationBody(),
      audience: [{ deviceId: aliceDeviceId, publicKey: alicePublicKey }],
    })
    expect(backend.share_recipients.some(r => r.recipient_id === bobDeviceId)).toBe(true)
    expect(backend.annotations.some(a => a.author_id === bobDeviceId)).toBe(true)

    await bob.deactivateOnlineSharing()

    expect(backend.devices.map(d => d.id as string)).toEqual([aliceDeviceId])
    expect(backend.share_recipients.some(r => r.recipient_id === bobDeviceId)).toBe(false)
    expect(backend.annotations.some(a => a.author_id === bobDeviceId)).toBe(false)
    // Alice's eigene Share-Row bleibt erhalten — sie ist nicht von Bob abhängig.
    expect(backend.shares).toHaveLength(1)
  })
})

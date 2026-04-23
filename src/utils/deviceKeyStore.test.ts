// @vitest-environment node
//
// Uses node's native crypto.subtle (ECDH P-256) + fake-indexeddb for
// an in-memory IDB backing store.
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, it, expect, vi } from 'vitest'

type Mod = typeof import('./deviceKeyStore')

async function fresh(): Promise<Mod> {
  ;(globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory()
  vi.resetModules()
  return await import('./deviceKeyStore')
}

describe('deviceKeyStore', () => {
  let mod: Mod
  beforeEach(async () => { mod = await fresh() })

  it('creates a new device key pair on first load and returns the public key in base64url', async () => {
    const { keyPair, publicKeyB64 } = await mod.loadOrCreateDeviceKey()
    expect(keyPair.publicKey.type).toBe('public')
    expect(keyPair.privateKey.type).toBe('private')
    // SPKI for P-256 is 91 bytes → base64url is 122 chars without padding
    expect(publicKeyB64).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(publicKeyB64.length).toBeGreaterThan(100)
  })

  it('returns the same key pair on a second load (persisted singleton)', async () => {
    const first = await mod.loadOrCreateDeviceKey()
    const second = await mod.loadOrCreateDeviceKey()
    expect(second.publicKeyB64).toBe(first.publicKeyB64)
    // CryptoKey references are stored directly in IndexedDB, so identity is preserved
    expect(second.keyPair.publicKey).toStrictEqual(first.keyPair.publicKey)
  })

  it('private keys from the generated pair are non-extractable', async () => {
    const { keyPair } = await mod.loadOrCreateDeviceKey()
    expect(keyPair.privateKey.extractable).toBe(false)
  })

  it('clearDeviceKey removes the singleton so the next load creates a fresh pair', async () => {
    const first = await mod.loadOrCreateDeviceKey()
    await mod.clearDeviceKey()
    const second = await mod.loadOrCreateDeviceKey()
    expect(second.publicKeyB64).not.toBe(first.publicKeyB64)
  })

  it('clearDeviceKey on an empty store resolves without error', async () => {
    await expect(mod.clearDeviceKey()).resolves.toBeUndefined()
  })
})

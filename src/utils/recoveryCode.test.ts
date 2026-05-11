// @vitest-environment node
//
// Unit tests for REQ-017 recovery-code crypto helpers.
// Test IDs R-01 .. R-10 from Master-Spec §12.2, plus R-11..R-13 for the
// H3 non-extractable / non-JWK-in-IDB hardening.
//
// Runs in Node (default since v22) so that crypto.subtle (PBKDF2 / AES-GCM)
// is the platform-native implementation – jsdom does not expose subtle.

import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import {
  generateRecoveryCode,
  formatRecoveryCode,
  normalizeRecoveryCode,
  deriveVaultKey,
  encryptText,
  decryptText,
  cacheVaultKey,
  loadCachedVaultKey,
  clearCachedVaultKey,
} from './recoveryCode'
import { SyncError } from './privateSyncProvider'

describe('generateRecoveryCode', () => {
  it('R-01: liefert genau 24 Zeichen', () => {
    expect(generateRecoveryCode()).toHaveLength(24)
  })

  it('R-02: nutzt nur [A-Za-z0-9] (Base62)', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRecoveryCode()
      expect(code).toMatch(/^[A-Za-z0-9]{24}$/)
    }
  })

  it('R-03: 1000 Aufrufe → 1000 verschiedene Werte', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 1000; i++) seen.add(generateRecoveryCode())
    expect(seen.size).toBe(1000)
  })
})

describe('formatRecoveryCode / normalizeRecoveryCode', () => {
  it('R-04: formatiert 24-Zeichen-Code in 6×4-Gruppen mit Bindestrich', () => {
    expect(formatRecoveryCode('ABCDEFGHIJKLMNOPQRSTUVWX')).toBe(
      'ABCD-EFGH-IJKL-MNOP-QRST-UVWX',
    )
  })

  it('R-05: normalisiert Eingabe zu reinem 24-Zeichen-String', () => {
    expect(normalizeRecoveryCode('ABCD-EFGH-IJKL-MNOP-QRST-UVWX')).toBe(
      'ABCDEFGHIJKLMNOPQRSTUVWX',
    )
    expect(normalizeRecoveryCode('  ABCD-EFGH  ')).toBe('ABCDEFGH')
  })
})

describe('deriveVaultKey + encrypt/decryptText', () => {
  it('R-06: liefert AES-GCM CryptoKey', async () => {
    const key = await deriveVaultKey('ABCDEFGHIJKLMNOPQRSTUVWX', 'user-1')
    expect(key.algorithm.name).toBe('AES-GCM')
    expect((key.algorithm as AesKeyAlgorithm).length).toBe(256)
  })

  it('R-07: encrypt → decrypt Roundtrip rekonstruiert das Plaintext', async () => {
    const key = await deriveVaultKey('ABCDEFGHIJKLMNOPQRSTUVWX', 'user-1')
    const plaintext = JSON.stringify({ hello: 'world', n: 42, ä: 'ü' })
    const { ct, iv } = await encryptText(plaintext, key)
    expect(ct).not.toBe(plaintext)
    const decrypted = await decryptText(ct, iv, key)
    expect(decrypted).toBe(plaintext)
  })

  it('R-08: Falscher Key → SyncError mit code "decrypt"', async () => {
    const goodKey = await deriveVaultKey('ABCDEFGHIJKLMNOPQRSTUVWX', 'user-1')
    const wrongKey = await deriveVaultKey('YZABCDEFGHIJKLMNOPQRSTUV', 'user-1')

    const { ct, iv } = await encryptText('secret', goodKey)
    let captured: unknown
    try {
      await decryptText(ct, iv, wrongKey)
    } catch (err) {
      captured = err
    }
    expect(captured).toBeInstanceOf(SyncError)
    expect((captured as SyncError).code).toBe('decrypt')
  })

  it('R-09: deriveVaultKey deterministisch (gleicher code+userId → kompatible Keys)', async () => {
    const k1 = await deriveVaultKey('ABCDEFGHIJKLMNOPQRSTUVWX', 'user-42')
    const k2 = await deriveVaultKey('ABCDEFGHIJKLMNOPQRSTUVWX', 'user-42')
    const { ct, iv } = await encryptText('hello-determinism', k1)
    const plain = await decryptText(ct, iv, k2)
    expect(plain).toBe('hello-determinism')
  })

  it('R-10: Verschiedene userId → verschiedener Key (decrypt schlägt fehl)', async () => {
    const code = 'ABCDEFGHIJKLMNOPQRSTUVWX'
    const keyA = await deriveVaultKey(code, 'user-A')
    const keyB = await deriveVaultKey(code, 'user-B')
    const { ct, iv } = await encryptText('cross-user', keyA)

    let captured: unknown
    try {
      await decryptText(ct, iv, keyB)
    } catch (err) {
      captured = err
    }
    expect(captured).toBeInstanceOf(SyncError)
    expect((captured as SyncError).code).toBe('decrypt')
  })
})

// ── H3: non-extractable vault key + no JWK in IDB ─────────────────────────

const VAULT_DB = 'rm-sync-vault-db'
const VAULT_STORE = 'rm-sync-vault'

function openVaultIdbRaw(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(VAULT_DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(VAULT_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function readRawIdb(userId: string): Promise<unknown> {
  const db = await openVaultIdbRaw()
  return new Promise<unknown>((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE, 'readonly')
    const req = tx.objectStore(VAULT_STORE).get(userId)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function writeRawIdb(userId: string, value: unknown): Promise<void> {
  const db = await openVaultIdbRaw()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE, 'readwrite')
    tx.objectStore(VAULT_STORE).put(value, userId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

describe('H3: non-extractable vault key + no JWK in IDB', () => {
  beforeEach(async () => {
    // fake-indexeddb is process-local; clear between tests.
    await clearCachedVaultKey('h3-user')
  })

  it('R-11: deriveVaultKey returns a non-extractable key (exportKey rejects)', async () => {
    const key = await deriveVaultKey('ABCDEFGHIJKLMNOPQRSTUVWX', 'h3-user')
    expect(key.extractable).toBe(false)
    await expect(
      crypto.subtle.exportKey('jwk', key),
    ).rejects.toBeDefined()
  })

  it('R-12: cacheVaultKey stores a CryptoKey reference, NOT a JWK', async () => {
    const key = await deriveVaultKey('ABCDEFGHIJKLMNOPQRSTUVWX', 'h3-user')
    await cacheVaultKey('h3-user', key)

    const raw = await readRawIdb('h3-user')
    expect(raw).toBeInstanceOf(CryptoKey)
    // Belt-and-suspenders: the stored object has no `k` field (the raw
    // bytes that JWK export would leak).
    expect((raw as Record<string, unknown>).k).toBeUndefined()
  })

  it('R-12b: round-trip preserves AES semantics', async () => {
    const key = await deriveVaultKey('ABCDEFGHIJKLMNOPQRSTUVWX', 'h3-user')
    await cacheVaultKey('h3-user', key)
    const reloaded = await loadCachedVaultKey('h3-user')
    expect(reloaded).not.toBeNull()
    expect(reloaded!.extractable).toBe(false)
    const { ct, iv } = await encryptText('round-trip-secret', reloaded!)
    const plain = await decryptText(ct, iv, key)
    expect(plain).toBe('round-trip-secret')
  })

  it('R-13: legacy JWK row in IDB auto-migrates to a CryptoKey on next load', async () => {
    // Simulate the pre-H3 storage shape: an extractable AES-GCM CryptoKey
    // exported as JWK and dumped into IDB by the old `cacheVaultKey`.
    const legacyKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    )
    const jwk = await crypto.subtle.exportKey('jwk', legacyKey)
    await writeRawIdb('h3-user', jwk)
    // Sanity: the raw row still carries the bare key bytes.
    expect((await readRawIdb('h3-user') as JsonWebKey).k).toBeDefined()

    const loaded = await loadCachedVaultKey('h3-user')
    expect(loaded).not.toBeNull()
    expect(loaded!.extractable).toBe(false)

    // After migration the IDB row no longer carries the raw key bytes.
    const post = await readRawIdb('h3-user')
    expect(post).toBeInstanceOf(CryptoKey)
    expect((post as Record<string, unknown>).k).toBeUndefined()
  })

  it('R-13b: loadCachedVaultKey returns null for an empty row', async () => {
    expect(await loadCachedVaultKey('h3-user-empty')).toBeNull()
  })
})

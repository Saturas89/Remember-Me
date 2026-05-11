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
  cacheKdfParams,
  loadKdfParams,
  clearKdfParams,
  freshKdfParams,
  legacyKdfParams,
  generateKdfSalt,
  KDF_V3_ITERATIONS,
  KDF_V3_SALT_BYTES,
  loadLastSeenVersion,
  saveLastSeenVersion,
  clearLastSeenVersion,
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
    const key = await deriveVaultKey('ABCDEFGHIJKLMNOPQRSTUVWX', legacyKdfParams('user-1'))
    expect(key.algorithm.name).toBe('AES-GCM')
    expect((key.algorithm as AesKeyAlgorithm).length).toBe(256)
  })

  it('R-07: encrypt → decrypt Roundtrip rekonstruiert das Plaintext', async () => {
    const key = await deriveVaultKey('ABCDEFGHIJKLMNOPQRSTUVWX', legacyKdfParams('user-1'))
    const plaintext = JSON.stringify({ hello: 'world', n: 42, ä: 'ü' })
    const { ct, iv } = await encryptText(plaintext, key)
    expect(ct).not.toBe(plaintext)
    const decrypted = await decryptText(ct, iv, key)
    expect(decrypted).toBe(plaintext)
  })

  it('R-08: Falscher Key → SyncError mit code "decrypt"', async () => {
    const goodKey = await deriveVaultKey('ABCDEFGHIJKLMNOPQRSTUVWX', legacyKdfParams('user-1'))
    const wrongKey = await deriveVaultKey('YZABCDEFGHIJKLMNOPQRSTUV', legacyKdfParams('user-1'))

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
    const k1 = await deriveVaultKey('ABCDEFGHIJKLMNOPQRSTUVWX', legacyKdfParams('user-42'))
    const k2 = await deriveVaultKey('ABCDEFGHIJKLMNOPQRSTUVWX', legacyKdfParams('user-42'))
    const { ct, iv } = await encryptText('hello-determinism', k1)
    const plain = await decryptText(ct, iv, k2)
    expect(plain).toBe('hello-determinism')
  })

  it('R-10: Verschiedene userId → verschiedener Key (decrypt schlägt fehl)', async () => {
    const code = 'ABCDEFGHIJKLMNOPQRSTUVWX'
    const keyA = await deriveVaultKey(code, legacyKdfParams('user-A'))
    const keyB = await deriveVaultKey(code, legacyKdfParams('user-B'))
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
const KDF_STORE = 'rm-sync-kdf'

const VERSION_STORE = 'rm-sync-version'

function openVaultIdbRaw(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // Production code opens at v3 (H5). Match here so fake-indexeddb
    // doesn't reject a "downgrade" in the H3 tests that touch this helper.
    const req = indexedDB.open(VAULT_DB, 3)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(VAULT_STORE)) db.createObjectStore(VAULT_STORE)
      if (!db.objectStoreNames.contains(KDF_STORE)) db.createObjectStore(KDF_STORE)
      if (!db.objectStoreNames.contains(VERSION_STORE)) db.createObjectStore(VERSION_STORE)
    }
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
    const key = await deriveVaultKey('ABCDEFGHIJKLMNOPQRSTUVWX', legacyKdfParams('h3-user'))
    expect(key.extractable).toBe(false)
    await expect(
      crypto.subtle.exportKey('jwk', key),
    ).rejects.toBeDefined()
  })

  it('R-12: cacheVaultKey stores a CryptoKey reference, NOT a JWK', async () => {
    const key = await deriveVaultKey('ABCDEFGHIJKLMNOPQRSTUVWX', legacyKdfParams('h3-user'))
    await cacheVaultKey('h3-user', key)

    const raw = await readRawIdb('h3-user')
    expect(raw).toBeInstanceOf(CryptoKey)
    // Belt-and-suspenders: the stored object has no `k` field (the raw
    // bytes that JWK export would leak).
    expect((raw as Record<string, unknown>).k).toBeUndefined()
  })

  it('R-12b: round-trip preserves AES semantics', async () => {
    const key = await deriveVaultKey('ABCDEFGHIJKLMNOPQRSTUVWX', legacyKdfParams('h3-user'))
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

// ── H7: PBKDF2 600k iterations + 16-byte random salt ──────────────────────

describe('H7: KDF v3 — 600k iterations + random salt', () => {
  beforeEach(async () => {
    await clearKdfParams('h7-user')
  })

  it('K-01: freshKdfParams emits a 16-byte random salt and 600k iterations', () => {
    const a = freshKdfParams()
    expect(a.iterations).toBe(KDF_V3_ITERATIONS)
    expect(a.salt.length).toBe(KDF_V3_SALT_BYTES)

    // Two consecutive calls yield distinct salts (no PRNG reuse).
    const b = freshKdfParams()
    expect(Array.from(a.salt)).not.toEqual(Array.from(b.salt))
  })

  it('K-02: legacyKdfParams reproduces the pre-H7 derivation parameters', () => {
    const p = legacyKdfParams('user-1')
    expect(p.iterations).toBe(200_000)
    expect(new TextDecoder().decode(p.salt)).toBe('user-1')
  })

  it('K-03: same code under fresh vs legacy params yields incompatible keys', async () => {
    const code = 'ABCDEFGHIJKLMNOPQRSTUVWX'
    const userId = 'k03-user'
    const legacy = legacyKdfParams(userId)
    const fresh = { salt: generateKdfSalt(), iterations: KDF_V3_ITERATIONS }

    const legacyKey = await deriveVaultKey(code, legacy)
    const freshKey = await deriveVaultKey(code, fresh)

    const { ct, iv } = await encryptText('crossover-test', legacyKey)
    await expect(decryptText(ct, iv, freshKey)).rejects.toBeInstanceOf(SyncError)
  })

  it('K-04: cacheKdfParams + loadKdfParams round-trip preserves salt + iterations', async () => {
    const params = freshKdfParams()
    await cacheKdfParams('h7-user', params)
    const loaded = await loadKdfParams('h7-user')
    expect(loaded).not.toBeNull()
    expect(loaded!.iterations).toBe(params.iterations)
    expect(Array.from(loaded!.salt)).toEqual(Array.from(params.salt))
  })

  it('K-05: loadKdfParams returns null for an unseen user', async () => {
    expect(await loadKdfParams('h7-unknown')).toBeNull()
  })

  it('K-06: clearCachedVaultKey also wipes the KDF cache (defense-in-depth)', async () => {
    await cacheKdfParams('h7-user', freshKdfParams())
    expect(await loadKdfParams('h7-user')).not.toBeNull()
    await clearCachedVaultKey('h7-user')
    expect(await loadKdfParams('h7-user')).toBeNull()
  })
})

// ── H5: monotonic envelope version + rollback rejection ───────────────────

describe('H5: monotonic envelope version', () => {
  beforeEach(async () => {
    await clearLastSeenVersion('h5-user')
  })

  it('V-01: unseen syncId returns 0', async () => {
    expect(await loadLastSeenVersion('h5-unknown')).toBe(0)
  })

  it('V-02: save + load round-trips', async () => {
    await saveLastSeenVersion('h5-user', 42)
    expect(await loadLastSeenVersion('h5-user')).toBe(42)
    await saveLastSeenVersion('h5-user', 100)
    expect(await loadLastSeenVersion('h5-user')).toBe(100)
  })

  it('V-03: clearCachedVaultKey also clears the version high-water mark', async () => {
    await saveLastSeenVersion('h5-user', 17)
    expect(await loadLastSeenVersion('h5-user')).toBe(17)
    await clearCachedVaultKey('h5-user')
    expect(await loadLastSeenVersion('h5-user')).toBe(0)
  })
})

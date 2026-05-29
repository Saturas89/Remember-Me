import { SyncError } from './privateSyncProvider'
import { toB64u, fromB64u } from './base64url'

const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const CODE_LENGTH = 24

// 256 / 62 = 4 with remainder 8 → only bytes < 248 map uniformly to one of
// the 62 alphabet positions. Bytes 248..255 are rejected and resampled, which
// removes the modulo bias that the previous `b % 62` had (values 0..7
// previously appeared with probability 5/256 vs 4/256 for 8..61).
const REJECT_THRESHOLD = Math.floor(256 / BASE62.length) * BASE62.length

export function generateRecoveryCode(): string {
  const out: string[] = []
  while (out.length < CODE_LENGTH) {
    const buf = crypto.getRandomValues(new Uint8Array(CODE_LENGTH * 2))
    for (let i = 0; i < buf.length && out.length < CODE_LENGTH; i++) {
      const b = buf[i]
      if (b >= REJECT_THRESHOLD) continue
      out.push(BASE62[b % BASE62.length])
    }
  }
  return out.join('')
}

export function formatRecoveryCode(raw: string): string {
  return raw.match(/.{1,4}/g)?.join('-') ?? raw
}

export function normalizeRecoveryCode(input: string): string {
  return input.replace(/-/g, '').trim()
}

export interface KdfParams {
  /** PBKDF2 salt. v2 (legacy): userId UTF-8 bytes. v3: 16 random bytes. */
  salt: Uint8Array
  /** PBKDF2 iteration count. v2: 200_000. v3: 600_000. */
  iterations: number
}

/** H7: OWASP-2023 recommends ≥ 600 000 iterations for PBKDF2-SHA256. */
export const KDF_V3_ITERATIONS = 600_000 as const

/** H7: 128-bit random salt makes pre-computed rainbow tables useless. */
export const KDF_V3_SALT_BYTES = 16 as const

export function generateKdfSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(KDF_V3_SALT_BYTES))
}

/** Pre-H7 derivation parameters. Used only on the read path when an
 *  existing v2 envelope/row has no explicit `salt` field. */
export function legacyKdfParams(userId: string): KdfParams {
  return { salt: new TextEncoder().encode(userId), iterations: 200_000 }
}

/** Default derivation parameters for new setups. Pairs with a fresh
 *  random salt — call `generateKdfSalt()` and pass the result. */
export function freshKdfParams(): KdfParams {
  return { salt: generateKdfSalt(), iterations: KDF_V3_ITERATIONS }
}

export async function deriveVaultKey(
  recoveryCode: string,
  params: KdfParams,
): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(recoveryCode),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: params.salt.buffer as ArrayBuffer,
      iterations: params.iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    // H3: non-extractable. The vault key never leaves Web Crypto's
    // internal heap — `exportKey` rejects, so XSS can't dump the raw
    // bytes out of IndexedDB even with full DOM access.
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptText(
  plaintext: string,
  key: CryptoKey,
): Promise<{ ct: string; iv: string }> {
  const enc = new TextEncoder()
  const ivBytes = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: ivBytes },
    key,
    enc.encode(plaintext),
  )
  return {
    ct: toB64u(new Uint8Array(ciphertext)),
    iv: toB64u(ivBytes),
  }
}

export async function decryptText(
  ct: string,
  iv: string,
  key: CryptoKey,
): Promise<string> {
  try {
    const ctBytes = fromB64u(ct)
    const ivBytes = fromB64u(iv)
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      key,
      ctBytes,
    )
    return new TextDecoder().decode(plain)
  } catch {
    throw new SyncError('Entschlüsselung fehlgeschlagen – falscher Recovery Code', 'decrypt')
  }
}

const IDB_VAULT_KEY_STORE = 'rm-sync-vault'
const IDB_KDF_STORE = 'rm-sync-kdf'
const IDB_VERSION_STORE = 'rm-sync-version'

async function openVaultIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // DB bumped: v1 = vault only, v2 (H7) = +kdf store, v3 (H5) = +version
    // store for monotonic-rollback rejection. All upgrades are additive
    // and idempotent — existing rows survive each step.
    const req = indexedDB.open('rm-sync-vault-db', 3)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_VAULT_KEY_STORE)) {
        db.createObjectStore(IDB_VAULT_KEY_STORE)
      }
      if (!db.objectStoreNames.contains(IDB_KDF_STORE)) {
        db.createObjectStore(IDB_KDF_STORE)
      }
      if (!db.objectStoreNames.contains(IDB_VERSION_STORE)) {
        db.createObjectStore(IDB_VERSION_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function cacheVaultKey(userId: string, key: CryptoKey): Promise<void> {
  // H3: store the CryptoKey object directly via IndexedDB's structured
  // clone — the previous JWK export wrote the raw key bytes into IDB,
  // where any XSS with DOM access could read them out. CryptoKey survives
  // structured-clone but the underlying key material stays inside Web
  // Crypto's heap, so `exportKey` is the only way back out — and
  // non-extractable keys (see deriveVaultKey) reject that.
  const db = await openVaultIdb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_VAULT_KEY_STORE, 'readwrite')
    tx.objectStore(IDB_VAULT_KEY_STORE).put(key, userId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Best-effort detector for the pre-H3 storage shape: a JWK object dumped
 *  into IDB by `exportKey('jwk', key)`. Symmetric AES-GCM JWKs always
 *  carry `kty: 'oct'` and a base64url `k`. */
function isLegacyJwk(value: unknown): value is JsonWebKey {
  return (
    typeof value === 'object'
    && value !== null
    && 'kty' in value
    && 'k' in value
  )
}

export async function loadCachedVaultKey(userId: string): Promise<CryptoKey | null> {
  try {
    const db = await openVaultIdb()
    const stored = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(IDB_VAULT_KEY_STORE, 'readonly')
      const req = tx.objectStore(IDB_VAULT_KEY_STORE).get(userId)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    if (stored === undefined || stored === null) return null

    // Fast path: post-H3 row is a CryptoKey reference reconstructed by
    // IDB's structured-clone.
    if (stored instanceof CryptoKey) return stored

    // Legacy path: pre-H3 row is a JWK with the raw key bytes. Re-import
    // it as non-extractable and overwrite the IDB row with the CryptoKey
    // reference, so the raw bytes vanish on the very next storage write
    // and subsequent loads take the fast path.
    if (isLegacyJwk(stored)) {
      const key = await crypto.subtle.importKey(
        'jwk',
        stored,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      )
      await cacheVaultKey(userId, key)
      return key
    }

    return null
  } catch {
    return null
  }
}

export async function clearCachedVaultKey(userId: string): Promise<void> {
  try {
    const db = await openVaultIdb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_VAULT_KEY_STORE, 'readwrite')
      tx.objectStore(IDB_VAULT_KEY_STORE).delete(userId)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch { /* best-effort */ }
  await clearKdfParams(userId).catch(() => { /* best-effort */ })
  await clearLastSeenVersion(userId).catch(() => { /* best-effort */ })
}

// ── KDF params cache ────────────────────────────────────────────────────
//
// The PBKDF2 salt + iteration count travel with the encrypted envelope so a
// new device can re-derive the vault key from the recovery code. The active
// device additionally caches them here so push() can re-write the envelope's
// KDF metadata consistently without having to re-read the existing row each
// time. Shares the same IDB as the vault key, with its own store.

interface SerializedKdfParams {
  salt: number[]
  iterations: number
}

export async function cacheKdfParams(userId: string, params: KdfParams): Promise<void> {
  const db = await openVaultIdb()
  const serialized: SerializedKdfParams = {
    salt: Array.from(params.salt),
    iterations: params.iterations,
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_KDF_STORE, 'readwrite')
    tx.objectStore(IDB_KDF_STORE).put(serialized, userId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadKdfParams(userId: string): Promise<KdfParams | null> {
  try {
    const db = await openVaultIdb()
    const stored = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(IDB_KDF_STORE, 'readonly')
      const req = tx.objectStore(IDB_KDF_STORE).get(userId)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    if (!stored || typeof stored !== 'object') return null
    const s = stored as SerializedKdfParams
    if (!Array.isArray(s.salt) || typeof s.iterations !== 'number') return null
    return { salt: new Uint8Array(s.salt), iterations: s.iterations }
  } catch {
    return null
  }
}

export async function clearKdfParams(userId: string): Promise<void> {
  try {
    const db = await openVaultIdb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_KDF_STORE, 'readwrite')
      tx.objectStore(IDB_KDF_STORE).delete(userId)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch { /* best-effort */ }
}

// ── H5: monotonic envelope version + rollback rejection ───────────────────
//
// Each successful push embeds a monotonically increasing `envelopeVersion`
// inside the encrypted payload. The local device caches the highest version
// it has accepted; any subsequent pull whose decrypted version is *lower*
// is rejected as a replay (a stale backup served by a malicious server, an
// outdated cached file accidentally promoted to "current", etc.).
//
// The counter lives inside the encrypted payload so a server-controlled
// attacker can't forge a high version: AES-GCM's auth tag binds the value
// to the same ciphertext that carries the state.

export async function loadLastSeenVersion(syncId: string): Promise<number> {
  try {
    const db = await openVaultIdb()
    const stored = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(IDB_VERSION_STORE, 'readonly')
      const req = tx.objectStore(IDB_VERSION_STORE).get(syncId)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    return typeof stored === 'number' ? stored : 0
  } catch {
    return 0
  }
}

export async function saveLastSeenVersion(syncId: string, version: number): Promise<void> {
  const db = await openVaultIdb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_VERSION_STORE, 'readwrite')
    tx.objectStore(IDB_VERSION_STORE).put(version, syncId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function clearLastSeenVersion(syncId: string): Promise<void> {
  try {
    const db = await openVaultIdb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_VERSION_STORE, 'readwrite')
      tx.objectStore(IDB_VERSION_STORE).delete(syncId)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch { /* best-effort */ }
}

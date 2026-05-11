import { SyncError } from './privateSyncProvider'

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

export async function deriveVaultKey(
  recoveryCode: string,
  userId: string,
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
      salt: enc.encode(userId),
      iterations: 200_000,
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
    ct: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    iv: btoa(String.fromCharCode(...ivBytes)),
  }
}

export async function decryptText(
  ct: string,
  iv: string,
  key: CryptoKey,
): Promise<string> {
  try {
    const ctBytes = Uint8Array.from(atob(ct), c => c.charCodeAt(0))
    const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0))
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

async function openVaultIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('rm-sync-vault-db', 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_VAULT_KEY_STORE)
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
}

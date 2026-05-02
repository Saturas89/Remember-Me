import { SyncError } from './privateSyncProvider'

const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const CODE_LENGTH = 24

export function generateRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH))
  return Array.from(bytes, b => BASE62[b % BASE62.length]).join('')
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
    true,
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
  const exported = await crypto.subtle.exportKey('jwk', key)
  const db = await openVaultIdb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_VAULT_KEY_STORE, 'readwrite')
    tx.objectStore(IDB_VAULT_KEY_STORE).put(exported, userId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadCachedVaultKey(userId: string): Promise<CryptoKey | null> {
  try {
    const db = await openVaultIdb()
    const jwk = await new Promise<JsonWebKey | undefined>((resolve, reject) => {
      const tx = db.transaction(IDB_VAULT_KEY_STORE, 'readonly')
      const req = tx.objectStore(IDB_VAULT_KEY_STORE).get(userId)
      req.onsuccess = () => resolve(req.result as JsonWebKey | undefined)
      req.onerror = () => reject(req.error)
    })
    if (!jwk) return null
    return crypto.subtle.importKey('jwk', jwk, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
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

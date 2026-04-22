// ── Device key persistence (IndexedDB) ──────────────────────────────────────
//
// Stores the ECDH key pair that identifies this device in the sharing
// network. The private key is non-extractable: IndexedDB can persist a
// CryptoKey reference, but the underlying key material never leaves the
// browser's crypto subsystem.
//
// Purged by disableOnlineSharing → `clearDeviceKey()`.

import {
  generateDeviceKeyPair,
  exportPublicKey,
  type DeviceKeyPair,
} from './crypto'

const DB_NAME = 'rm-device-key'
const STORE = 'keys'
const SINGLETON_ID = 'device-keypair-v1'

interface StoredKeyPair {
  publicKey: CryptoKey
  privateKey: CryptoKey
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function idbGet<T>(db: IDBDatabase, id: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(id)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

function idbPut(db: IDBDatabase, id: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).put(value, id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

function idbDelete(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/**
 * Load the existing device key pair or create + persist a new one.
 * Returns the pair plus the SPKI-base64url form of the public key.
 */
export async function loadOrCreateDeviceKey(): Promise<{
  keyPair: DeviceKeyPair
  publicKeyB64: string
}> {
  const db = await openDB()
  const existing = await idbGet<StoredKeyPair>(db, SINGLETON_ID)
  if (existing?.publicKey && existing?.privateKey) {
    return {
      keyPair: { publicKey: existing.publicKey, privateKey: existing.privateKey },
      publicKeyB64: await exportPublicKey(existing.publicKey),
    }
  }
  const kp = await generateDeviceKeyPair()
  await idbPut(db, SINGLETON_ID, { publicKey: kp.publicKey, privateKey: kp.privateKey })
  return { keyPair: kp, publicKeyB64: await exportPublicKey(kp.publicKey) }
}

/**
 * Delete the device key pair from IndexedDB. Called by disableOnlineSharing
 * *after* the server rows have been removed.
 */
export async function clearDeviceKey(): Promise<void> {
  const db = await openDB()
  await idbDelete(db, SINGLETON_ID)
}

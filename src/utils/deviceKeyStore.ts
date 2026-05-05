// ── Device key persistence (IndexedDB) ──────────────────────────────────────
//
// Stores the ECDH key pair that identifies this device in the sharing
// network. The private key is non-extractable: IndexedDB can persist a
// CryptoKey reference, but the underlying key material never leaves the
// browser's crypto subsystem.
//
// Purged by disableOnlineSharing → `clearDeviceKey()`.
//
// E2E builds (VITE_E2E=true): IndexedDB callbacks are slow (>35 s) on
// Playwright's iPhone 14 emulation (isMobile:true, hasTouch:true). We
// instead use sessionStorage to persist the key pair across page reloads
// within the same browser context. Private keys are generated as
// extractable so they can be serialised as JWK.

import {
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

// ── E2E helpers ───────────────────────────────────────────────────────────────

const E2E_SESSION_KEY = 'rm-e2e-device-key'

interface SerializedE2EKey {
  privateKeyJwk: JsonWebKey
  publicKeySpki: string // base64
}

// Module-level cache: avoids re-parsing sessionStorage on repeated calls
// within the same page load.
let _e2eKeyPair: { keyPair: DeviceKeyPair; publicKeyB64: string } | null = null

async function e2eLoadOrCreate(): Promise<{ keyPair: DeviceKeyPair; publicKeyB64: string }> {
  if (_e2eKeyPair) return _e2eKeyPair

  // sessionStorage persists across page reloads within the same browser
  // context, so the public key stays stable even after page.goto() calls.
  if (typeof sessionStorage !== 'undefined') {
    const raw = sessionStorage.getItem(E2E_SESSION_KEY)
    if (raw) {
      try {
        const { privateKeyJwk, publicKeySpki }: SerializedE2EKey = JSON.parse(raw)
        const spkiBytes = Uint8Array.from(atob(publicKeySpki), c => c.charCodeAt(0))
        const publicKey = await crypto.subtle.importKey(
          'spki', spkiBytes,
          { name: 'ECDH', namedCurve: 'P-256' },
          true, [],
        )
        const privateKey = await crypto.subtle.importKey(
          'jwk', privateKeyJwk,
          { name: 'ECDH', namedCurve: 'P-256' },
          false, ['deriveKey', 'deriveBits'],
        )
        const publicKeyB64 = await exportPublicKey(publicKey)
        _e2eKeyPair = { keyPair: { publicKey, privateKey }, publicKeyB64 }
        return _e2eKeyPair
      } catch {
        sessionStorage.removeItem(E2E_SESSION_KEY)
      }
    }
  }

  // Generate extractable key pair so we can serialise private key to JWK.
  const kp = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits'],
  )
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', kp.privateKey)
  const spkiBuffer = await crypto.subtle.exportKey('spki', kp.publicKey)
  const publicKeySpki = btoa(String.fromCharCode(...new Uint8Array(spkiBuffer)))

  if (typeof sessionStorage !== 'undefined') {
    const toStore: SerializedE2EKey = { privateKeyJwk, publicKeySpki }
    sessionStorage.setItem(E2E_SESSION_KEY, JSON.stringify(toStore))
  }

  const publicKeyB64 = await exportPublicKey(kp.publicKey)
  _e2eKeyPair = { keyPair: { publicKey: kp.publicKey, privateKey: kp.privateKey }, publicKeyB64 }
  return _e2eKeyPair
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Load the existing device key pair or create + persist a new one.
 * Returns the pair plus the SPKI-base64url form of the public key.
 */
export async function loadOrCreateDeviceKey(): Promise<{
  keyPair: DeviceKeyPair
  publicKeyB64: string
}> {
  if (import.meta.env.VITE_E2E === 'true') return e2eLoadOrCreate()

  const db = await openDB()
  const existing = await idbGet<StoredKeyPair>(db, SINGLETON_ID)
  if (existing?.publicKey && existing?.privateKey) {
    return {
      keyPair: { publicKey: existing.publicKey, privateKey: existing.privateKey },
      publicKeyB64: await exportPublicKey(existing.publicKey),
    }
  }
  const kp = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveKey', 'deriveBits'],
  )
  await idbPut(db, SINGLETON_ID, { publicKey: kp.publicKey, privateKey: kp.privateKey })
  return { keyPair: { publicKey: kp.publicKey, privateKey: kp.privateKey }, publicKeyB64: await exportPublicKey(kp.publicKey) }
}

/**
 * Delete the device key pair from IndexedDB. Called by disableOnlineSharing
 * *after* the server rows have been removed.
 */
export async function clearDeviceKey(): Promise<void> {
  if (import.meta.env.VITE_E2E === 'true') {
    _e2eKeyPair = null
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(E2E_SESSION_KEY)
    return
  }
  const db = await openDB()
  await idbDelete(db, SINGLETON_ID)
}

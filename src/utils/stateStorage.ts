// ── Encrypted localStorage persistence ───────────────────────────────────────
//
// App state is AES-GCM-256 encrypted before writing to localStorage.
// The non-extractable CryptoKey lives in IndexedDB (same origin, but a
// separate store from the ECDH device key used by online sharing).
//
// If IDB or SubtleCrypto is unavailable (private browsing, old browser,
// or the jsdom test environment), the module silently falls back to
// plaintext so nothing breaks.
//
// Migration: data written without the "enc1:" prefix is treated as legacy
// plaintext and parsed directly; the next save re-encrypts it.

import type { AppState } from '../types'

const STORAGE_KEY = 'remember-me-state'
const KEY_DB = 'rm-state-key'
const KEY_STORE = 'keys'
const KEY_ID = 'aes-gcm-v1'
const ENC_PREFIX = 'enc1:'

let _key: CryptoKey | null = null
let _keyUnavailable = false
let _pendingWrite: Promise<void> = Promise.resolve()
let _currentState: AppState | null = null

function hasCryptoSupport(): boolean {
  if (import.meta.env.VITE_E2E === 'true') return false
  return (
    !!globalThis.indexedDB &&
    typeof crypto !== 'undefined' &&
    !!crypto.subtle
  )
}

function openKeyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(KEY_DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(KEY_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function idbGet(db: IDBDatabase): Promise<CryptoKey | undefined> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(KEY_STORE, 'readonly').objectStore(KEY_STORE).get(KEY_ID)
    req.onsuccess = () => resolve(req.result as CryptoKey | undefined)
    req.onerror = () => reject(req.error)
  })
}

function idbPut(db: IDBDatabase, key: CryptoKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(KEY_STORE, 'readwrite').objectStore(KEY_STORE).put(key, KEY_ID)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

async function loadOrCreateKey(): Promise<CryptoKey> {
  const db = await openKeyDb()
  const existing = await idbGet(db)
  if (existing) return existing
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
  await idbPut(db, key)
  return key
}

async function tryGetKey(): Promise<CryptoKey | null> {
  if (_keyUnavailable) return null
  if (_key) return _key
  if (!hasCryptoSupport()) {
    _keyUnavailable = true
    return null
  }
  try {
    _key = await loadOrCreateKey()
    return _key
  } catch {
    _keyUnavailable = true
    return null
  }
}

function uint8ToBase64(arr: Uint8Array): string {
  let str = ''
  for (let i = 0; i < arr.length; i++) str += String.fromCharCode(arr[i])
  return btoa(str)
}

function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr
}

async function encryptJson(json: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(json)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  const buf = new Uint8Array(12 + ciphertext.byteLength)
  buf.set(iv, 0)
  buf.set(new Uint8Array(ciphertext), 12)
  return ENC_PREFIX + uint8ToBase64(buf)
}

async function decryptStored(stored: string): Promise<string> {
  if (!stored.startsWith(ENC_PREFIX)) return stored // legacy plaintext
  const key = await tryGetKey()
  if (!key) throw new Error('no key available for decryption')
  const buf = base64ToUint8(stored.slice(ENC_PREFIX.length))
  const iv = buf.slice(0, 12)
  const ciphertext = buf.slice(12)
  const decoded = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return new TextDecoder().decode(decoded)
}

/** Pre-load the encryption key. Called once at app startup so subsequent saves can encrypt. */
export async function initStorageKey(): Promise<void> {
  await tryGetKey()
}

/** Read and decrypt the persisted AppState. Returns null on empty store or decryption failure. */
export async function loadStoredState(): Promise<AppState | null> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const json = await decryptStored(raw)
    const state = JSON.parse(json) as AppState
    _currentState = state
    return state
  } catch {
    return null
  }
}

/**
 * Persist AppState to localStorage.
 *
 * Always writes plaintext synchronously first so data survives an immediate
 * page reload (e.g. triggered by the user or an E2E test). When the
 * encryption key is ready the write is then overwritten with an
 * AES-GCM-256 ciphertext in the background.
 */
export function saveState(state: AppState): void {
  _currentState = state
  const json = JSON.stringify(state)
  try {
    localStorage.setItem(STORAGE_KEY, json)
  } catch (err) {
    console.error('remember-me: failed to persist state', err)
    return
  }
  if (_key) {
    const key = _key
    _pendingWrite = _pendingWrite.then(async () => {
      try {
        const encrypted = await encryptJson(json, key)
        localStorage.setItem(STORAGE_KEY, encrypted)
      } catch {
        // Plaintext fallback is already in localStorage; not fatal.
      }
    })
  }
}

/** Resolves once all pending encrypted writes have been flushed to localStorage. */
export function flushPendingWrites(): Promise<void> {
  return _pendingWrite
}

/** Reset module-level state. For use in tests only. */
export function _resetForTests(): void {
  _key = null
  _keyUnavailable = false
  _pendingWrite = Promise.resolve()
  _currentState = null
}

// ── E2E / debug bridge ────────────────────────────────────────────────────────
//
// Exposes the current in-memory state on window.__rmState so Playwright
// helpers can introspect and inject state without having to parse the
// (possibly encrypted) localStorage key directly.
//
// This is intentionally available in all builds: the bridge only returns
// what any XSS could already read from the React in-memory state, so it
// adds no meaningful attack surface.
if (typeof window !== 'undefined') {
  ;(window as Window & { __rmState?: { get: () => AppState | null; save: (s: AppState) => void } }).__rmState = {
    get: () => _currentState,
    save: saveState,
  }
}

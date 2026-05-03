// ── Encryption envelope for cloud-storage sync providers ─────────────────────
//
// Both GoogleDriveProvider and OneDriveProvider write a single JSON file to
// the user's cloud storage. Up to schemaVersion 1 the file held the AppState
// and media manifest in plaintext, which meant anyone who got read access to
// the user's Drive (e.g. via a Google account compromise) could read all
// memories.
//
// schemaVersion 2 wraps the state + manifest in an AES-256-GCM envelope. The
// vault key is derived from a recovery code via PBKDF2 (see recoveryCode.ts).
// The non-secret `syncId` doubles as PBKDF2 salt and lets a second device
// derive the same key after the user enters their recovery code.
//
// Media blobs themselves are still uploaded as raw bytes – encrypting them
// would break resumable uploads and is tracked separately. Their filenames
// are random UUIDs so they leak no metadata about questions or answers.

import type { AppState } from '../types'
import { encryptText, decryptText } from './recoveryCode'
import { SyncError } from './privateSyncProvider'

export const SYNC_SCHEMA_VERSION = 2 as const

// The envelope itself is provider-agnostic – the payload TManifest type is a
// phantom that flows through encrypt/decrypt so providers keep their own
// manifest typing without losing inference.
export interface EncryptedSyncEnvelope {
  schemaVersion: typeof SYNC_SCHEMA_VERSION
  encryption: 'recovery-code-v1'
  /** Stable per-install UUID. Doubles as PBKDF2 salt. NOT secret. */
  syncId: string
  syncedAt: string
  appVersion: string
  /** AES-256-GCM ciphertext of JSON.stringify({ state, mediaManifest }) */
  ciphertext: string
  /** AES-GCM IV, base64 */
  iv: string
}

interface EncryptedPayload<TManifest> {
  state: AppState
  mediaManifest: TManifest
}

export async function encryptSyncEnvelope<TManifest>(opts: {
  state: AppState
  mediaManifest: TManifest
  vaultKey: CryptoKey
  syncId: string
  appVersion: string
}): Promise<EncryptedSyncEnvelope> {
  const payload: EncryptedPayload<TManifest> = {
    state: opts.state,
    mediaManifest: opts.mediaManifest,
  }
  const { ct, iv } = await encryptText(JSON.stringify(payload), opts.vaultKey)
  return {
    schemaVersion: SYNC_SCHEMA_VERSION,
    encryption: 'recovery-code-v1',
    syncId: opts.syncId,
    syncedAt: new Date().toISOString(),
    appVersion: opts.appVersion,
    ciphertext: ct,
    iv,
  }
}

export async function decryptSyncEnvelope<TManifest>(
  envelope: EncryptedSyncEnvelope,
  vaultKey: CryptoKey,
): Promise<EncryptedPayload<TManifest>> {
  const plain = await decryptText(envelope.ciphertext, envelope.iv, vaultKey)
  return JSON.parse(plain) as EncryptedPayload<TManifest>
}

/**
 * Inspect a parsed sync-file JSON without decrypting. Returns the syncId if
 * the file is in encrypted v2 format; null if it's a legacy v1 plaintext
 * file or an unrecognised format.
 */
export function readEncryptedSyncId(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.schemaVersion !== SYNC_SCHEMA_VERSION) return null
  if (r.encryption !== 'recovery-code-v1') return null
  if (typeof r.syncId !== 'string' || r.syncId.length === 0) return null
  if (typeof r.ciphertext !== 'string' || typeof r.iv !== 'string') return null
  return r.syncId
}

/**
 * Type guard + narrowing to EncryptedSyncEnvelope. Throws SyncError('decrypt')
 * if the file is in legacy v1 plaintext format – callers should treat that as
 * "user must re-run setup with a recovery code".
 */
export function parseEncryptedSyncEnvelope(raw: unknown): EncryptedSyncEnvelope {
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>
    // Legacy v1: top-level `state` field, no `encryption` field.
    if (r.schemaVersion === 1 || (r.state && !('encryption' in r))) {
      throw new SyncError(
        'Älteres unverschlüsseltes Sync-Format gefunden – bitte Einrichtung neu durchlaufen, damit der Recovery Code gesetzt wird.',
        'decrypt',
      )
    }
  }
  if (!readEncryptedSyncId(raw)) {
    throw new SyncError('Sync-Datei hat ein unbekanntes Format', 'decrypt')
  }
  return raw as EncryptedSyncEnvelope
}

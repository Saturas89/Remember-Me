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
// schemaVersion 2 also encrypts media blobs (images / audio / video). Each
// blob is sealed with a fresh AES-256-GCM nonce under the same vault key; the
// IV and the original MIME type are persisted in the manifest entry inside
// the encrypted envelope. Cloud-side the files are uploaded as
// application/octet-stream, so a Drive viewer cannot tell whether a given
// object is a photo, an audio clip, or noise. Manifest entries without an
// `iv` field are treated as plaintext for backward compatibility with users
// upgrading from the H1-prefix release.

import type { AppState } from '../types'
import { encryptText, decryptText } from './recoveryCode'
import { SyncError } from './privateSyncProvider'

// H7: schema v3 carries explicit PBKDF2 salt + iteration count so the recovery
// key can be re-derived on a new device under the same params that were used
// at setup. v2 envelopes have no kdf* fields → readers fall back to the
// legacy "salt = syncId UTF-8, iter = 200_000" derivation. Pre-v2 envelopes
// are not supported.
export const SYNC_SCHEMA_VERSION = 3 as const

// The envelope itself is provider-agnostic – the payload TManifest type is a
// phantom that flows through encrypt/decrypt so providers keep their own
// manifest typing without losing inference.
export interface EncryptedSyncEnvelope {
  /** 2 = legacy KDF (salt=syncId, 200k iter). 3 = explicit kdf* fields. */
  schemaVersion: 2 | 3
  encryption: 'recovery-code-v1'
  /** Stable per-install UUID. NOT secret. Doubles as PBKDF2 salt for v2. */
  syncId: string
  syncedAt: string
  appVersion: string
  /** AES-256-GCM ciphertext of JSON.stringify({ state, mediaManifest }) */
  ciphertext: string
  /** AES-GCM IV, base64 */
  iv: string
  /** H7: base64url 16-byte random salt. Present iff schemaVersion === 3. */
  kdfSalt?: string
  /** H7: PBKDF2 iteration count used to derive the vault key. v3 only. */
  kdfIterations?: number
}

interface EncryptedPayload<TManifest> {
  state: AppState
  mediaManifest: TManifest
  /** H5: monotonically increasing per-syncId counter, embedded in the
   *  encrypted payload so a malicious server cannot forge a high value to
   *  bypass the local replay check. Absent (= 0) on legacy v2 payloads. */
  envelopeVersion?: number
}

export async function encryptSyncEnvelope<TManifest>(opts: {
  state: AppState
  mediaManifest: TManifest
  vaultKey: CryptoKey
  syncId: string
  appVersion: string
  /** H7: the PBKDF2 salt + iterations used to derive `vaultKey`. Stored
   *  with the envelope so a new device can re-derive the same key from
   *  the recovery code. Omit only when emitting a legacy v2 envelope. */
  kdf?: { salt: string; iterations: number }
  /** H5: monotonic version embedded inside the AES-GCM payload so the
   *  server cannot tamper with it. Pull-side replay check rejects any
   *  remote payload whose version is below the locally cached high-water
   *  mark. */
  envelopeVersion?: number
}): Promise<EncryptedSyncEnvelope> {
  const payload: EncryptedPayload<TManifest> = {
    state: opts.state,
    mediaManifest: opts.mediaManifest,
    ...(typeof opts.envelopeVersion === 'number' ? { envelopeVersion: opts.envelopeVersion } : {}),
  }
  const { ct, iv } = await encryptText(JSON.stringify(payload), opts.vaultKey)
  return {
    schemaVersion: opts.kdf ? 3 : 2,
    encryption: 'recovery-code-v1',
    syncId: opts.syncId,
    syncedAt: new Date().toISOString(),
    appVersion: opts.appVersion,
    ciphertext: ct,
    iv,
    ...(opts.kdf
      ? { kdfSalt: opts.kdf.salt, kdfIterations: opts.kdf.iterations }
      : {}),
  }
}

export async function decryptSyncEnvelope<TManifest>(
  envelope: EncryptedSyncEnvelope,
  vaultKey: CryptoKey,
): Promise<EncryptedPayload<TManifest>> {
  const plain = await decryptText(envelope.ciphertext, envelope.iv, vaultKey)
  return JSON.parse(plain) as EncryptedPayload<TManifest>
}

// ── Media blob encryption ────────────────────────────────────────────────────
//
// Cloud storage gets raw AES-GCM ciphertext as an opaque
// application/octet-stream object. The IV and the original MIME type stay
// inside the encrypted manifest (which lives in the envelope above), so the
// only thing a Drive-side attacker learns is the file size — and the
// approximate media kind from the manifest itself, which we cannot avoid
// without padding every blob.

const MEDIA_IV_BYTES = 12 as const

/**
 * Seal a media blob with a fresh 12-byte IV under the vault key. The
 * returned ciphertext is binary (no base64 inflation) and gets uploaded as
 * `application/octet-stream`; iv + mimeType land in the manifest entry.
 */
export async function encryptMediaBlob(
  blob: Blob,
  vaultKey: CryptoKey,
): Promise<{ ciphertext: Blob; iv: string; mimeType: string }> {
  const ivBytes = crypto.getRandomValues(new Uint8Array(MEDIA_IV_BYTES))
  const plain = await blob.arrayBuffer()
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: ivBytes },
    vaultKey,
    plain,
  )
  return {
    ciphertext: new Blob([ct], { type: 'application/octet-stream' }),
    iv: btoa(String.fromCharCode(...ivBytes)),
    mimeType: blob.type || 'application/octet-stream',
  }
}

/**
 * Reverse of `encryptMediaBlob`. Throws SyncError('decrypt') if the auth tag
 * does not validate (wrong vault key or tampered ciphertext).
 */
export async function decryptMediaBlob(
  ciphertext: Blob,
  iv: string,
  mimeType: string,
  vaultKey: CryptoKey,
): Promise<Blob> {
  try {
    const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0))
    const ctBytes = await ciphertext.arrayBuffer()
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      vaultKey,
      ctBytes,
    )
    return new Blob([plain], { type: mimeType || 'application/octet-stream' })
  } catch {
    throw new SyncError('Media-Entschlüsselung fehlgeschlagen', 'decrypt')
  }
}

/**
 * Inspect a parsed sync-file JSON without decrypting. Returns the syncId if
 * the file is in encrypted v2 format; null if it's a legacy v1 plaintext
 * file or an unrecognised format.
 */
export function readEncryptedSyncId(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.schemaVersion !== 2 && r.schemaVersion !== 3) return null
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

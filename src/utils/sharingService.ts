// ── High-level sharing service ──────────────────────────────────────────────
//
// Wraps Supabase calls + shareEncryption so the React layer can work with
// plaintext SharedMemory/Annotation objects. This module is only imported
// via dynamic import() from code paths that already verified the user has
// opted in to online sharing (onlineSharing.enabled === true).

import {
  getSupabaseClient,
  ensureAnonymousSession,
  resetSupabaseClient,
} from './supabaseClient'
import { loadOrCreateDeviceKey, clearDeviceKey } from './deviceKeyStore'
import {
  encryptShare,
  decryptShare,
  encryptAnnotation,
  decryptAnnotation,
  encryptImage,
  type Recipient,
  type ShareEnvelope,
} from './shareEncryption'
import { toB64u, fromB64u, type DeviceKeyPair } from './crypto'
import type {
  ShareBody,
  AnnotationBody,
  SharedMemory,
  Annotation,
} from '../types'

interface Session {
  deviceId: string
  publicKeyB64: string
  keyPair: DeviceKeyPair
}

let _session: Session | null = null

/**
 * Bootstraps the online-sharing session (once per app load). Idempotent.
 * Called by useOnlineSync on mount when opt-in is enabled.
 */
export async function bootstrapSession(): Promise<Session> {
  if (_session) return _session

  const deviceId = await ensureAnonymousSession()
  const { keyPair, publicKeyB64 } = await loadOrCreateDeviceKey()
  const supabase = getSupabaseClient()

  // Upsert our device row. If the row already exists with the same public
  // key we're fine; if the key differs (e.g. fresh install) we let the
  // upsert overwrite – every client update brings a fresh private key too.
  const { error } = await supabase
    .from('devices')
    .upsert({ id: deviceId, public_key: toBytea(fromB64u(publicKeyB64)) })
  if (error) throw error

  _session = { deviceId, publicKeyB64, keyPair }
  return _session
}

export function currentSession(): Session | null {
  return _session
}

function requireSession(): Session {
  if (!_session) throw new Error('online sharing session not bootstrapped')
  return _session
}

// ── Recipient lookup ─────────────────────────────────────────────────────────

export async function lookupRecipientPublicKey(deviceId: string): Promise<string | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('devices')
    .select('public_key')
    .eq('id', deviceId)
    .maybeSingle()
  if (error || !data) return null
  // Supabase returns bytea as a hex-prefixed string when using the JSON API.
  // We normalize here; in practice the client stores public keys as base64url
  // themselves (loaded from the contact handshake), so lookup is a fallback.
  const raw = data.public_key as unknown
  if (typeof raw === 'string') {
    // Hex prefix "\x..."
    if (raw.startsWith('\\x')) {
      const hex = raw.slice(2)
      const bytes = new Uint8Array(hex.length / 2)
      for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
      return toB64u(bytes)
    }
    return raw // already base64url
  }
  if (raw instanceof Uint8Array) return toB64u(raw)
  return null
}

// ── Share a memory ───────────────────────────────────────────────────────────

export interface ShareMemoryInput {
  body: ShareBody
  recipients: Recipient[]
  /** Image bytes to upload, encrypted with the share's content-key. */
  images: Uint8Array[]
}

export async function shareMemory(input: ShareMemoryInput): Promise<{ shareId: string }> {
  const session = requireSession()
  const supabase = getSupabaseClient()

  const envelope = await encryptShare(
    input.body,
    session.keyPair,
    session.deviceId,
    input.recipients,
  )

  const { data: shareRow, error: shareErr } = await supabase
    .from('shares')
    .insert({
      owner_id: session.deviceId,
      ciphertext: toBytea(fromB64u(envelope.ciphertext)),
      iv: toBytea(fromB64u(envelope.iv)),
      encrypted_keys: envelope.encryptedKeys,
    })
    .select('id')
    .single()
  if (shareErr || !shareRow) throw shareErr ?? new Error('failed to insert share')
  const shareId = shareRow.id as string

  // ACL rows
  const acl = [
    { share_id: shareId, recipient_id: session.deviceId },
    ...input.recipients
      .filter(r => r.deviceId !== session.deviceId)
      .map(r => ({ share_id: shareId, recipient_id: r.deviceId })),
  ]
  if (acl.length > 0) {
    const { error: aclErr } = await supabase.from('share_recipients').insert(acl)
    if (aclErr) throw aclErr
  }

  // Encrypt + upload images. We need the content-key back to encrypt images,
  // but encryptShare doesn't return it. Re-derive it by unwrapping our own
  // wrapped key: easier + cheaper than refactoring encryptShare.
  if (input.images.length > 0) {
    const { contentKey } = await decryptShare(
      envelope,
      session.keyPair,
      session.deviceId,
      session.publicKeyB64,
    )

    for (const img of input.images) {
      const enc = await encryptImage(img, contentKey)
      const mediaId = crypto.randomUUID()
      const path = `${shareId}/${mediaId}.bin`

      const { error: upErr } = await supabase.storage
        .from('share-media')
        .upload(path, enc.ciphertext, { contentType: 'application/octet-stream' })
      if (upErr) throw upErr

      const { error: mediaErr } = await supabase
        .from('share_media')
        .insert({
          id: mediaId,
          share_id: shareId,
          storage_path: path,
          iv: toBytea(enc.iv),
        })
      if (mediaErr) throw mediaErr
    }
  }

  return { shareId }
}

// ── Fetch incoming shares ────────────────────────────────────────────────────

/**
 * Returns all shares addressed to the current device (decrypted) plus any
 * annotations on them. Used on sync / page-open.
 */
export async function fetchIncomingShares(): Promise<{
  memories: SharedMemory[]
  annotations: Annotation[]
}> {
  const session = requireSession()
  const supabase = getSupabaseClient()

  // RLS already filters to the shares this device may see.
  const { data: shareRows, error: shareErr } = await supabase
    .from('shares')
    .select('id, owner_id, ciphertext, iv, encrypted_keys, created_at, updated_at')
  if (shareErr) throw shareErr

  const memories: SharedMemory[] = []
  const contentKeys = new Map<string, Uint8Array>() // shareId → key, for annotation decrypt

  if (shareRows && shareRows.length > 0) {
    // Batch-lookup owner public keys
    const ownerIds = [...new Set(shareRows.map(r => r.owner_id as string))]
    const { data: owners, error: ownersErr } = await supabase
      .from('devices')
      .select('id, public_key')
      .in('id', ownerIds)
    if (ownersErr) throw ownersErr

    const ownerPubs = new Map<string, string>()
    for (const o of owners ?? []) {
      const pub = normalizePublicKey(o.public_key)
      if (pub) ownerPubs.set(o.id as string, pub)
    }

    for (const row of shareRows) {
      const ownerPub = ownerPubs.get(row.owner_id as string)
      if (!ownerPub) continue
      try {
        const envelope: ShareEnvelope = {
          ciphertext: toB64u(coerceBytes(row.ciphertext)),
          iv: toB64u(coerceBytes(row.iv)),
          encryptedKeys: row.encrypted_keys,
        }
        const { body, contentKey } = await decryptShare(
          envelope,
          session.keyPair,
          session.deviceId,
          ownerPub,
        )
        memories.push({
          shareId: row.id,
          ownerDeviceId: row.owner_id as string,
          ownerName: body.ownerName,
          questionId: body.questionId,
          questionText: body.questionText,
          value: body.value,
          imageIds: [], // filled in by media fetch below
          createdAt: body.createdAt,
          updatedAt: row.updated_at as string,
        })
        contentKeys.set(row.id as string, contentKey)
      } catch {
        // Unreadable share → skip (wrong recipient, tampered, etc.)
      }
    }
  }

  // Fetch annotations for the shares we successfully decrypted
  const annotations: Annotation[] = []
  const shareIds = memories.map(m => m.shareId)
  if (shareIds.length > 0) {
    const { data: annoRows, error: annoErr } = await supabase
      .from('annotations')
      .select('id, share_id, author_id, ciphertext, iv, encrypted_keys, created_at')
      .in('share_id', shareIds)
    if (annoErr) throw annoErr

    // Lookup author public keys
    const authorIds = [...new Set((annoRows ?? []).map(r => r.author_id as string))]
    const authorPubs = new Map<string, string>()
    if (authorIds.length > 0) {
      const { data: authors } = await supabase
        .from('devices')
        .select('id, public_key')
        .in('id', authorIds)
      for (const a of authors ?? []) {
        const pub = normalizePublicKey(a.public_key)
        if (pub) authorPubs.set(a.id as string, pub)
      }
    }

    for (const row of annoRows ?? []) {
      const authorPub = authorPubs.get(row.author_id as string)
      if (!authorPub) continue
      try {
        const envelope: ShareEnvelope = {
          ciphertext: toB64u(coerceBytes(row.ciphertext)),
          iv: toB64u(coerceBytes(row.iv)),
          encryptedKeys: row.encrypted_keys,
        }
        const body = await decryptAnnotation(
          envelope,
          session.keyPair,
          session.deviceId,
          authorPub,
        )
        annotations.push({
          annotationId: row.id as string,
          shareId: row.share_id as string,
          authorDeviceId: row.author_id as string,
          authorName: body.authorName,
          text: body.text,
          imageIds: [],
          createdAt: body.createdAt,
        })
      } catch {
        // Unreadable → skip
      }
    }
  }

  return { memories, annotations }
}

// ── Annotations ──────────────────────────────────────────────────────────────

export interface AddAnnotationInput {
  shareId: string
  body: AnnotationBody
  /** Audience = original share's owner + other recipients. */
  audience: Recipient[]
}

export async function addAnnotation(input: AddAnnotationInput): Promise<{ annotationId: string }> {
  const session = requireSession()
  const supabase = getSupabaseClient()

  const envelope = await encryptAnnotation(
    input.body,
    session.keyPair,
    session.deviceId,
    input.audience,
  )

  const { data, error } = await supabase
    .from('annotations')
    .insert({
      share_id: input.shareId,
      author_id: session.deviceId,
      ciphertext: toBytea(fromB64u(envelope.ciphertext)),
      iv: toBytea(fromB64u(envelope.iv)),
      encrypted_keys: envelope.encryptedKeys,
    })
    .select('id')
    .single()
  if (error || !data) throw error ?? new Error('failed to insert annotation')
  return { annotationId: data.id as string }
}

// ── Deactivation ─────────────────────────────────────────────────────────────
//
// Called by the "Online-Teilen deaktivieren" button. Removes all server-side
// data for this device (cascaded) + local private key. Local offline answers
// are untouched.

export async function deactivateOnlineSharing(): Promise<void> {
  const supabase = getSupabaseClient()
  const { data: session } = await supabase.auth.getSession()
  const deviceId = session.session?.user?.id
  if (deviceId) {
    // Owner rows cascade-delete (shares → share_recipients, annotations, media).
    // Annotations authored by this device on other people's shares are also
    // FK-cascade-deleted via author_id.
    await supabase.from('devices').delete().eq('id', deviceId)
  }
  await supabase.auth.signOut().catch(() => {})
  await clearDeviceKey()
  resetSupabaseClient()
  _session = null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// PostgREST expects bytea columns as "\xHEX" strings in JSON payloads.
// JSON.stringify(Uint8Array) produces {"0":1,...} which PostgreSQL rejects.
function toBytea(bytes: Uint8Array): string {
  let hex = '\\x'
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return hex
}

function coerceBytes(val: unknown): Uint8Array {
  if (val instanceof Uint8Array) return val
  if (typeof val === 'string') {
    // Postgres bytea over the REST API comes back as a "\x…"-hex string.
    if (val.startsWith('\\x')) {
      const hex = val.slice(2)
      const out = new Uint8Array(hex.length / 2)
      for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
      return out
    }
    return fromB64u(val)
  }
  if (val && typeof val === 'object' && 'data' in (val as { data: unknown })) {
    return new Uint8Array((val as { data: number[] }).data)
  }
  throw new Error('unexpected bytea representation')
}

function normalizePublicKey(val: unknown): string | null {
  try {
    const bytes = coerceBytes(val)
    return toB64u(bytes)
  } catch {
    return null
  }
}

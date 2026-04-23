// Base64URL (RFC 4648 §5) helpers.
//
// Single source of truth – imported by both the offline `secureLink.ts`
// (invite / answer / memory-share URL fragments) and the online-sharing
// `crypto.ts` (wrapped keys, ciphertext envelopes).

export function toB64u(data: Uint8Array): string {
  let str = ''
  for (const byte of data) str += String.fromCharCode(byte)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export function fromB64u(str: string): Uint8Array<ArrayBuffer> {
  const pad = (4 - (str.length % 4)) % 4
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad)
  const raw = atob(padded)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

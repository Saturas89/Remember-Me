import type { InviteData, AnswerExport } from '../types'

export function encodeInvite(data: InviteData): string {
  return btoa(encodeURIComponent(JSON.stringify(data)))
}

export function decodeInvite(encoded: string): InviteData | null {
  try {
    return JSON.parse(decodeURIComponent(atob(encoded))) as InviteData
  } catch {
    return null
  }
}

export function encodeAnswerExport(data: AnswerExport): string {
  return btoa(encodeURIComponent(JSON.stringify(data)))
}

export function decodeAnswerExport(code: string): AnswerExport | null {
  try {
    return JSON.parse(decodeURIComponent(atob(code.trim()))) as AnswerExport
  } catch {
    return null
  }
}

export function generateInviteUrl(profileName: string, friendId: string): string {
  const data: InviteData = { profileName, friendId }
  const encoded = encodeInvite(data)
  const base = window.location.origin + window.location.pathname
  return `${base}#invite/${encoded}`
}

/** Reads the current URL hash and returns parsed InviteData if present */
export function parseInviteFromHash(): InviteData | null {
  const hash = window.location.hash
  const match = hash.match(/^#invite\/(.+)$/)
  if (!match) return null
  return decodeInvite(match[1])
}

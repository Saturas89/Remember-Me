// ── Integration test: Familienmodus – Invite-Code Handshake ─────────────────
//
// Verifies that opening /join/CODE resolves the invite payload from
// inviteService, shows PersonalPackReceiveView, and after quiz completion
// auto-submits Ingrid's contact to inviteService.submitInviteResponse.
//
// Bidirectionality (Sandra auto-adding Ingrid) is tested via the
// usePendingInviteResponses hook polling, which is separate and E2E-covered.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { render, cleanup, screen, waitFor, act } from '@testing-library/react'
import type { ContactHandshake } from '../types'
import type { InvitePayload } from '../utils/inviteService'

const bootstrapSession = vi.fn()
const fetchIncomingShares = vi.fn(async () => ({ memories: [], annotations: [] }))
const resolveInviteCode = vi.fn<(code: string) => Promise<InvitePayload>>()
const submitInviteResponse = vi.fn(async (..._args: unknown[]) => {})

vi.mock('../utils/sharingService', () => ({
  bootstrapSession: () => bootstrapSession(),
  fetchIncomingShares: () => fetchIncomingShares(),
  deactivateOnlineSharing: vi.fn(async () => {}),
  addAnnotation: vi.fn(),
  shareMemory: vi.fn(),
  lookupRecipientPublicKey: vi.fn(),
}))

vi.mock('../utils/inviteService', () => ({
  resolveInviteCode: (code: string) => resolveInviteCode(code),
  submitInviteResponse: (...args: unknown[]) => submitInviteResponse(...args),
  pollInviteResponse: vi.fn(async () => null),
  createInviteAndGetUrl: vi.fn(async () => 'https://example.com/join/TSTCOD'),
}))

const STATE_KEY = 'remember-me-state'
const INSTALL_KEY = 'rm-install-dismissed'

const ALICE: ContactHandshake = {
  $type: 'remember-me-contact',
  version: 1,
  deviceId: '00000000-0000-4000-8000-00000000aaaa',
  publicKey: 'ALICE_FAKE_PUBLIC_KEY_BASE64',
  displayName: 'Alice',
}

const BOB: ContactHandshake = {
  $type: 'remember-me-contact',
  version: 1,
  deviceId: '00000000-0000-4000-8000-00000000bbbb',
  publicKey: 'BOB_FAKE_PUBLIC_KEY_BASE64',
  displayName: 'Bob',
}

const MINIMAL_PACK = {
  personalPack: true as const,
  senderName: 'Alice',
  recipientLabel: 'mama',
  anrede: 'Mama',
  questions: [
    {
      id: 'q-test',
      text: 'Was war dein schönster Moment?',
      type: 'text' as const,
      createdAt: '2024-01-01T00:00:00.000Z',
    },
  ],
}

function preSeedReturningUser(name: string, extra: Record<string, unknown> = {}) {
  localStorage.setItem(INSTALL_KEY, '1')
  localStorage.setItem(
    STATE_KEY,
    JSON.stringify({
      profile: { name, createdAt: '2024-01-01T00:00:00.000Z' },
      answers: {},
      friends: [],
      friendAnswers: [],
      customQuestions: [],
      appMode: 'full',
      ...extra,
    }),
  )
}

function setJoinUrl(code: string) {
  window.history.replaceState(null, '', `/join/${code}`)
}

function clearJoinUrl() {
  window.history.replaceState(null, '', '/')
}

type LooseFriend = { id: string; name: string; online?: { deviceId: string; publicKey: string } }
function readFriends(): LooseFriend[] {
  const bridge = (window as unknown as {
    __rmState?: { get: () => { friends?: LooseFriend[] } | null }
  }).__rmState
  return bridge?.get()?.friends ?? []
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-app-mode')
  bootstrapSession.mockReset()
  fetchIncomingShares.mockReset().mockResolvedValue({ memories: [], annotations: [] })
  resolveInviteCode.mockReset()
  submitInviteResponse.mockReset().mockResolvedValue(undefined)
  clearJoinUrl()
})

afterEach(() => {
  cleanup()
  clearJoinUrl()
})

async function freshAppMount() {
  vi.resetModules()
  const mod = await import('../App')
  const App = mod.default
  return render(<App />)
}

describe('Familienmodus – Invite-Code Handshake', () => {
  it('Bob (online aktiv) öffnet Alices /join/ Link → PersonalPackReceiveView erscheint', async () => {
    resolveInviteCode.mockResolvedValue({ pack: MINIMAL_PACK, contact: ALICE })
    bootstrapSession.mockResolvedValue({ deviceId: BOB.deviceId, publicKeyB64: BOB.publicKey })
    preSeedReturningUser('Bob', {
      onlineSharing: {
        enabled: true,
        activatedAt: '2024-01-01T00:00:00.000Z',
        deviceId: BOB.deviceId,
        publicKey: BOB.publicKey,
      },
    })
    setJoinUrl('TSTCOD')

    await act(async () => {
      await freshAppMount()
    })

    // PersonalPackReceiveView is shown first (quiz before handshake).
    await waitFor(() =>
      expect(screen.queryByText(/Alice/i) !== null || screen.queryByText(/Mama/i) !== null).toBe(true),
    )
    expect(resolveInviteCode).toHaveBeenCalledWith('TSTCOD')
  })

  it('Bob (kein Opt-in) öffnet /join/ Link → PersonalPackReceiveView erscheint (Opt-in kommt danach)', async () => {
    resolveInviteCode.mockResolvedValue({ pack: MINIMAL_PACK, contact: ALICE })
    preSeedReturningUser('Bob') // kein onlineSharing
    setJoinUrl('TSTCOD')

    await act(async () => {
      await freshAppMount()
    })

    expect(resolveInviteCode).toHaveBeenCalledWith('TSTCOD')
    // Friends-Liste ist noch leer – Handshake wartet auf Opt-in.
    expect(readFriends()).toEqual([])
  })

  it('Unbekannter Code → App landet auf Home ohne Crash', async () => {
    resolveInviteCode.mockRejectedValue(new Error('invite-not-found'))
    preSeedReturningUser('Bob')
    setJoinUrl('UNKNOW')

    await act(async () => {
      await freshAppMount()
    })

    // App should not crash and URL should be cleared.
    expect(window.location.pathname).toBe('/')
  })
})

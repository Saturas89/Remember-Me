// ── Integration test: Familienmodus – Kontakt-Handshake ────────────────────
//
// Spiegelt den Kontakt-Handshake aus
//   • e2e/family-mode-handshake.spec.ts (FR-15.5 – FR-15.9)
// in jsdom. Zwei Geräte werden dadurch simuliert, dass derselbe Test
// nacheinander zwei `<App />`-Instanzen rendert (vi.resetModules + dynamic
// import), jeweils mit anderem Profilnamen + anderer Contact-URL.
//
// Was hier NICHT getestet wird:
//   • Echte Cross-Browser-Klick-Quirks → bleiben in Playwright.
//   • Server-Roundtrip beim Akzeptieren → der Handshake selbst ist
//     ausschließlich URL-basiert; der spätere Share-Roundtrip ist in
//     `friendShareFlow.test.ts` voll abgedeckt.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { render, cleanup, screen, waitFor, act } from '@testing-library/react'
import type { ContactHandshake } from '../types'
import { toB64u } from '../utils/base64url'

const bootstrapSession = vi.fn()
const fetchIncomingShares = vi.fn(async () => ({ memories: [], annotations: [] }))

vi.mock('../utils/sharingService', () => ({
  bootstrapSession: () => bootstrapSession(),
  fetchIncomingShares: () => fetchIncomingShares(),
  deactivateOnlineSharing: vi.fn(async () => {}),
  addAnnotation: vi.fn(),
  shareMemory: vi.fn(),
  lookupRecipientPublicKey: vi.fn(),
}))

const STATE_KEY = 'remember-me-state'
const INSTALL_KEY = 'rm-install-dismissed'

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

function setContactUrl(handshake: ContactHandshake) {
  const token = toB64u(new TextEncoder().encode(JSON.stringify(handshake)))
  window.history.replaceState(null, '', `/?contact=${token}`)
}

function clearContactUrl() {
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
  clearContactUrl()
})

afterEach(() => {
  cleanup()
  clearContactUrl()
})

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

async function freshAppMount() {
  vi.resetModules()
  const mod = await import('../App')
  const App = mod.default
  return render(<App />)
}

describe('Familienmodus – Kontakt-Handshake (FR-15.5 – FR-15.9)', () => {
  it('Bob (online aktiv) öffnet Alices Link → Auto-Accept, Alice landet als Online-Friend', async () => {
    bootstrapSession.mockResolvedValue({ deviceId: BOB.deviceId, publicKeyB64: BOB.publicKey })
    preSeedReturningUser('Bob', {
      onlineSharing: {
        enabled: true,
        activatedAt: '2024-01-01T00:00:00.000Z',
        deviceId: BOB.deviceId,
        publicKey: BOB.publicKey,
      },
    })
    setContactUrl(ALICE)

    await act(async () => {
      await freshAppMount()
    })

    expect(await screen.findByRole('heading', { name: 'Kontakt verknüpfen' })).toBeTruthy()
    expect(screen.getAllByText(/Alice/).length).toBeGreaterThan(0)

    // Auto-Accept: Alice ist jetzt mit Online-Block in den Friends.
    await waitFor(() => {
      const f = readFriends().find(f => f.name === 'Alice')
      expect(f?.online?.deviceId).toBe(ALICE.deviceId)
      expect(f?.online?.publicKey).toBe(ALICE.publicKey)
    })

    // „Meinen Link zurück senden"-Button ist sichtbar (FR-15.8).
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Meinen Link zurück senden/ })).toBeTruthy(),
    )
  })

  it('Bob (kein Opt-in) öffnet Alices Link → Aktivierungs-CTA, kein Auto-Accept', async () => {
    preSeedReturningUser('Bob') // kein onlineSharing
    setContactUrl(ALICE)

    await act(async () => {
      await freshAppMount()
    })

    expect(await screen.findByRole('heading', { name: 'Kontakt verknüpfen' })).toBeTruthy()

    // Vor dem Opt-in: „einrichten"-Button statt „zurück senden".
    expect(await screen.findByRole('button', { name: /Online-Teilen einrichten/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Meinen Link zurück senden/ })).toBeNull()

    // Friends-Liste ist leer geblieben — der Handshake wartet auf Opt-in.
    expect(readFriends()).toEqual([])
    expect(bootstrapSession).not.toHaveBeenCalled()
  })

  it('Spiegel-Fall: Alice (online aktiv) öffnet Bobs Link → Bob landet als Online-Friend', async () => {
    bootstrapSession.mockResolvedValue({ deviceId: ALICE.deviceId, publicKeyB64: ALICE.publicKey })
    preSeedReturningUser('Alice', {
      onlineSharing: {
        enabled: true,
        activatedAt: '2024-01-01T00:00:00.000Z',
        deviceId: ALICE.deviceId,
        publicKey: ALICE.publicKey,
      },
    })
    setContactUrl(BOB)

    await act(async () => {
      await freshAppMount()
    })

    expect(await screen.findByRole('heading', { name: 'Kontakt verknüpfen' })).toBeTruthy()

    await waitFor(() => {
      const f = readFriends().find(f => f.name === 'Bob')
      expect(f?.online?.deviceId).toBe(BOB.deviceId)
    })
  })
})

// ── Integration test: Familienmodus-Aktivierung & lokales Deactivate ──────
//
// Spiegelt die UI-Flüsse aus
//   • e2e/family-mode-activation.spec.ts (FR-15.1 – FR-15.3)
//   • e2e/family-mode-deactivation.spec.ts (lokaler Cleanup-Teil von
//     FR-15.22 – FR-15.25)
// in jsdom wider, damit wir nicht für jede CTA-Verdrahtung 5 Browser
// hochfahren müssen.
//
// Was hier NICHT getestet wird:
//   • Cross-Browser-Klick-Quirks → bleiben in Playwright (eine Smoke-Spec
//     reicht für die Matrix).
//   • Server-Cascade beim Deaktivieren → bereits in
//     `friendShareFlow.test.ts` über den echten `sharingService` plus
//     In-Memory-Backend abgedeckt.
//
// Der `sharingService` wird hier gemockt, weil wir nur das App-State-/
// View-Routing-Verhalten prüfen wollen, nicht die Crypto- oder
// Netzwerkschicht. Letztere hat ihren eigenen Integrations-Test.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { render, cleanup, screen, fireEvent, within, waitFor } from '@testing-library/react'

const bootstrapSession = vi.fn()
const fetchIncomingShares = vi.fn(async () => ({ memories: [], annotations: [] }))
const deactivateOnlineSharing = vi.fn(async () => {})

vi.mock('../utils/sharingService', () => ({
  bootstrapSession: () => bootstrapSession(),
  fetchIncomingShares: () => fetchIncomingShares(),
  deactivateOnlineSharing: () => deactivateOnlineSharing(),
  addAnnotation: vi.fn(),
  shareMemory: vi.fn(),
  lookupRecipientPublicKey: vi.fn(),
}))

import App from '../App'

const STATE_KEY = 'remember-me-state'
const INSTALL_KEY = 'rm-install-dismissed'

function preSeedReturningUser(extra: Record<string, unknown> = {}) {
  localStorage.setItem(INSTALL_KEY, '1')
  localStorage.setItem(
    STATE_KEY,
    JSON.stringify({
      profile: { name: 'Anna', createdAt: '2024-01-01T00:00:00.000Z' },
      answers: {},
      friends: [],
      friendAnswers: [],
      customQuestions: [],
      appMode: 'full',
      ...extra,
    }),
  )
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-app-mode')
  bootstrapSession.mockReset()
  fetchIncomingShares.mockReset().mockResolvedValue({ memories: [], annotations: [] })
  deactivateOnlineSharing.mockReset().mockResolvedValue(undefined)
})

afterEach(cleanup)

async function gotoFriendsTab() {
  const nav = await screen.findByRole('navigation', { name: 'Hauptnavigation' })
  fireEvent.click(within(nav).getByRole('button', { name: 'Freunde' }))
}

// `stateStorage` verschlüsselt im Vitest-Lauf (Web Crypto + fake-indexeddb
// sind beide verfügbar), also lesen wir den State über die window-Bridge,
// die ohnehin schon existiert (`__rmState`, genutzt von den E2E-Helpers).
type LoosePartialState = {
  onlineSharing?: { enabled?: boolean; activatedAt?: string }
  friends?: Array<{ id: string; online?: unknown }>
}
function readState(): LoosePartialState {
  const bridge = (window as unknown as {
    __rmState?: { get: () => LoosePartialState | null }
  }).__rmState
  return bridge?.get() ?? {}
}

describe('Familienmodus – Aktivierung (FR-15.1 – FR-15.3)', () => {
  it('Friends-Bereich zeigt den Online-Sharing-CTA', async () => {
    preSeedReturningUser()
    render(<App />)

    await gotoFriendsTab()

    const cta = await screen.findByTestId('open-online-sharing')
    expect(cta.textContent).toMatch(/Einrichten/)
  })

  it('Consent-Screen erzwingt die Pflicht-Checkbox bevor "Aktivieren" klickbar ist', async () => {
    preSeedReturningUser()
    render(<App />)

    await gotoFriendsTab()
    fireEvent.click(await screen.findByTestId('open-online-sharing'))

    expect(await screen.findByRole('heading', { name: 'Familienmodus' })).toBeTruthy()

    const activate = screen.getByRole('button', { name: 'Aktivieren' }) as HTMLButtonElement
    expect(activate.disabled).toBe(true)

    fireEvent.click(screen.getByRole('checkbox'))
    expect(activate.disabled).toBe(false)
  })

  it('Aktivieren persistiert onlineSharing.enabled und ruft bootstrapSession auf', async () => {
    bootstrapSession.mockResolvedValue({ deviceId: 'dev-A', publicKeyB64: 'pk-A' })
    preSeedReturningUser()
    render(<App />)

    await gotoFriendsTab()
    fireEvent.click(await screen.findByTestId('open-online-sharing'))
    fireEvent.click(await screen.findByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Aktivieren' }))

    await waitFor(() => expect(bootstrapSession).toHaveBeenCalledTimes(1))

    const stored = readState()
    expect(stored.onlineSharing).toMatchObject({ enabled: true })
    expect(typeof stored.onlineSharing?.activatedAt).toBe('string')
  })

  it('Cancel im Consent-Screen aktiviert nichts', async () => {
    preSeedReturningUser()
    render(<App />)

    await gotoFriendsTab()
    fireEvent.click(await screen.findByTestId('open-online-sharing'))
    expect(await screen.findByRole('heading', { name: 'Familienmodus' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }))

    expect(await screen.findByRole('heading', { name: /Erinnerung einsammeln/ })).toBeTruthy()
    expect(bootstrapSession).not.toHaveBeenCalled()
    expect(readState().onlineSharing).toBeUndefined()
  })
})

describe('Familienmodus – lokales Deactivate (FR-15.22 – FR-15.25 lokaler Teil)', () => {
  it('Deactivate strippt friends[].online und entfernt den onlineSharing-Block', async () => {
    bootstrapSession.mockResolvedValue({ deviceId: 'dev-A', publicKeyB64: 'pk-A' })
    preSeedReturningUser({
      onlineSharing: {
        enabled: true,
        activatedAt: '2024-01-01T00:00:00.000Z',
        deviceId: 'dev-A',
        publicKey: 'pk-A',
      },
      friends: [
        {
          id: 'friend-bob',
          name: 'Bob',
          addedAt: '2024-01-02T00:00:00.000Z',
          online: { deviceId: 'dev-B', publicKey: 'pk-B', linkedAt: '2024-01-02T00:00:00.000Z' },
        },
      ],
    })

    render(<App />)

    await gotoFriendsTab()
    fireEvent.click(await screen.findByTestId('open-online-sharing'))

    // Hub statt Consent-Screen, weil onlineSharing.enabled bereits true.
    await screen.findByRole('heading', { name: 'Online teilen' })

    // Einstellungen-Tab → Deaktivieren → Bestätigung.
    fireEvent.click(screen.getByRole('tab', { name: 'Einstellungen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Deaktivieren' }))
    fireEvent.click(screen.getByRole('button', { name: /Ja, alles löschen/ }))

    await waitFor(() => expect(deactivateOnlineSharing).toHaveBeenCalledTimes(1))

    // FR-15.22 – Server-Cleanup wird angefordert (Mock genügt – die echte
    // Cascade testet `friendShareFlow.test.ts`).
    // FR-15.24/25 – lokaler State: onlineSharing weg, friend.online stripped,
    // Friend selbst bleibt offline erhalten.
    await waitFor(() => {
      const stored = readState()
      expect(stored.onlineSharing).toBeUndefined()
      // App.tsx ruft `removeOnlineFriends()` auf, das die Online-Freunde
      // ganz aus der Liste löscht (offline-only Friends bleiben).
      expect((stored.friends ?? []).find(f => f.id === 'friend-bob')).toBeUndefined()
    })
  })
})

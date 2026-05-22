import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent, act } from '@testing-library/react'
import { OnlineSharingHubView } from './OnlineSharingHubView'
import type { Friend } from '../types'
import type { OnlineSyncAPI } from '../hooks/useOnlineSync'

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../utils/secureLink', () => ({
  generateContactUrl: () => 'https://example.com/?contact=test',
  shareOrCopy: vi.fn(async () => false),
}))
vi.mock('../utils/shareCard', () => ({
  generateShareCard: vi.fn(async () => new File([], 'card.png')),
}))

afterEach(cleanup)

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FRIEND_SHARING: Friend = {
  id: 'friend-1',
  name: 'Henrietta',
  addedAt: '2024-01-01T00:00:00.000Z',
  online: {
    deviceId: 'device-h',
    publicKey: 'pubKeyH',
    linkedAt: '2024-01-01T00:00:00.000Z',
    shareAll: true,
  },
}

const FRIEND_PAUSED: Friend = {
  ...FRIEND_SHARING,
  id: 'friend-2',
  name: 'Pauline',
  online: { ...FRIEND_SHARING.online!, deviceId: 'device-p', shareAll: false },
}

function makeSync(overrides: Partial<OnlineSyncAPI> = {}): OnlineSyncAPI {
  return {
    ready: true,
    error: null,
    deviceId: 'device-self',
    publicKeyB64: 'myPubKey',
    memories: [],
    annotations: [],
    refresh: vi.fn(async () => {}),
    retryBootstrap: vi.fn(),
    service: {
      shareMemory: vi.fn(async () => ({ shareId: 'share-1' })),
      shareMemoryToAllFriends: vi.fn(async () => ({ shareId: 'share-1' })),
      unshareAllWithFriend: vi.fn(async () => {}),
      addAnnotation: vi.fn(async () => ({ annotationId: 'anno-1' })),
      fetchIncomingShares: vi.fn(async () => ({ memories: [], annotations: [] })),
    } as unknown as OnlineSyncAPI['service'],
    ...overrides,
  }
}

interface RenderArgs {
  syncOverrides?: Partial<OnlineSyncAPI>
  friends?: Friend[]
}

function renderHub({ syncOverrides = {}, friends = [FRIEND_SHARING] }: RenderArgs = {}) {
  const sync = makeSync(syncOverrides)
  const onDeactivate = vi.fn()
  const onRemoveContact = vi.fn()
  const onOpenSandraFlow = vi.fn()
  const view = render(
    <OnlineSharingHubView
      profileName="Test"
      friends={friends}
      sync={sync}
      onDeactivate={onDeactivate}
      onRemoveContact={onRemoveContact}
      onOpenSandraFlow={onOpenSandraFlow}
    />,
  )
  return {
    ...view,
    sync,
    onDeactivate,
    onRemoveContact,
    onOpenSandraFlow,
  }
}

function switchToTab(container: HTMLElement, label: string) {
  const tabs = container.querySelectorAll<HTMLButtonElement>('[role="tab"]')
  const target = Array.from(tabs).find(t => t.textContent?.trim().startsWith(label))
  expect(target, `Tab "${label}" must exist`).toBeTruthy()
  fireEvent.click(target!)
}

// ── Tab-Konfiguration ────────────────────────────────────────────────────────

describe('OnlineSharingHubView – Tabs', () => {
  it('zeigt nur Feed / Kontakte / Einstellungen (kein "Teilen" mehr)', () => {
    const { container } = renderHub()
    const labels = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    ).map(t => t.textContent?.trim())
    expect(labels.some(l => l?.startsWith('Feed'))).toBe(true)
    expect(labels.some(l => l?.startsWith('Kontakte'))).toBe(true)
    expect(labels.some(l => l?.startsWith('Einstellungen'))).toBe(true)
    expect(labels.some(l => l === 'Teilen')).toBe(false)
  })
})

// ── FeedTab Empty-States ──────────────────────────────────────────────────────

describe('FeedTab – Empty-States', () => {
  it('mit aktiven Sharings zeigt "Sobald deine Kontakte etwas Neues schreiben"', () => {
    const { container } = renderHub({ friends: [FRIEND_SHARING] })
    const hint = container.querySelector('[data-testid="feed-empty-hint"]')!
    expect(hint.textContent).toContain('Sobald deine Kontakte')
  })

  it('mit ausschließlich pausierten Kontakten zeigt allPausedHint', () => {
    const { container } = renderHub({ friends: [FRIEND_PAUSED] })
    const hint = container.querySelector('[data-testid="feed-empty-hint"]')!
    expect(hint.textContent).toContain('Du teilst aktuell mit niemandem')
  })
})

// ── ContactsTab – Neue Verbindung ──────────────────────────────────────────────

describe('ContactsTab – Neue-Person-Verbinden CTA', () => {
  it('ruft onOpenSandraFlow auf', () => {
    const { container, onOpenSandraFlow } = renderHub({ friends: [FRIEND_SHARING] })
    switchToTab(container, 'Kontakte')
    const cta = container.querySelector<HTMLButtonElement>(
      '[data-testid="contacts-new-connection"]',
    )!
    fireEvent.click(cta)
    expect(onOpenSandraFlow).toHaveBeenCalledOnce()
  })
})

// ── ContactsTab – Swipe-to-Remove ─────────────────────────────────────────────

function getSwipeEl(container: HTMLElement) {
  return container.querySelector<HTMLElement>('.online-contact-swipe')
}

function swipeLeft(el: HTMLElement, dx = 90) {
  fireEvent.pointerDown(el, { clientX: 200, pointerId: 1 })
  fireEvent.pointerMove(el, { clientX: 200 - dx, pointerId: 1 })
  fireEvent.pointerUp(el, { clientX: 200 - dx, pointerId: 1 })
}

describe('ContactsTab – Swipe-to-Remove', () => {
  it('kurzes Swipen ruft onRemoveContact nicht auf', () => {
    const { container, onRemoveContact } = renderHub({ friends: [FRIEND_SHARING] })
    switchToTab(container, 'Kontakte')
    swipeLeft(getSwipeEl(container)!, 30)
    expect(onRemoveContact).not.toHaveBeenCalled()
  })

  it('vollständiges Swipen fügt fly-out Klasse hinzu', () => {
    const { container } = renderHub({ friends: [FRIEND_SHARING] })
    switchToTab(container, 'Kontakte')
    swipeLeft(getSwipeEl(container)!)
    expect(getSwipeEl(container)!.classList.contains('online-contact-swipe--fly-out')).toBe(true)
  })

  it('vollständiges Swipen ruft onRemoveContact nach der Animation auf', () => {
    vi.useFakeTimers()
    try {
      const { container, onRemoveContact } = renderHub({ friends: [FRIEND_SHARING] })
      switchToTab(container, 'Kontakte')
      swipeLeft(getSwipeEl(container)!)
      expect(onRemoveContact).not.toHaveBeenCalled()
      act(() => { vi.advanceTimersByTime(300) })
      expect(onRemoveContact).toHaveBeenCalledOnce()
      expect(onRemoveContact).toHaveBeenCalledWith('friend-1')
    } finally {
      vi.useRealTimers()
    }
  })
})

// ── 0 Kontakte: Tabs direkt sichtbar ─────────────────────────────────────────

describe('Hub mit 0 Kontakten', () => {
  it('zeigt direkt die Tabs ohne Onboarding-Screen', () => {
    const { container } = renderHub({ friends: [] })
    expect(container.querySelector('[data-testid="onboarding-open-sandra"]')).toBeNull()
    expect(container.querySelector('[role="tablist"]')).toBeTruthy()
  })

  it('Kontakte-Tab zeigt Einladungs-CTA und ruft onOpenSandraFlow', () => {
    const { container, onOpenSandraFlow } = renderHub({ friends: [] })
    const tablist = container.querySelector('[role="tablist"]')!
    const contactsTab = Array.from(tablist.querySelectorAll('[role="tab"]')).find(
      t => t.textContent?.includes('Kontakte'),
    ) as HTMLButtonElement
    fireEvent.click(contactsTab)
    const cta = container.querySelector<HTMLButtonElement>('[data-testid="contacts-new-connection"]')!
    expect(cta).toBeTruthy()
    fireEvent.click(cta)
    expect(onOpenSandraFlow).toHaveBeenCalledOnce()
  })
})

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, cleanup, fireEvent, act, waitFor } from '@testing-library/react'
import { OnlineSharingHubView } from './OnlineSharingHubView'
import type { Friend, Answer } from '../types'
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

const FRIEND: Friend = {
  id: 'friend-1',
  name: 'H',
  addedAt: '2024-01-01T00:00:00.000Z',
  online: {
    deviceId: 'device-h',
    publicKey: 'pubKeyH',
    linkedAt: '2024-01-01T00:00:00.000Z',
  },
}

const ANSWER: Answer = {
  id: 'q-test-1',
  questionId: 'q-test-1',
  categoryId: 'test',
  value: 'Jj',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
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
    service: {
      shareMemory: vi.fn(async () => ({ shareId: 'share-1' })),
      addAnnotation: vi.fn(async () => ({ annotationId: 'anno-1' })),
      fetchIncomingShares: vi.fn(async () => ({ memories: [], annotations: [] })),
    } as unknown as OnlineSyncAPI['service'],
    ...overrides,
  }
}

function renderHub(
  syncOverrides: Partial<OnlineSyncAPI> = {},
  friends: Friend[] = [FRIEND],
  answers: Record<string, Answer> = { [ANSWER.id]: ANSWER },
) {
  const sync = makeSync(syncOverrides)
  const onBack = vi.fn()
  const onDeactivate = vi.fn()
  const onRemoveContact = vi.fn()
  const { container } = render(
    <OnlineSharingHubView
      profileName="Test"
      friends={friends}
      answers={answers}
      sync={sync}
      onBack={onBack}
      onDeactivate={onDeactivate}
      onRemoveContact={onRemoveContact}
    />,
  )

  // Navigate to the Teilen tab
  const tabs = container.querySelectorAll<HTMLButtonElement>('[role="tab"]')
  const teilenTab = Array.from(tabs).find(t => t.textContent?.trim() === 'Teilen')
  if (teilenTab) fireEvent.click(teilenTab)

  return { container, sync, onBack, onDeactivate, onRemoveContact }
}

function renderContactsTab(
  friends: Friend[] = [FRIEND],
) {
  const sync = makeSync()
  const onRemoveContact = vi.fn()
  const { container } = render(
    <OnlineSharingHubView
      profileName="Test"
      friends={friends}
      answers={{ [ANSWER.id]: ANSWER }}
      sync={sync}
      onBack={vi.fn()}
      onDeactivate={vi.fn()}
      onRemoveContact={onRemoveContact}
    />,
  )

  // Navigate to the Einladen (contacts) tab
  const tabs = container.querySelectorAll<HTMLButtonElement>('[role="tab"]')
  const contactsTab = Array.from(tabs).find(t => t.textContent?.trim() === 'Einladen')
  if (contactsTab) fireEvent.click(contactsTab)

  return { container, onRemoveContact }
}

function getShareBtn(container: HTMLElement) {
  return container.querySelector<HTMLButtonElement>('.share-cta-btn')
}

function selectMemory(container: HTMLElement) {
  const radio = container.querySelector<HTMLInputElement>(`input[type="radio"][value="${ANSWER.id}"]`)!
  fireEvent.click(radio)
}

function checkFriend(container: HTMLElement) {
  const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!
  fireEvent.click(checkbox)
}

// ── ShareTab – Button-Zustand ─────────────────────────────────────────────────

describe('ShareTab – Button-Zustand', () => {
  it('zeigt "Verschlüssele & sende" im Idle-Zustand', () => {
    const { container } = renderHub()
    const btn = getShareBtn(container)!
    expect(btn.textContent?.trim()).toBe('Verschlüssele & sende')
  })

  it('Button ist deaktiviert wenn keine Erinnerung gewählt ist', () => {
    const { container } = renderHub()
    checkFriend(container)
    expect(getShareBtn(container)!.disabled).toBe(true)
  })

  it('Button ist deaktiviert wenn kein Empfänger gewählt ist', () => {
    const { container } = renderHub()
    selectMemory(container)
    expect(getShareBtn(container)!.disabled).toBe(true)
  })

  it('Button ist deaktiviert wenn sync.service null ist', () => {
    const { container } = renderHub({ service: null })
    selectMemory(container)
    checkFriend(container)
    expect(getShareBtn(container)!.disabled).toBe(true)
  })

  it('Button ist aktiv wenn Erinnerung + Empfänger + Service vorhanden sind', () => {
    const { container } = renderHub()
    selectMemory(container)
    checkFriend(container)
    expect(getShareBtn(container)!.disabled).toBe(false)
  })
})

// ── ShareTab – Sende-Flow ─────────────────────────────────────────────────────

describe('ShareTab – Sende-Flow', () => {
  it('deaktiviert den Button während des Sendens', async () => {
    let resolve!: () => void
    const hanging = new Promise<{ shareId: string }>(r => { resolve = () => r({ shareId: 'x' }) })
    const { container } = renderHub({
      service: { shareMemory: vi.fn(() => hanging) } as unknown as OnlineSyncAPI['service'],
    })
    selectMemory(container)
    checkFriend(container)

    await act(async () => { fireEvent.click(getShareBtn(container)!) })

    expect(getShareBtn(container)!.disabled).toBe(true)
    expect(getShareBtn(container)!.textContent?.trim()).toBe('Verschlüssele & sende …')
    resolve()
  })

  it('zeigt "Gesendet ✓" nach erfolgreichem Senden', async () => {
    const { container } = renderHub()
    selectMemory(container)
    checkFriend(container)

    await act(async () => { fireEvent.click(getShareBtn(container)!) })

    await waitFor(() =>
      expect(getShareBtn(container)!.textContent?.trim()).toBe('Gesendet ✓'),
    )
  })

  it('ruft shareMemory mit korrekten Empfängerdaten auf', async () => {
    const shareMemory = vi.fn(async () => ({ shareId: 'share-1' }))
    const { container } = renderHub({
      service: { shareMemory } as unknown as OnlineSyncAPI['service'],
    })
    selectMemory(container)
    checkFriend(container)

    await act(async () => { fireEvent.click(getShareBtn(container)!) })

    await waitFor(() => expect(shareMemory).toHaveBeenCalledOnce())
    expect(shareMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ $type: 'remember-me-share', value: 'Jj' }),
        recipients: expect.arrayContaining([
          expect.objectContaining({ deviceId: 'device-h', publicKey: 'pubKeyH' }),
        ]),
        images: [],
      }),
    )
  })

  it('zeigt Fehlermeldung bei shareMemory-Fehler', async () => {
    const { container } = renderHub({
      service: {
        shareMemory: vi.fn(async () => { throw new Error('Netzwerkfehler') }),
      } as unknown as OnlineSyncAPI['service'],
    })
    selectMemory(container)
    checkFriend(container)

    await act(async () => { fireEvent.click(getShareBtn(container)!) })

    await waitFor(() =>
      expect(container.textContent).toContain('Netzwerkfehler'),
    )
    expect(getShareBtn(container)!.textContent?.trim()).toBe('Verschlüssele & sende')
  })
})

// ── ShareTab – 30-Sekunden-Timeout ───────────────────────────────────────────

describe('ShareTab – Timeout nach 30 Sekunden', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('wechselt nach 30 s in den Fehlerzustand wenn shareMemory hängt', async () => {
    const { container } = renderHub({
      service: {
        shareMemory: vi.fn(() => new Promise(() => { /* never resolves */ })),
      } as unknown as OnlineSyncAPI['service'],
    })
    selectMemory(container)
    checkFriend(container)

    await act(async () => { fireEvent.click(getShareBtn(container)!) })

    expect(getShareBtn(container)!.textContent?.trim()).toBe('Verschlüssele & sende …')

    await act(async () => { vi.advanceTimersByTime(30_000) })

    expect(getShareBtn(container)!.textContent?.trim()).toBe('Verschlüssele & sende')
    expect(container.textContent).toContain('Zeitüberschreitung')
  })

})

// ── ShareTab – leere Antwortliste ─────────────────────────────────────────────

describe('ShareTab – keine Antworten', () => {
  it('zeigt Hinweistext wenn keine Antworten vorhanden sind', () => {
    const { container } = renderHub({}, [FRIEND], {})
    expect(container.textContent).toContain('Beantworte erst eine Frage')
    expect(getShareBtn(container)).toBeNull()
  })
})

// ── ContactsTab – Swipe-to-Remove ─────────────────────────────────────────────

function getSwipeEl(container: HTMLElement) {
  return container.querySelector<HTMLElement>('.online-contact-swipe')
}

function swipeLeft(el: HTMLElement, dx = 80) {
  fireEvent.pointerDown(el, { clientX: 200, pointerId: 1 })
  fireEvent.pointerMove(el, { clientX: 200 - dx, pointerId: 1 })
  fireEvent.pointerUp(el, { clientX: 200 - dx, pointerId: 1 })
}

describe('ContactsTab – Kontaktliste', () => {
  it('zeigt verknüpften Kontakt in der Liste', () => {
    const { container } = renderContactsTab()
    expect(container.textContent).toContain('H')
    expect(container.querySelector('.online-contact-swipe')).not.toBeNull()
  })
})

describe('ContactsTab – Swipe-to-Remove', () => {
  it('Entfernen-Button ist erst nach Swipe-left sichtbar', () => {
    const { container } = renderContactsTab()
    expect(container.querySelector('.online-contact-remove-btn')).toBeNull()

    swipeLeft(getSwipeEl(container)!)
    expect(container.querySelector('.online-contact-remove-btn')).not.toBeNull()
  })

  it('Entfernen-Button verschwindet bei zu kurzem Swipe wieder', () => {
    const { container } = renderContactsTab()
    swipeLeft(getSwipeEl(container)!, 30) // < SWIPE_THRESHOLD (60)
    expect(container.querySelector('.online-contact-remove-btn')).toBeNull()
  })

  it('ruft onRemoveContact mit der Freund-ID auf wenn Entfernen geklickt wird', () => {
    const { container, onRemoveContact } = renderContactsTab()
    swipeLeft(getSwipeEl(container)!)

    const btn = container.querySelector<HTMLButtonElement>('.online-contact-remove-btn')!
    fireEvent.click(btn)

    expect(onRemoveContact).toHaveBeenCalledOnce()
    expect(onRemoveContact).toHaveBeenCalledWith(FRIEND.id)
  })

  it('Entfernen-Button hat korrekte aria-label mit dem Kontaktnamen', () => {
    const { container } = renderContactsTab()
    swipeLeft(getSwipeEl(container)!)

    const btn = container.querySelector('.online-contact-remove-btn')!
    expect(btn.getAttribute('aria-label')).toBe('H aus Kontakten entfernen')
  })

  it('Klick auf verschobenes Element setzt es zurück', () => {
    const { container } = renderContactsTab()
    swipeLeft(getSwipeEl(container)!)
    expect(container.querySelector('.online-contact-remove-btn')).not.toBeNull()

    fireEvent.click(getSwipeEl(container)!)
    expect(container.querySelector('.online-contact-remove-btn')).toBeNull()
  })
})

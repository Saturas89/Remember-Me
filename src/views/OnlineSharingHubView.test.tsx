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
  const { container } = render(
    <OnlineSharingHubView
      profileName="Test"
      friends={friends}
      answers={answers}
      sync={sync}
      onBack={onBack}
      onDeactivate={onDeactivate}
    />,
  )

  // Navigate to the Teilen tab
  const tabs = container.querySelectorAll<HTMLButtonElement>('[role="tab"]')
  const teilenTab = Array.from(tabs).find(t => t.textContent?.trim() === 'Teilen')
  if (teilenTab) fireEvent.click(teilenTab)

  return { container, sync, onBack, onDeactivate }
}

function getShareBtn(container: HTMLElement) {
  return container.querySelector<HTMLButtonElement>('.share-cta-btn')
}

function selectMemory(container: HTMLElement) {
  const select = container.querySelector<HTMLSelectElement>('select')!
  fireEvent.change(select, { target: { value: ANSWER.id } })
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
      expect(getShareBtn(container)!.textContent?.trim()).toBe('Fehler – erneut versuchen'),
    )
    expect(container.textContent).toContain('Netzwerkfehler')
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

    expect(getShareBtn(container)!.textContent?.trim()).toBe('Fehler – erneut versuchen')
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

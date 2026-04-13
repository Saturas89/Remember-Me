import { describe, it, expect, vi, beforeEach } from 'vitest'
import { addAudio, getAudioBlob, removeAudio } from './useAudioStore'

// Mock IndexedDB
const mockStore = {
  put: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
}

const mockTransaction = {
  objectStore: vi.fn(() => mockStore),
}

const mockDB = {
  transaction: vi.fn(() => mockTransaction),
  close: vi.fn(),
}

// We need to mock the global indexedDB and crypto
const mockIDBRequest = {
  result: mockDB,
  onsuccess: null as any,
  onerror: null as any,
  onupgradeneeded: null as any,
}

describe('useAudioStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock crypto.randomUUID
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn().mockReturnValue('mocked-uuid')
    })

    // Mock indexedDB.open
    vi.stubGlobal('indexedDB', {
      open: vi.fn().mockReturnValue(mockIDBRequest),
    })

    // Trigger success for DB opening
    setTimeout(() => {
      if (mockIDBRequest.onsuccess) {
        mockIDBRequest.onsuccess({ target: mockIDBRequest })
      }
    }, 0)
  })

  it('addAudio generates an ID with crypto.randomUUID and stores the blob', async () => {
    const blob = new Blob(['test audio'], { type: 'audio/mpeg' })

    mockStore.put.mockReturnValue({ onsuccess: (cb: any) => cb(), onerror: null })

    const id = await addAudio(blob)

    expect(id).toMatch(/^aud-\d+-mocked-uuid$/)
    expect(crypto.randomUUID).toHaveBeenCalled()
    expect(mockStore.put).toHaveBeenCalledWith(blob, id)
  })

  it('getAudioBlob retrieves the blob by ID', async () => {
    const blob = new Blob(['test audio'], { type: 'audio/mpeg' })
    mockStore.get.mockReturnValue({ result: blob, onsuccess: (cb: any) => cb(), onerror: null })

    const result = await getAudioBlob('aud-mocked-uuid')

    expect(result).toBe(blob)
    expect(mockStore.get).toHaveBeenCalledWith('aud-mocked-uuid')
  })

  it('removeAudio deletes the blob by ID', async () => {
    mockStore.delete.mockReturnValue({ onsuccess: (cb: any) => cb(), onerror: null })

    await removeAudio('aud-mocked-uuid')

    expect(mockStore.delete).toHaveBeenCalledWith('aud-mocked-uuid')
  })
})

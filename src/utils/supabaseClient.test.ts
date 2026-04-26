import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchWithTimeout, SUPABASE_FETCH_TIMEOUT_MS } from './supabaseClient'

// ── fetchWithTimeout ──────────────────────────────────────────────────────────

describe('fetchWithTimeout', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('leitet erfolgreiche Antworten unverändert durch', async () => {
    const fakeResponse = new Response('ok', { status: 200 })
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse))

    const result = await fetchWithTimeout('https://example.com/api', {})
    expect(result.status).toBe(200)
  })

  it(`bricht nach ${SUPABASE_FETCH_TIMEOUT_MS / 1000} Sekunden ab`, async () => {
    vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) =>
      new Promise<Response>((_, reject) => {
        options.signal?.addEventListener('abort', () => {
          reject(new DOMException('The user aborted a request.', 'AbortError'))
        })
      }),
    ))

    const promise = fetchWithTimeout('https://example.com/api', {})

    await vi.advanceTimersByTimeAsync(SUPABASE_FETCH_TIMEOUT_MS - 1)
    // Sollte noch nicht abgebrochen sein
    let settled = false
    promise.catch(() => { settled = true })
    await Promise.resolve()
    expect(settled).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('räumt den Timer auf wenn fetch vor dem Timeout antwortet', async () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('ok')))

    await fetchWithTimeout('https://example.com/api', {})
    expect(clearSpy).toHaveBeenCalled()
  })

  it('räumt den Timer auf wenn fetch mit einem Fehler ablehnt', async () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout')
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network error') }))

    await expect(fetchWithTimeout('https://example.com/api', {})).rejects.toThrow('network error')
    expect(clearSpy).toHaveBeenCalled()
  })
})

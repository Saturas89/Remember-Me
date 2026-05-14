import type { BrowserContext } from '@playwright/test'
import type { MockState } from '../helpers/supabase-mock'

export interface FaultSpec {
  /** Substring of the request URL to match (e.g. '/rest/v1/shares'). */
  urlContains: string
  /** HTTP method to match or '*' for any. Default: '*'. */
  method?: string
  /** HTTP status code to return. Default: 503. */
  status?: number
  /** Response body. Default: { message: 'chaos: injected fault' }. */
  body?: unknown
  /**
   * How many times to inject this fault before passing through to the base
   * mock. Use a large number (e.g. 9999) for "always fail". Default: 1.
   */
  count?: number
  /**
   * Use route.abort() instead of route.fulfill() to simulate a hard
   * connection error (net::ERR_FAILED) rather than an HTTP error response.
   */
  abort?: boolean
}

export interface ActiveFault {
  spec: FaultSpec
  hits: number
}

/**
 * Installs a fault-injection overlay on a context that already has the
 * Supabase base mock installed. Because Playwright routes are LIFO, this
 * overlay fires first; it either injects a fault or calls route.fallback()
 * to pass the request through to the base mock handler.
 *
 * Call this AFTER spawnDevice() so the overlay sits above the base mock.
 */
export async function installFaultOverlay(
  context: BrowserContext,
  state: MockState,
  faults: FaultSpec[],
): Promise<ActiveFault[]> {
  const active: ActiveFault[] = faults.map(spec => ({ spec, hits: 0 }))

  await context.route(`http://${state.baseHost}/**`, async route => {
    const req = route.request()
    const url = req.url()
    const method = req.method().toUpperCase()

    for (const fault of active) {
      const limit = fault.spec.count ?? 1
      if (fault.hits >= limit) continue
      if (!url.includes(fault.spec.urlContains)) continue
      const wantMethod = (fault.spec.method ?? '*').toUpperCase()
      if (wantMethod !== '*' && wantMethod !== method) continue

      fault.hits++

      if (fault.spec.abort) {
        return route.abort('failed')
      }
      return route.fulfill({
        status: fault.spec.status ?? 503,
        contentType: 'application/json',
        body: JSON.stringify(fault.spec.body ?? { message: 'chaos: injected fault' }),
      })
    }

    return route.fallback()
  })

  return active
}

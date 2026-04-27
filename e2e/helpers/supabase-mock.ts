import type { BrowserContext, Route, Request as PWRequest } from '@playwright/test'

// ── In-memory Supabase fake ────────────────────────────────────────────────
//
// Just enough of the Supabase HTTP surface to drive the family-mode E2E
// flows in `e2e/family-mode.spec.ts`. We deliberately do not run a real
// Supabase server – instead each test creates a `MockState`, and every
// browser context that should "see" the same backend is registered via
// `installSupabaseMock(context, state)`. Two contexts pointed at the same
// state behave like two devices talking to one shared server.
//
// Covered surface:
//   • POST /auth/v1/signup            → anonymous user + bearer session
//   • POST /auth/v1/logout            → 204
//   • POST /auth/v1/token             → noop refresh
//   • GET  /auth/v1/user              → current user
//   • POST /rest/v1/<table>           → insert / upsert (Prefer headers)
//   • GET  /rest/v1/<table>?…         → select with eq./in. filters
//   • DELETE /rest/v1/<table>?id=eq.… → delete (cascades for `devices`)
//   • POST /storage/v1/object/<bkt>/* → upload binary
//
// Anything outside that surface returns a clear 501 so unexpected calls are
// loud rather than silent.

type Row = Record<string, unknown>

type Bearer = { token: string; refresh: string; userId: string }

export interface MockState {
  baseHost: string
  bearers: Map<string, Bearer> // access_token → bearer
  refreshTokens: Map<string, Bearer>
  users: Map<string, Row>
  devices: Row[]
  shares: Row[]
  share_recipients: Row[]
  annotations: Row[]
  share_media: Row[]
  storage: Map<string, Uint8Array>
  /** Every request that hit the mock, useful for assertions. */
  log: { method: string; url: string }[]
}

export function createMockState(baseHost = 'supabase.e2e.local'): MockState {
  return {
    baseHost,
    bearers: new Map(),
    refreshTokens: new Map(),
    users: new Map(),
    devices: [],
    shares: [],
    share_recipients: [],
    annotations: [],
    share_media: [],
    storage: new Map(),
    log: [],
  }
}

export async function installSupabaseMock(
  context: BrowserContext,
  state: MockState,
): Promise<void> {
  await context.route(`http://${state.baseHost}/**`, route => handle(route, state))
}

// ── Dispatch ──────────────────────────────────────────────────────────────

function handle(route: Route, state: MockState): Promise<void> {
  const request = route.request()
  const url = new URL(request.url())
  state.log.push({ method: request.method(), url: request.url() })

  if (url.pathname.startsWith('/auth/v1/')) return handleAuth(route, request, url, state)
  if (url.pathname.startsWith('/rest/v1/')) return handleRest(route, request, url, state)
  if (url.pathname.startsWith('/storage/v1/object/')) return handleStorage(route, request, url, state)

  return route.fulfill({
    status: 501,
    contentType: 'application/json',
    body: JSON.stringify({ message: `mock: unhandled ${request.method()} ${url.pathname}` }),
  })
}

// ── Auth ──────────────────────────────────────────────────────────────────

async function handleAuth(route: Route, req: PWRequest, url: URL, state: MockState) {
  const path = url.pathname.replace(/\/+$/, '')

  if (req.method() === 'POST' && path === '/auth/v1/signup') {
    const userId = crypto.randomUUID()
    const bearer = mintBearer(userId, state)
    const user = anonUser(userId)
    state.users.set(userId, user)
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: bearer.token,
        refresh_token: bearer.refresh,
        expires_in: 24 * 3600,
        token_type: 'bearer',
        user,
      }),
    })
  }

  if (req.method() === 'POST' && path === '/auth/v1/logout') {
    const bearer = readBearer(req, state)
    if (bearer) {
      state.bearers.delete(bearer.token)
      state.refreshTokens.delete(bearer.refresh)
    }
    return route.fulfill({ status: 204, body: '' })
  }

  if (req.method() === 'POST' && path === '/auth/v1/token') {
    const grant = url.searchParams.get('grant_type')
    if (grant === 'refresh_token') {
      const body = safeJson(req.postData())
      const oldRefresh = (body as Row | null)?.refresh_token as string | undefined
      const old = oldRefresh ? state.refreshTokens.get(oldRefresh) : null
      if (!old) {
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'invalid_grant', error_description: 'no such refresh token' }),
        })
      }
      state.bearers.delete(old.token)
      state.refreshTokens.delete(old.refresh)
      const fresh = mintBearer(old.userId, state)
      const user = state.users.get(old.userId) ?? anonUser(old.userId)
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: fresh.token,
          refresh_token: fresh.refresh,
          expires_in: 24 * 3600,
          token_type: 'bearer',
          user,
        }),
      })
    }
    return route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'unsupported_grant_type' }),
    })
  }

  if (req.method() === 'GET' && path === '/auth/v1/user') {
    const bearer = readBearer(req, state)
    if (!bearer) {
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'no auth' }),
      })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state.users.get(bearer.userId) ?? anonUser(bearer.userId)),
    })
  }

  // Treat unknown auth POSTs as no-ops so supabase-js initialisation never
  // fails the whole test for an endpoint we don't actually drive.
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '{}',
  })
}

function mintBearer(userId: string, state: MockState): Bearer {
  const token = `mock-access-${userId}-${state.bearers.size}`
  const refresh = `mock-refresh-${userId}-${state.bearers.size}`
  const bearer: Bearer = { token, refresh, userId }
  state.bearers.set(token, bearer)
  state.refreshTokens.set(refresh, bearer)
  return bearer
}

function readBearer(req: PWRequest, state: MockState): Bearer | null {
  const auth = req.headers()['authorization'] ?? ''
  const m = auth.match(/^Bearer\s+(.+)$/i)
  if (!m) return null
  return state.bearers.get(m[1]) ?? null
}

function anonUser(id: string): Row {
  const now = new Date().toISOString()
  return {
    id,
    aud: 'authenticated',
    role: 'authenticated',
    email: '',
    phone: '',
    is_anonymous: true,
    app_metadata: { provider: 'anonymous', providers: ['anonymous'] },
    user_metadata: {},
    created_at: now,
    updated_at: now,
  }
}

// ── PostgREST ─────────────────────────────────────────────────────────────

async function handleRest(route: Route, req: PWRequest, url: URL, state: MockState) {
  const segs = url.pathname.split('/').filter(Boolean) // ['rest','v1',<table>,...]
  const table = segs[2]
  const rows = tableRows(state, table)
  if (!rows) {
    return route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ message: `mock: unknown table ${table}` }),
    })
  }

  const params = url.searchParams
  const prefer = (req.headers()['prefer'] ?? '').toLowerCase()
  const accept = (req.headers()['accept'] ?? '').toLowerCase()
  const wantsSingle = accept.includes('vnd.pgrst.object+json')
  const returnRepresentation = prefer.includes('return=representation') || wantsSingle
  const upsert = prefer.includes('resolution=merge-duplicates')

  if (req.method() === 'GET') {
    const filtered = applyFilters(rows, params)
    const projected = applySelect(filtered, params.get('select'))
    if (wantsSingle) {
      if (projected.length === 0) {
        return route.fulfill({
          status: 406,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'no rows' }),
        })
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/vnd.pgrst.object+json',
        body: JSON.stringify(projected[0]),
      })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(projected),
    })
  }

  if (req.method() === 'POST') {
    const body = safeJson(req.postData())
    const incoming = (Array.isArray(body) ? body : body ? [body] : []) as Row[]
    const out: Row[] = []
    for (const item of incoming) {
      const row = enrichInsert(table, item)
      if (upsert) {
        const pk = pkColumn(table)
        const idx = pk ? rows.findIndex(r => r[pk] === row[pk]) : -1
        if (idx >= 0) rows[idx] = { ...rows[idx], ...row }
        else rows.push(row)
      } else {
        rows.push(row)
      }
      out.push(row)
    }
    if (wantsSingle) {
      return route.fulfill({
        status: 201,
        contentType: 'application/vnd.pgrst.object+json',
        body: JSON.stringify(applySelect(out, params.get('select'))[0] ?? null),
      })
    }
    if (returnRepresentation) {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(applySelect(out, params.get('select'))),
      })
    }
    return route.fulfill({ status: 201, contentType: 'application/json', body: '' })
  }

  if (req.method() === 'PATCH') {
    const body = safeJson(req.postData()) as Row | null
    const filtered = applyFilters(rows, params)
    for (const row of filtered) Object.assign(row, body ?? {})
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: returnRepresentation ? JSON.stringify(filtered) : '',
    })
  }

  if (req.method() === 'DELETE') {
    const filtered = applyFilters(rows, params)
    for (const r of filtered) {
      const idx = rows.indexOf(r)
      if (idx >= 0) rows.splice(idx, 1)
      cascadeDelete(state, table, r)
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: returnRepresentation ? JSON.stringify(filtered) : '',
    })
  }

  return route.fulfill({
    status: 501,
    contentType: 'application/json',
    body: JSON.stringify({ message: `mock: unsupported ${req.method()} ${url.pathname}` }),
  })
}

function tableRows(state: MockState, table: string): Row[] | null {
  switch (table) {
    case 'devices': return state.devices
    case 'shares': return state.shares
    case 'share_recipients': return state.share_recipients
    case 'annotations': return state.annotations
    case 'share_media': return state.share_media
    default: return null
  }
}

function pkColumn(table: string): string | null {
  switch (table) {
    case 'devices': return 'id'
    case 'shares': return 'id'
    case 'annotations': return 'id'
    case 'share_media': return 'id'
    case 'share_recipients': return null // composite
    default: return null
  }
}

function enrichInsert(table: string, row: Row): Row {
  const out: Row = { ...row }
  const now = new Date().toISOString()
  if (table === 'shares' || table === 'annotations') {
    if (!out.id) out.id = crypto.randomUUID()
    if (!out.created_at) out.created_at = now
    if (!out.updated_at) out.updated_at = now
  } else if (table === 'devices' || table === 'share_media') {
    if (!out.created_at) out.created_at = now
  }
  return out
}

function applyFilters(rows: Row[], params: URLSearchParams): Row[] {
  let out = rows.slice()
  for (const [key, raw] of params.entries()) {
    if (key === 'select' || key === 'order' || key === 'limit' || key === 'offset' || key === 'on_conflict') continue
    if (raw.startsWith('eq.')) {
      const v = raw.slice(3)
      out = out.filter(r => String(r[key] ?? '') === v)
    } else if (raw.startsWith('in.(')) {
      const inner = raw.slice(4, -1)
      const parts = splitCsvRespectingQuotes(inner).map(s => s.replace(/^"|"$/g, ''))
      out = out.filter(r => parts.includes(String(r[key] ?? '')))
    } else if (raw.startsWith('neq.')) {
      const v = raw.slice(4)
      out = out.filter(r => String(r[key] ?? '') !== v)
    }
    // anything else: silently ignore – tests only exercise eq/in/neq
  }
  return out
}

function splitCsvRespectingQuotes(s: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (const ch of s) {
    if (ch === '"') { inQ = !inQ; cur += ch; continue }
    if (ch === ',' && !inQ) { out.push(cur); cur = ''; continue }
    cur += ch
  }
  if (cur.length > 0) out.push(cur)
  return out
}

function applySelect(rows: Row[], select: string | null): Row[] {
  if (!select || select === '*') return rows
  const cols = select.split(',').map(s => s.trim()).filter(Boolean)
  return rows.map(r => {
    const out: Row = {}
    for (const c of cols) out[c] = r[c]
    return out
  })
}

function cascadeDelete(state: MockState, table: string, row: Row) {
  if (table === 'devices') {
    const id = row.id as string
    // shares owned by this device + their dependents
    const ownedShares = state.shares.filter(s => s.owner_id === id)
    for (const s of ownedShares) {
      const sid = s.id as string
      state.share_recipients = state.share_recipients.filter(r => r.share_id !== sid)
      state.annotations = state.annotations.filter(a => a.share_id !== sid)
      state.share_media = state.share_media.filter(m => m.share_id !== sid)
    }
    state.shares = state.shares.filter(s => s.owner_id !== id)
    // annotations / share_recipients keyed on this device as recipient/author
    state.share_recipients = state.share_recipients.filter(r => r.recipient_id !== id)
    state.annotations = state.annotations.filter(a => a.author_id !== id)
  }
}

// ── Storage ───────────────────────────────────────────────────────────────

async function handleStorage(route: Route, req: PWRequest, url: URL, state: MockState) {
  // path is /storage/v1/object/<bucket>/<…>
  const key = url.pathname
  if (req.method() === 'POST' || req.method() === 'PUT') {
    const body = req.postDataBuffer()
    state.storage.set(key, body ? new Uint8Array(body) : new Uint8Array())
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ Key: key.replace('/storage/v1/object/', '') }),
    })
  }
  if (req.method() === 'GET') {
    const bytes = state.storage.get(key)
    if (!bytes) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, body: Buffer.from(bytes) })
  }
  return route.fulfill({ status: 501, body: '' })
}

// ── Helpers ───────────────────────────────────────────────────────────────

function safeJson(s: string | null | undefined): unknown {
  if (!s) return null
  try { return JSON.parse(s) } catch { return null }
}

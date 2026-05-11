// ── In-memory Supabase fake for Vitest ─────────────────────────────────────
//
// Vitest-Pendant zu `e2e/helpers/supabase-mock.ts`: derselbe Tabellen-Footprint
// (devices / shares / share_recipients / annotations / share_media / storage),
// nur ohne Playwright-Route-Interception. Statt HTTP zu mocken bauen wir hier
// einen Supabase-Client-Stub, der `getSupabaseClient()` ersetzen kann.
//
// Designziele:
//   • Eine **gemeinsame** `Backend`-Instanz simuliert „den Server" — mehrere
//     Clients gegen denselben Backend simulieren mehrere Geräte/User.
//   • Jeder Client hat seine eigene anonyme Auth-Session (`signInAnonymously`
//     erzeugt einen neuen User pro Client-Instanz). Damit lässt sich im
//     selben Vitest-Prozess der User-A-→-User-B-Sharing-Flow durchspielen.
//   • Die Builder-Kette (`.from(t).select(...).eq(...).maybeSingle()`) ist
//     thenable, also `await`-bar wie der echte PostgrestBuilder.
//
// Bewusste Auslassungen:
//   • Keine RLS — eingehende Reads sehen **alle** Rows. RLS gehört in
//     dedizierte Datenbank-Tests (lokales Supabase + pgTAP) und nicht hier.
//   • Keine echte Crypto — wir leiten die Bytes nur 1:1 weiter; die echte
//     `shareEncryption` verschlüsselt darüber, also reicht das.
//   • Nur die Filter, die der echte Code nutzt (`eq`, `in`, `neq`).

import type { SupabaseClient } from '@supabase/supabase-js'

// ── Row-Typen + Backend-State ──────────────────────────────────────────────

type Row = Record<string, unknown>

export interface Backend {
  devices: Row[]
  shares: Row[]
  share_recipients: Row[]
  annotations: Row[]
  share_media: Row[]
  storage: Map<string, Uint8Array>
  /** Jeder Request, der den Backend trifft — nützlich für Assertions. */
  log: Array<{ kind: string; table?: string; bucket?: string; path?: string }>
}

export function createInMemoryBackend(): Backend {
  return {
    devices: [],
    shares: [],
    share_recipients: [],
    annotations: [],
    share_media: [],
    storage: new Map(),
    log: [],
  }
}

function tableRows(backend: Backend, table: string): Row[] | null {
  switch (table) {
    case 'devices': return backend.devices
    case 'shares': return backend.shares
    case 'share_recipients': return backend.share_recipients
    case 'annotations': return backend.annotations
    case 'share_media': return backend.share_media
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

function cascadeDelete(backend: Backend, table: string, row: Row): void {
  if (table === 'devices') {
    const id = row.id as string
    const ownedShares = backend.shares.filter(s => s.owner_id === id).map(s => s.id as string)
    backend.shares = backend.shares.filter(s => s.owner_id !== id)
    backend.share_recipients = backend.share_recipients.filter(
      r => r.recipient_id !== id && !ownedShares.includes(r.share_id as string),
    )
    backend.annotations = backend.annotations.filter(
      a => a.author_id !== id && !ownedShares.includes(a.share_id as string),
    )
    backend.share_media = backend.share_media.filter(
      m => !ownedShares.includes(m.share_id as string),
    )
  } else if (table === 'shares') {
    const id = row.id as string
    backend.share_recipients = backend.share_recipients.filter(r => r.share_id !== id)
    backend.annotations = backend.annotations.filter(a => a.share_id !== id)
    backend.share_media = backend.share_media.filter(m => m.share_id !== id)
  }
}

// ── Query-Builder ──────────────────────────────────────────────────────────
//
// Wir bauen eine schmale, thenable Kette. Jede Methode gibt das Builder-
// Objekt zurück, bis ein Terminal (`await`, `.maybeSingle()`, `.single()`)
// die akkumulierten Operationen ausführt.

type Filter = { col: string; op: 'eq' | 'in' | 'neq'; value: unknown }

interface BuilderState {
  table: string
  action: 'select' | 'insert' | 'upsert' | 'delete' | null
  selectCols: string | null
  filters: Filter[]
  insertRows: Row[]
  upsertRow: Row | null
  single: 'maybe' | 'strict' | null
}

function applyFilters(rows: Row[], filters: Filter[]): Row[] {
  return rows.filter(row => {
    for (const f of filters) {
      const cell = row[f.col]
      if (f.op === 'eq' && String(cell ?? '') !== String(f.value ?? '')) return false
      if (f.op === 'neq' && String(cell ?? '') === String(f.value ?? '')) return false
      if (f.op === 'in') {
        const list = (f.value as unknown[]).map(v => String(v ?? ''))
        if (!list.includes(String(cell ?? ''))) return false
      }
    }
    return true
  })
}

function applySelect(rows: Row[], select: string | null): Row[] {
  if (!select || select === '*') return rows.map(r => ({ ...r }))
  const cols = select.split(',').map(s => s.trim()).filter(Boolean)
  return rows.map(r => {
    const out: Row = {}
    for (const c of cols) out[c] = r[c]
    return out
  })
}

class QueryBuilder<T = unknown> implements PromiseLike<{ data: T; error: { message: string } | null }> {
  private state: BuilderState

  constructor(private readonly backend: Backend, table: string) {
    this.state = {
      table,
      action: null,
      selectCols: null,
      filters: [],
      insertRows: [],
      upsertRow: null,
      single: null,
    }
  }

  insert(rows: Row | Row[]): this {
    this.state.action = 'insert'
    this.state.insertRows = Array.isArray(rows) ? rows : [rows]
    return this
  }

  upsert(row: Row): this {
    this.state.action = 'upsert'
    this.state.upsertRow = row
    return this
  }

  select(cols: string = '*'): this {
    if (!this.state.action) this.state.action = 'select'
    this.state.selectCols = cols
    return this
  }

  delete(): this {
    this.state.action = 'delete'
    return this
  }

  eq(col: string, value: unknown): this {
    this.state.filters.push({ col, op: 'eq', value })
    return this
  }

  in(col: string, values: unknown[]): this {
    this.state.filters.push({ col, op: 'in', value: values })
    return this
  }

  neq(col: string, value: unknown): this {
    this.state.filters.push({ col, op: 'neq', value })
    return this
  }

  maybeSingle(): Promise<{ data: T | null; error: { message: string } | null }> {
    this.state.single = 'maybe'
    return this as unknown as Promise<{ data: T | null; error: { message: string } | null }>
  }

  single(): Promise<{ data: T; error: { message: string } | null }> {
    this.state.single = 'strict'
    return this as unknown as Promise<{ data: T; error: { message: string } | null }>
  }

  then<TResult1 = { data: T; error: { message: string } | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: T; error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return new Promise<{ data: T; error: { message: string } | null }>((resolve) => {
      resolve(this.execute() as { data: T; error: { message: string } | null })
    }).then(onfulfilled, onrejected)
  }

  private execute(): { data: unknown; error: { message: string } | null } {
    const { table, action, filters, selectCols, insertRows, upsertRow, single } = this.state
    const rows = tableRows(this.backend, table)
    if (!rows) return { data: null, error: { message: `unknown table: ${table}` } }

    this.backend.log.push({ kind: action ?? 'select', table })

    if (action === 'insert') {
      const inserted = insertRows.map(r => enrichInsert(table, r))
      rows.push(...inserted)
      const out = selectCols ? applySelect(inserted, selectCols) : null
      return { data: this.finalize(out, single), error: null }
    }

    if (action === 'upsert') {
      if (!upsertRow) return { data: null, error: { message: 'upsert without row' } }
      const pk = pkColumn(table)
      const enriched = enrichInsert(table, upsertRow)
      if (pk && enriched[pk] !== undefined) {
        const idx = rows.findIndex(r => r[pk] === enriched[pk])
        if (idx >= 0) rows[idx] = { ...rows[idx], ...enriched }
        else rows.push(enriched)
      } else {
        rows.push(enriched)
      }
      const out = selectCols ? applySelect([enriched], selectCols) : null
      return { data: this.finalize(out, single), error: null }
    }

    if (action === 'delete') {
      const toDelete = applyFilters(rows, filters)
      for (const row of toDelete) {
        const idx = rows.indexOf(row)
        if (idx >= 0) rows.splice(idx, 1)
        cascadeDelete(this.backend, table, row)
      }
      return { data: null, error: null }
    }

    // select (default)
    const filtered = applyFilters(rows, filters)
    const projected = applySelect(filtered, selectCols)
    return { data: this.finalize(projected, single), error: null }
  }

  private finalize(rows: Row[] | null, single: 'maybe' | 'strict' | null): unknown {
    if (rows === null) return null
    if (single === 'maybe') return rows[0] ?? null
    if (single === 'strict') {
      if (rows.length !== 1) return null
      return rows[0]
    }
    return rows
  }
}

// ── Storage-Stub ───────────────────────────────────────────────────────────

class StorageBucket {
  constructor(private readonly backend: Backend, private readonly bucket: string) {}

  async upload(path: string, data: ArrayBuffer | Uint8Array | Blob): Promise<{
    data: { path: string } | null
    error: { message: string } | null
  }> {
    let bytes: Uint8Array
    if (data instanceof Uint8Array) bytes = data
    else if (data instanceof ArrayBuffer) bytes = new Uint8Array(data)
    else bytes = new Uint8Array(await data.arrayBuffer())
    const key = `${this.bucket}/${path}`
    if (this.backend.storage.has(key)) {
      return { data: null, error: { message: 'already exists' } }
    }
    this.backend.storage.set(key, bytes)
    this.backend.log.push({ kind: 'storage.upload', bucket: this.bucket, path })
    return { data: { path }, error: null }
  }

  async download(path: string): Promise<{ data: Blob | null; error: { message: string } | null }> {
    const key = `${this.bucket}/${path}`
    const bytes = this.backend.storage.get(key)
    this.backend.log.push({ kind: 'storage.download', bucket: this.bucket, path })
    if (!bytes) return { data: null, error: { message: 'not found' } }
    return { data: new Blob([bytes as BlobPart]), error: null }
  }

  async remove(paths: string[]): Promise<{ data: unknown; error: { message: string } | null }> {
    for (const p of paths) {
      const key = `${this.bucket}/${p}`
      this.backend.storage.delete(key)
      this.backend.log.push({ kind: 'storage.remove', bucket: this.bucket, path: p })
    }
    return { data: null, error: null }
  }
}

// ── Auth-Stub ──────────────────────────────────────────────────────────────

interface FakeSession {
  user: { id: string }
  access_token: string
  refresh_token: string
}

class AuthStub {
  private session: FakeSession | null = null

  async signInAnonymously(): Promise<{
    data: { user: { id: string } | null; session: FakeSession | null }
    error: { message: string } | null
  }> {
    const userId = crypto.randomUUID()
    this.session = {
      user: { id: userId },
      access_token: crypto.randomUUID(),
      refresh_token: crypto.randomUUID(),
    }
    return { data: { user: this.session.user, session: this.session }, error: null }
  }

  async getSession(): Promise<{ data: { session: FakeSession | null }; error: null }> {
    return { data: { session: this.session }, error: null }
  }

  async signOut(): Promise<{ error: null }> {
    this.session = null
    return { error: null }
  }
}

// ── Client-Fabrik ──────────────────────────────────────────────────────────

export function createFakeSupabaseClient(backend: Backend): SupabaseClient {
  const auth = new AuthStub()
  const client = {
    auth,
    from: (table: string) => new QueryBuilder(backend, table),
    storage: {
      from: (bucket: string) => new StorageBucket(backend, bucket),
    },
  }
  return client as unknown as SupabaseClient
}

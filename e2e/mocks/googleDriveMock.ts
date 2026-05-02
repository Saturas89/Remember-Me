import type { BrowserContext, Route, Request as PWRequest } from '@playwright/test'

// In-memory Google Drive mock used by the REQ-017 E2E suite.
// Implements just the v3 endpoints that GoogleDriveProvider hits:
//   GET    drive/v3/files?q=name=…           → list files
//   POST   upload/drive/v3/files?uploadType= → create / upload
//   PATCH  upload/drive/v3/files/{id}        → update
//   GET    drive/v3/files/{id}?alt=media     → read
// Anything else returns 501 so unexpected calls are loud.

export interface DriveMockState {
  files: Map<string, { name: string; content: string; mimeType: string }>
  log: { method: string; url: string }[]
}

export function createDriveMockState(): DriveMockState {
  return { files: new Map(), log: [] }
}

export async function installGoogleDriveMock(
  context: BrowserContext,
  state: DriveMockState = createDriveMockState(),
): Promise<DriveMockState> {
  await context.route(
    /https:\/\/www\.googleapis\.com\/.*drive\/.*/,
    route => handle(route, state),
  )
  // OAuth GIS sources – stubbed so the script tag never tries to load real
  // Google code in CI.
  await context.route(
    'https://accounts.google.com/gsi/client',
    route => route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: '/* stubbed by googleDriveMock */',
    }),
  )
  return state
}

async function handle(route: Route, state: DriveMockState) {
  const req = route.request()
  const url = new URL(req.url())
  state.log.push({ method: req.method(), url: req.url() })

  // List files (filter is ignored – we always return the only file we know).
  if (req.method() === 'GET' && url.pathname.endsWith('/drive/v3/files')) {
    const files = Array.from(state.files.entries()).map(([id, f]) => ({
      id,
      name: f.name,
      modifiedTime: new Date().toISOString(),
    }))
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ files }),
    })
  }

  // Read file
  const readMatch = url.pathname.match(/\/drive\/v3\/files\/([^/]+)$/)
  if (req.method() === 'GET' && readMatch && url.searchParams.get('alt') === 'media') {
    const file = state.files.get(readMatch[1])
    if (!file) {
      return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
    }
    return route.fulfill({
      status: 200,
      contentType: file.mimeType,
      body: file.content,
    })
  }

  // Multipart upload (create or update)
  if (
    (req.method() === 'POST' || req.method() === 'PATCH') &&
    url.pathname.includes('/upload/drive/v3/files')
  ) {
    const id = parseUpdateId(url.pathname) ?? `mock-${state.files.size + 1}`
    const body = req.postData() ?? ''
    const { name, content, mimeType } = parseMultipart(body)
    state.files.set(id, {
      name: name ?? state.files.get(id)?.name ?? 'remember-me-sync.json',
      content,
      mimeType: mimeType ?? 'application/json',
    })
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id, name }),
    })
  }

  return route.fulfill({
    status: 501,
    contentType: 'application/json',
    body: JSON.stringify({ message: `googleDriveMock: unhandled ${req.method()} ${url.pathname}` }),
  })
}

function parseUpdateId(pathname: string): string | null {
  const m = pathname.match(/\/upload\/drive\/v3\/files\/([^/?]+)/)
  return m?.[1] ?? null
}

function parseMultipart(body: string): { name?: string; content: string; mimeType?: string } {
  // Very forgiving multipart parser: pulls out the JSON metadata (with `name`)
  // and treats everything after the first `\r\n\r\n` of the second part as the
  // file body. Provider only writes a single JSON file, so this is enough for
  // round-tripping in tests.
  const nameMatch = body.match(/"name"\s*:\s*"([^"]+)"/)
  const mimeMatch = body.match(/"mimeType"\s*:\s*"([^"]+)"/)
  const parts = body.split(/\r?\n\r?\n/)
  const content = parts[parts.length - 1] ?? ''
  return { name: nameMatch?.[1], mimeType: mimeMatch?.[1], content }
}

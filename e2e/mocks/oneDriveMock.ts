import type { BrowserContext, Route } from '@playwright/test'

// In-memory Microsoft Graph mock for the REQ-017 E2E suite.
// Implements the AppFolder endpoints used by OneDriveProvider:
//   GET   /me/drive/special/approot:/{path}:/content
//   PUT   /me/drive/special/approot:/{path}:/content
// 404 on read means "remote not yet present" → provider returns null.

export interface OneDriveMockState {
  files: Map<string, string>
  log: { method: string; url: string }[]
}

export function createOneDriveMockState(): OneDriveMockState {
  return { files: new Map(), log: [] }
}

export async function installOneDriveMock(
  context: BrowserContext,
  state: OneDriveMockState = createOneDriveMockState(),
): Promise<OneDriveMockState> {
  await context.route(
    /https:\/\/graph\.microsoft\.com\/.*/,
    route => handle(route, state),
  )
  return state
}

async function handle(route: Route, state: OneDriveMockState) {
  const req = route.request()
  const url = new URL(req.url())
  state.log.push({ method: req.method(), url: req.url() })

  const m = url.pathname.match(/\/me\/drive\/special\/approot:\/(.+):\/content$/)
  if (m) {
    const path = m[1]
    if (req.method() === 'GET') {
      const file = state.files.get(path)
      if (file === undefined) {
        return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: file,
      })
    }
    if (req.method() === 'PUT') {
      state.files.set(path, req.postData() ?? '')
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ name: path.split('/').pop() }),
      })
    }
  }

  return route.fulfill({
    status: 501,
    contentType: 'application/json',
    body: JSON.stringify({ message: `oneDriveMock: unhandled ${req.method()} ${url.pathname}` }),
  })
}

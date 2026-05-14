// Playwright config for the real-DB integration suite.
//
// Unlike the main playwright.config.ts (which intercepts Supabase requests with
// an in-memory mock) and playwright.interaction.config.ts (which also uses the
// mock but across six browsers), this config builds the app against a locally
// running Supabase stack and lets every request hit the real PostgREST/GoTrue
// endpoints — so RLS policies, FK cascades, and the auth flow are exercised
// end-to-end.
//
// Only chromium is used: the purpose here is schema/RLS validation, not
// cross-browser coverage (that is the responsibility of the main E2E suite).
//
// The local Supabase stack is started by the interaction-real-db CI job in
// .github/workflows/interaction-tests.yml.  Credentials are passed via env:
//   SUPABASE_URL             – http://127.0.0.1:54321
//   SUPABASE_ANON_KEY        – anon/public JWT
//   SUPABASE_SERVICE_ROLE_KEY – service-role JWT (for admin cleanup)

import { defineConfig, devices } from '@playwright/test'

const PORT = 4174
const BASE_URL = `http://localhost:${PORT}`

const SUPABASE_URL      = process.env.SUPABASE_URL      ?? 'http://127.0.0.1:54321'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? ''

export default defineConfig({
  testDir: './e2e/supabase',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  reporter: process.env.CI
    ? [
        ['html', { open: 'never' }],
        ['json', { outputFile: 'playwright-report/interaction-report.json' }],
      ]
    : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: process.env.PW_SKIP_BUILD
      ? `npm run preview -- --port ${PORT} --strictPort`
      : `npm run build:app && npm run preview -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
      VITE_E2E: 'true',
    },
  },
})

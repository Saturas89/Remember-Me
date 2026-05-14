// Playwright config for the real-DB suite.
//
// Builds the app against a locally running Supabase stack (started by the
// interaction-real-db CI job). All six browser/device projects run against
// the same real PostgREST/GoTrue endpoints so RLS, FK cascades, E2E crypto,
// and mobile UX are all covered with a genuine backend.
//
// Chaos tests (e2e/interaction/chaos.spec.ts) intentionally stay in the
// mock-based interaction suite — fault injection requires the in-memory mock.
//
// Tests run sequentially (fullyParallel: false, workers: 1) to avoid
// interleaving test data across the shared local Supabase instance.
//
// Credentials are passed via env vars:
//   SUPABASE_URL              – http://127.0.0.1:54321
//   SUPABASE_ANON_KEY         – anon/public JWT
//   SUPABASE_SERVICE_ROLE_KEY – service-role JWT (admin cleanup in afterEach)

import { defineConfig, devices } from '@playwright/test'

const PORT = 4174
const BASE_URL = `http://localhost:${PORT}`

const SUPABASE_URL      = process.env.SUPABASE_URL      ?? 'http://127.0.0.1:54321'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? ''

export default defineConfig({
  testDir: './e2e/supabase',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 90_000,
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
    { name: 'chromium',            use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',             use: { ...devices['Desktop Firefox'] } },
    { name: 'android-pixel7',      use: { ...devices['Pixel 7'] } },
    {
      name: 'android-samsung-s23',
      use: {
        userAgent:
          'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
        viewport: { width: 360, height: 780 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        defaultBrowserType: 'chromium',
      },
    },
    {
      name: 'ios-iphone14',
      use: { ...devices['iPhone 14'] },
      timeout: 120_000,
    },
    {
      name: 'ios-iphone14promax',
      use: { ...devices['iPhone 14 Pro Max'] },
      timeout: 120_000,
    },
  ],
  webServer: {
    command: process.env.PW_SKIP_BUILD
      ? `npm run preview -- --port ${PORT} --strictPort`
      : `npm run build:app && npm run preview -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
      VITE_E2E: 'true',
    },
  },
})

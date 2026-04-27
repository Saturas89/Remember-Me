import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const BASE_URL = `http://localhost:${PORT}`

// Build the preview bundle with fake Supabase config so the Familienmodus UI
// is reachable in E2E. Real network traffic to this host is blocked by every
// test fixture: e2e/sharing-optin.spec.ts asserts that opted-out users never
// produce a request, and e2e/family-mode.spec.ts intercepts every call with
// an in-memory mock (e2e/helpers/supabase-mock.ts).
const SUPABASE_E2E_URL = 'http://supabase.e2e.local'
const SUPABASE_E2E_ANON_KEY = 'e2e-anon-key'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Default to a German-speaking context so all existing tests see German UI.
    // Individual i18n detection tests override locale/timezoneId per describe block.
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: 'npm run build:app && npm run preview -- --port 4173 --strictPort',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: SUPABASE_E2E_URL,
      VITE_SUPABASE_ANON_KEY: SUPABASE_E2E_ANON_KEY,
    },
  },
})

// Re-exported for tests that need to point fixtures at the same fake host.
export const E2E_SUPABASE_URL = SUPABASE_E2E_URL
export const E2E_SUPABASE_ANON_KEY = SUPABASE_E2E_ANON_KEY

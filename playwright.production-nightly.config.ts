// Playwright config for production nightly tests.
//
// Runs e2e/nightly/* against the live production Supabase instance.
// The app is accessed at https://storyhold.app (no local server started).
//
// Tests run sequentially (workers: 1) to avoid test-data interference across
// the shared production Supabase instance.
//
// Required secrets (GitHub Actions → Repository Secrets):
//   SUPABASE_URL              – production Supabase API URL
//   SUPABASE_ANON_KEY         – production anon/public JWT
//   SUPABASE_SERVICE_ROLE_KEY – service-role JWT for admin cleanup
//
// Test data cleanup: tests create anonymous users prefixed with e2e/ patterns.
// Cleanup happens in afterEach via cleanupUsers(). Any data that survives a
// crash is cleaned up by the scheduled nightly-cleanup job (to be added).

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e/nightly',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  // One retry absorbs the network / RLS-timing flakiness inherent to hitting
  // the live production stack, so a single transient blip no longer reds the
  // whole nightly run (the smoke + PR configs already retry once in CI).
  retries: 1,
  timeout: 90_000,
  globalSetup: './e2e/global-setup.production.ts',
  reporter: process.env.CI
    ? [
        ['html', { open: 'never' }],
        // Named production-report.json to match the pattern picked up by create-production-issue.mjs
        ['json', { outputFile: 'playwright-report/production-report.json' }],
      ]
    : 'list',
  use: {
    baseURL: 'https://www.storyhold.app',
    storageState: './playwright-production-state.json',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
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
})

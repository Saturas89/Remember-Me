// Playwright config for production nightly tests.
//
// Tests run against https://storyhold.app directly — no local server is started.
// The global setup writes playwright-production-state.json that injects
// traffic_type=e2e, github_run_id, test_run_id, browser_profile, device_profile
// into localStorage so PostHog can separate nightly traffic from real users.
//
// No build step needed: the app is already live in production.
// All six browser/device profiles run to catch browser-specific bugs.

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e/production',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  globalSetup: './e2e/global-setup.production.ts',
  reporter: process.env.CI
    ? [
        ['html', { open: 'never' }],
        ['json', { outputFile: 'playwright-report/production-report.json' }],
      ]
    : 'list',
  use: {
    baseURL: 'https://storyhold.app',
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
      timeout: 90_000,
    },
    {
      name: 'ios-iphone14promax',
      use: { ...devices['iPhone 14 Pro Max'] },
      timeout: 90_000,
    },
  ],
})

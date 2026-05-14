import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e/interaction',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 150_000,
  reporter: process.env.CI
    ? [
        ['github'],
        ['html', { open: 'never' }],
        ['json', { outputFile: 'playwright-report/interaction-report.json' }],
      ]
    : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'android-pixel7', use: { ...devices['Pixel 7'] } },
    {
      name: 'android-samsung-s23',
      use: {
        userAgent:
          'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
        viewport: { width: 360, height: 780 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        defaultBrowserType: 'chromium',
      },
    },
    { name: 'ios-iphone14', use: { ...devices['iPhone 14'] }, timeout: 150_000 },
    { name: 'ios-iphone14promax', use: { ...devices['iPhone 14 Pro Max'] }, timeout: 150_000 },
  ],
  webServer: {
    command: process.env.PW_SKIP_BUILD
      ? 'npm run preview -- --port 4173 --strictPort'
      : 'npm run build:app && npm run preview -- --port 4173 --strictPort',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: 'http://supabase.e2e.local',
      VITE_SUPABASE_ANON_KEY: 'e2e-anon-key',
      VITE_E2E: 'true',
    },
  },
})

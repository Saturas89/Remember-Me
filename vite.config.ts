/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Vitest: Wenn keine echten Supabase-Credentials im Env stehen, setzen wir
// Platzhalter, damit `ONLINE_SHARING_CONFIGURED` in App.tsx auf `true`
// flippt und Integrations-Tests den Online-Sharing-CTA rendern können.
// Für echte Network-Calls greift in den Tests der `vi.mock`-Override auf
// `supabaseClient`. Build/Dev sind nicht betroffen, weil VITEST dort nicht
// gesetzt ist.
if (process.env.VITEST === 'true') {
  if (!process.env.VITE_SUPABASE_URL) process.env.VITE_SUPABASE_URL = 'http://supabase.test.local'
  if (!process.env.VITE_SUPABASE_ANON_KEY) process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key'
}

export default defineConfig({
  // Vercels Supabase-Integration setzt Env-Vars als `SUPABASE_URL` /
  // `SUPABASE_ANON_KEY` (ohne Vite-Prefix). Vite exposed nur `VITE_*` ins
  // Client-Bundle – für Fremd-Namen nutzen wir eine explizite Allowlist
  // per `define`, anstatt den `envPrefix` zu erweitern. Letzteres würde
  // auch gefährliche Vars wie `SUPABASE_SERVICE_ROLE_KEY` ins Browser-
  // Bundle ziehen; die Allowlist hier betrifft gezielt nur die zwei
  // ohnehin öffentlichen Werte.
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
      process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''
    ),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
      process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? ''
    ),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'Storyhold',
        short_name: 'Storyhold',
        description: 'Halte deine Lebensgeschichte für die Nachwelt und deine Familie fest.',
        lang: 'de',
        theme_color: '#1a1a2e',
        background_color: '#f3e2bd',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['lifestyle', 'social'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  build: {
    // Vite 8 (rolldown) emittiert standardmäßig `<link rel="modulepreload">`
    // für jeden Chunk, der transitiv vom Entry erreichbar ist – inklusive
    // `supabaseClient`, `privateSyncClient` und `recoveryCode`. Das bricht den
    // Opt-in-Vertrag aus REQ-009 (e2e/sharing-optin.spec.ts:85): ein User, der
    // „Online teilen" nie aktiviert hat, soll den supabase-Chunk gar nicht
    // erst herunterladen. Vite 7 (rollup) war hier konservativer und hat die
    // Chunks zwar erzeugt, aber nicht preloaded. Wir filtern die Preload-Liste
    // hier explizit, statt den Chunk-Split zu erzwingen.
    modulePreload: {
      resolveDependencies: (_url, deps) =>
        deps.filter(
          (dep) => !/(supabaseClient|sharingService|privateSyncClient|recoveryCode)/.test(dep),
        ),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test-helpers/vitestSetup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test-helpers/**',
        'src/integration/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/types.ts',
        'src/**/*.d.ts',
      ],
      // Untergrenzen entsprechen dem realen Coverage-Stand auf diesem Branch.
      // Sie wirken als Ratsche: künftige PRs dürfen die Marke nicht
      // unterlaufen, sollten sie aber Schritt für Schritt anheben, sobald
      // mehr Tests (z. B. weitere Integrations-Flows) hinzukommen.
      thresholds: {
        lines: 62,
        statements: 59,
        functions: 52,
        branches: 49,
      },
    },
  },
})

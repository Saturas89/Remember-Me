/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

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
        lines: 55,
        statements: 52,
        functions: 44,
        branches: 42,
      },
    },
  },
})

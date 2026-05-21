// ── Integration test: Onboarding-Flow gegen das volle <App /> ──────────────
//
// Ersetzt die Mehrzahl der UI-Checks aus `e2e/onboarding.spec.ts` durch einen
// jsdom-Render des echten App-Roots. Was Playwright dort tat (URL → DOM →
// Klick → Erwartung) machen wir hier mit @testing-library/react – inklusive
// echter localStorage-Persistenz zwischen „Reloads" (Re-Mount).
//
// Nicht abgedeckt (gehört in Playwright):
//   • Service-Worker-Registrierung / PWA-Installer
//   • Cross-Browser-Quirks (Mobile Safari, iPhone-14)
//   • Echte Navigation via `page.goto('/...')` auf produktiven Routen

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { render, cleanup, screen, fireEvent, within, act } from '@testing-library/react'
import App from '../App'

const STATE_KEY = 'remember-me-state'
const INSTALL_KEY = 'rm-install-dismissed'

function preSeedFreshSession() {
  // Spiegelt die `dismissInstallPrompt`-Vorbereitung aus den E2E-Helpers:
  // Der Install-Banner darf den „Loslegen"-Button nicht überdecken, und ein
  // wirklich frischer Besucher hat keinen `remember-me-state`-Schlüssel.
  // rm-landing-seen wird gesetzt, damit Onboarding-Tests direkt zum
  // Onboarding-Flow gelangen und nicht die Landingpage testen.
  localStorage.setItem(INSTALL_KEY, '1')
  localStorage.setItem('rm-landing-seen', '1')
  localStorage.removeItem(STATE_KEY)
}

function preSeedReturningUser(profileName: string, mode: 'simple' | 'full' = 'full') {
  localStorage.setItem(INSTALL_KEY, '1')
  localStorage.setItem(
    STATE_KEY,
    JSON.stringify({
      profile: { name: profileName, createdAt: '2024-01-01T00:00:00.000Z' },
      answers: {},
      friends: [],
      friendAnswers: [],
      customQuestions: [],
      appMode: mode,
    }),
  )
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-app-mode')
})

afterEach(cleanup)

describe('Onboarding flow (integration)', () => {
  describe('Fresh visitor', () => {
    beforeEach(preSeedFreshSession)

    it('sieht zuerst die Modus-Auswahl, noch nicht das Namensfeld', async () => {
      render(<App />)

      expect(await screen.findByTestId('onboarding-mode-simple')).toBeTruthy()
      expect(screen.getByTestId('onboarding-mode-full')).toBeTruthy()
      expect(screen.queryByLabelText('Wie heißt du?')).toBeNull()
    })

    it('wählt "Vollständig", füllt Name aus und landet auf Home mit allen 6 Kategorien', async () => {
      render(<App />)

      fireEvent.click(await screen.findByTestId('onboarding-mode-full'))

      const nameInput = (await screen.findByLabelText('Wie heißt du?')) as HTMLInputElement
      const startButton = screen.getByRole('button', { name: /Loslegen/ }) as HTMLButtonElement
      expect(startButton.disabled).toBe(true)

      fireEvent.change(nameInput, { target: { value: 'Voll' } })
      expect(startButton.disabled).toBe(false)

      fireEvent.click(startButton)

      expect(await screen.findByText(/Hallo,\s*Voll/)).toBeTruthy()
      for (const title of [
        'Kindheit & Jugend',
        'Familie & Beziehungen',
        'Beruf & Leidenschaften',
        'Werte & Überzeugungen',
        'Erinnerungen & Erlebnisse',
        'Wünsche & Vermächtnis',
      ]) {
        expect(screen.getByRole('heading', { name: title })).toBeTruthy()
      }
    })

    it('"Einfach" reduziert auf 3 Tabs, blendet "Eigene Erinnerung" aus und setzt data-app-mode="simple"', async () => {
      render(<App />)

      fireEvent.click(await screen.findByTestId('onboarding-mode-simple'))
      fireEvent.change(await screen.findByLabelText('Wie heißt du?'), { target: { value: 'Oma' } })
      fireEvent.click(screen.getByRole('button', { name: /Loslegen/ }))

      expect(await screen.findByText(/Hallo,\s*Oma/)).toBeTruthy()
      expect(document.documentElement.getAttribute('data-app-mode')).toBe('simple')

      const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' })
      const buttons = within(nav).getAllByRole('button').map(b => b.textContent?.trim() ?? '')
      // Simple-Mode: nur Lebensweg / Vermächtnis / Profil
      expect(buttons.some(t => /Lebensweg/.test(t))).toBe(true)
      expect(buttons.some(t => /Vermächtnis/.test(t))).toBe(true)
      expect(buttons.some(t => /Profil/.test(t))).toBe(true)
      expect(buttons.some(t => /Freunde/.test(t))).toBe(false)
      expect(buttons.some(t => /^Sync\b/.test(t))).toBe(false)

      // Custom-Questions-Karte ist im Simple-Mode versteckt.
      expect(screen.queryByRole('heading', { name: 'Eigene Erinnerung' })).toBeNull()
    })
  })

  describe('Returning user (state pre-seeded)', () => {
    it('überspringt das Onboarding und zeigt die Begrüßung samt Custom-Karte (Voll-Modus)', async () => {
      preSeedReturningUser('Persistence', 'full')

      render(<App />)

      expect(await screen.findByText(/Hallo,\s*Persistence/)).toBeTruthy()
      expect(screen.queryByLabelText('Wie heißt du?')).toBeNull()
      expect(screen.getByRole('heading', { name: 'Eigene Erinnerung' })).toBeTruthy()
    })

    it('"Reload" (Re-Mount) bewahrt den Profilnamen aus dem localStorage', async () => {
      preSeedReturningUser('Persistence', 'full')

      const { unmount } = render(<App />)
      expect(await screen.findByText(/Hallo,\s*Persistence/)).toBeTruthy()
      await act(async () => {
        unmount()
      })

      // Frischer Mount – Daten kommen weiter aus localStorage, kein
      // erneutes Onboarding.
      render(<App />)
      expect(await screen.findByText(/Hallo,\s*Persistence/)).toBeTruthy()
      expect(screen.queryByLabelText('Wie heißt du?')).toBeNull()
    })

    it('Bottom-Nav wechselt jeden Tab und markiert ihn aria-current="page"', async () => {
      preSeedReturningUser('Navigator', 'full')

      render(<App />)

      const nav = await screen.findByRole('navigation', { name: 'Hauptnavigation' })
      for (const label of ['Freunde', 'Vermächtnis', 'Sync', 'Profil', 'Lebensweg']) {
        const tab = within(nav).getByRole('button', { name: label })
        fireEvent.click(tab)
        expect(tab.getAttribute('aria-current')).toBe('page')
      }
    })

    it('Custom-Questions-Karte: neue Erinnerung erscheint in der Liste', async () => {
      preSeedReturningUser('Custom', 'full')

      render(<App />)

      // „Eigene Erinnerung"-Karte aufklappen.
      fireEvent.click(await screen.findByRole('heading', { name: 'Eigene Erinnerung' }))

      const titleInput = await screen.findByPlaceholderText('Titel der Erinnerung...')
      fireEvent.change(titleInput, { target: { value: 'Mein erster Schultag' } })
      fireEvent.click(screen.getByRole('button', { name: /Hinzufügen/ }))

      expect(await screen.findByText('Mein erster Schultag')).toBeTruthy()
    })
  })
})

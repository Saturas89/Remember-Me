import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

import { I18nProvider } from '../locales'
import { FeatureView } from './FeatureView'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
})

function renderDE() {
  localStorage.setItem('rm-lang', 'de')
  return render(
    <I18nProvider>
      <FeatureView />
    </I18nProvider>,
  )
}

function renderEN() {
  localStorage.setItem('rm-lang', 'en')
  return render(
    <I18nProvider>
      <FeatureView />
    </I18nProvider>,
  )
}

// ── Banner-Liste (de) ──────────────────────────────────

describe('FeatureView – Banner-Liste (de)', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/feature')
  })

  it('zeigt genau 4 Feature-Banner', () => {
    renderDE()
    expect(screen.getAllByRole('button')).toHaveLength(4)
  })

  it('öffnet die Detailseite beim Antippen eines Banners', () => {
    renderDE()
    fireEvent.click(screen.getAllByRole('button')[0])
    expect(screen.getByText('← Zurück')).toBeTruthy()
  })

  it('kehrt zur Liste zurück beim Klick auf Zurück', () => {
    renderDE()
    fireEvent.click(screen.getAllByRole('button')[0])
    fireEvent.click(screen.getByText('← Zurück'))
    expect(screen.getAllByRole('button')).toHaveLength(4)
  })
})

// ── Banner list (en) ───────────────────────────────────

describe('FeatureView – Banner list (en)', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/feature')
  })

  it('shows exactly 4 feature banners', () => {
    renderEN()
    expect(screen.getAllByRole('button')).toHaveLength(4)
  })

  it('opens the detail page when tapping a banner', () => {
    renderEN()
    fireEvent.click(screen.getAllByRole('button')[0])
    expect(screen.getByText('← Back')).toBeTruthy()
  })

  it('returns to the banner list after clicking Back', () => {
    renderEN()
    fireEvent.click(screen.getAllByRole('button')[0])
    fireEvent.click(screen.getByText('← Back'))
    expect(screen.getAllByRole('button')).toHaveLength(4)
  })
})

// ── URL-Routing ────────────────────────────────────────

describe('FeatureView – URL-Routing', () => {
  it('pusht die Feature-URL beim Öffnen eines Banners', () => {
    window.history.pushState({}, '', '/feature')
    const pushSpy = vi.spyOn(window.history, 'pushState')
    renderDE()
    fireEvent.click(screen.getAllByRole('button')[0])
    expect(pushSpy).toHaveBeenCalledWith({}, '', '/feature/automatische-lebensgeschichte')
  })

  it('pusht /feature beim Schließen der Detailseite', () => {
    window.history.pushState({}, '', '/feature')
    renderDE()
    fireEvent.click(screen.getAllByRole('button')[0])
    const pushSpy = vi.spyOn(window.history, 'pushState')
    fireEvent.click(screen.getByText('← Zurück'))
    expect(pushSpy).toHaveBeenCalledWith({}, '', '/feature')
  })

  it('zeigt die Detailseite direkt wenn URL einen Sub-Pfad hat (de)', () => {
    window.history.pushState({}, '', '/feature/lebenszeitlinie')
    renderDE()
    expect(screen.getByText('← Zurück')).toBeTruthy()
    expect(screen.getByText('Lebenszeitlinie')).toBeTruthy()
  })

  it('shows detail page directly via URL sub-path (en)', () => {
    window.history.pushState({}, '', '/feature/lebenszeitlinie')
    renderEN()
    expect(screen.getByText('← Back')).toBeTruthy()
    expect(screen.getByText('Life Timeline')).toBeTruthy()
  })

  it('zeigt die Liste wenn die URL kein bekanntes Feature enthält', () => {
    window.history.pushState({}, '', '/feature/unbekannt')
    renderDE()
    expect(screen.getAllByRole('button')).toHaveLength(4)
  })
})

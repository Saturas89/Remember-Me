import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

import { FeatureView } from './FeatureView'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// ── Banner-Liste ───────────────────────────────────────

describe('FeatureView – Banner-Liste', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/feature')
  })

  it('zeigt genau 5 Feature-Banner', () => {
    render(<FeatureView />)
    expect(screen.getAllByRole('button')).toHaveLength(5)
  })

  it('öffnet die Detailseite beim Antippen eines Banners', () => {
    render(<FeatureView />)
    fireEvent.click(screen.getAllByRole('button')[0])
    expect(screen.getByText('← Zurück')).toBeTruthy()
  })

  it('kehrt zur Liste zurück beim Klick auf Zurück', () => {
    render(<FeatureView />)
    fireEvent.click(screen.getAllByRole('button')[0])
    fireEvent.click(screen.getByText('← Zurück'))
    expect(screen.getAllByRole('button')).toHaveLength(5)
  })
})

// ── URL-Routing ────────────────────────────────────────

describe('FeatureView – URL-Routing', () => {
  it('pusht die Feature-URL beim Öffnen eines Banners', () => {
    window.history.pushState({}, '', '/feature')
    const pushSpy = vi.spyOn(window.history, 'pushState')
    render(<FeatureView />)
    fireEvent.click(screen.getAllByRole('button')[0])
    expect(pushSpy).toHaveBeenCalledWith({}, '', '/feature/automatische-lebensgeschichte')
  })

  it('pusht /feature beim Schließen der Detailseite', () => {
    window.history.pushState({}, '', '/feature')
    render(<FeatureView />)
    fireEvent.click(screen.getAllByRole('button')[0])
    const pushSpy = vi.spyOn(window.history, 'pushState')
    fireEvent.click(screen.getByText('← Zurück'))
    expect(pushSpy).toHaveBeenCalledWith({}, '', '/feature')
  })

  it('zeigt die Detailseite direkt wenn URL einen Sub-Pfad hat', () => {
    window.history.pushState({}, '', '/feature/lebenszeitlinie')
    render(<FeatureView />)
    expect(screen.getByText('← Zurück')).toBeTruthy()
    expect(screen.getByText('Lebenszeitlinie')).toBeTruthy()
  })

  it('zeigt die Liste wenn die URL kein bekanntes Feature enthält', () => {
    window.history.pushState({}, '', '/feature/unbekannt')
    render(<FeatureView />)
    expect(screen.getAllByRole('button')).toHaveLength(5)
  })
})

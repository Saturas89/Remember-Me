import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

vi.mock('@vercel/analytics', () => ({ track: vi.fn() }))

import { track } from '@vercel/analytics'
import { FeatureView } from './FeatureView'

const mockTrack = vi.mocked(track)

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.clearAllMocks()
})

// ── Banner-Liste ───────────────────────────────────────

describe('FeatureView – Banner-Liste', () => {
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

// ── Einmal-Abstimmung ──────────────────────────────────

describe('FeatureView – Einmal-Abstimmung', () => {
  it('löst track() beim ersten Antippen aus', () => {
    render(<FeatureView />)
    fireEvent.click(screen.getAllByRole('button')[0])
    expect(mockTrack).toHaveBeenCalledTimes(1)
    expect(mockTrack).toHaveBeenCalledWith(
      'feature_interest',
      expect.objectContaining({ feature: 'automatische-lebensgeschichte' })
    )
  })

  it('löst track() beim zweiten Antippen desselben Banners nicht erneut aus', () => {
    render(<FeatureView />)
    fireEvent.click(screen.getAllByRole('button')[0])   // erstes Antippen → track feuert
    fireEvent.click(screen.getByText('← Zurück'))       // zurück zur Liste
    fireEvent.click(screen.getAllByRole('button')[0])   // zweites Antippen → kein track
    expect(mockTrack).toHaveBeenCalledTimes(1)
  })

  it('setzt das localStorage-Flag nach dem ersten Antippen', () => {
    render(<FeatureView />)
    fireEvent.click(screen.getAllByRole('button')[0])
    expect(localStorage.getItem('feature-voted-automatische-lebensgeschichte')).toBe('1')
  })

  it('track() feuert unabhängig für verschiedene Features', () => {
    render(<FeatureView />)
    fireEvent.click(screen.getAllByRole('button')[0])   // Feature 1
    fireEvent.click(screen.getByText('← Zurück'))
    fireEvent.click(screen.getAllByRole('button')[1])   // Feature 2
    expect(mockTrack).toHaveBeenCalledTimes(2)
  })
})

// ── Abgestimmt-Badge ───────────────────────────────────

describe('FeatureView – Abgestimmt-Badge', () => {
  it('zeigt kein Badge vor dem ersten Antippen', () => {
    render(<FeatureView />)
    expect(screen.queryByText('✓ Abgestimmt')).toBeNull()
  })

  it('zeigt Badge nach dem ersten Antippen', () => {
    render(<FeatureView />)
    fireEvent.click(screen.getAllByRole('button')[0])
    fireEvent.click(screen.getByText('← Zurück'))
    expect(screen.getByText('✓ Abgestimmt')).toBeTruthy()
  })

  it('zeigt Badge beim Start wenn localStorage-Flag gesetzt ist', () => {
    localStorage.setItem('feature-voted-automatische-lebensgeschichte', '1')
    render(<FeatureView />)
    expect(screen.getByText('✓ Abgestimmt')).toBeTruthy()
  })

  it('zeigt Badge nur für Features mit gesetztem Flag', () => {
    localStorage.setItem('feature-voted-automatische-lebensgeschichte', '1')
    localStorage.setItem('feature-voted-privater-sync', '1')
    render(<FeatureView />)
    expect(screen.getAllByText('✓ Abgestimmt')).toHaveLength(2)
  })

  it('zeigt kein Badge für Features ohne Flag', () => {
    localStorage.setItem('feature-voted-automatische-lebensgeschichte', '1')
    render(<FeatureView />)
    // Nur 1 von 5 Bannern hat ein Badge
    expect(screen.getAllByText('✓ Abgestimmt')).toHaveLength(1)
  })
})

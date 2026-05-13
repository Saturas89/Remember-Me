import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { SandraShareStep } from './SandraShareStep'
import { SANDRA_FLOW_DE } from '../../i18n/de/sandraFlow'
import { SANDRA_FLOW_EN } from '../../i18n/en/sandraFlow'
import type { ComposedQuestion, SandraAnchor } from '../../types/sandraFlow'

// ─────────────────────────────────────────────────────────────────────────────
// SandraShareStep – Screen 6 of Sandra-Flow.
//
// Implementation Agent contract (SandraShareStep.tsx):
//   props: { t, anchor, questions, onShareSync, onShareUpgrade, onBack, onClearDraft }
//   Share CTA: data-testid="sandra-share-cta"
//
// SPEC contract (§4 Screen 6):
//   - Header: „Schick {anrede} deine {count} Fragen"
//   - No QR-code element
//   - No visible pack-code string
//   - Relationship-send hint appears IFF ≥1 question has group='relationship'
//   - Privacy hint always rendered
//   - Single primary action „An {anrede} senden" / „Send to {anrede}"
// ─────────────────────────────────────────────────────────────────────────────

afterEach(cleanup)

function makeQ(
  id: string,
  group: 'biography' | 'relationship' = 'biography',
  text = 'Frage Text',
): ComposedQuestion {
  return {
    id,
    triggerId: 'school',
    group,
    text,
    createdAt: Date.now(),
  }
}

const ANCHOR: SandraAnchor = { relation: 'mama', anrede: 'Mama' }
const FAKE_URL = 'https://example.com/#/p/abc123-encoded-pack-code-do-not-leak'
const FAKE_ENCODED = 'abc123-encoded-pack-code-do-not-leak'

function makeProps(
  overrides: Partial<React.ComponentProps<typeof SandraShareStep>> = {},
): React.ComponentProps<typeof SandraShareStep> {
  return {
    t: SANDRA_FLOW_DE,
    anchor: ANCHOR,
    questions: [makeQ('q1')],
    preferSimpleMode: true,
    onTogglePreferSimpleMode: vi.fn(),
    onShareSync: vi.fn(() => ({ url: FAKE_URL, encoded: FAKE_ENCODED })),
    onShareUpgrade: vi.fn(async () => FAKE_URL),
    onBack: vi.fn(),
    onClearDraft: vi.fn(),
    ...overrides,
  }
}

describe('SandraShareStep – header (DE)', () => {
  it('shows DE header containing the anrede and the question count', () => {
    const { container } = render(<SandraShareStep {...makeProps({ questions: [makeQ('q1')] })} />)
    const text = container.textContent ?? ''
    expect(text).toContain('Mama')
    expect(text).toContain('1')
  })

  it('shows the count = 3 when three questions are present', () => {
    const qs = [makeQ('q1'), makeQ('q2'), makeQ('q3')]
    const { container } = render(<SandraShareStep {...makeProps({ questions: qs })} />)
    const text = container.textContent ?? ''
    expect(text).toContain('3')
    expect(text).toContain('Mama')
  })
})

describe('SandraShareStep – header (EN)', () => {
  it('shows EN header containing the anrede and the question count', () => {
    const qs = [makeQ('q1'), makeQ('q2')]
    const { container } = render(
      <SandraShareStep
        {...makeProps({ questions: qs, t: SANDRA_FLOW_EN, anchor: { relation: 'mama', anrede: 'Mom' } })}
      />,
    )
    const text = container.textContent ?? ''
    expect(text).toContain('Mom')
    expect(text).toContain('2')
  })
})

describe('SandraShareStep – no QR / no visible pack-code', () => {
  it('renders NO QR-code element', () => {
    const { container } = render(<SandraShareStep {...makeProps()} />)
    expect(container.querySelector('[data-testid="qr-code"]')).toBeNull()
    expect(container.querySelector('canvas[data-qr]')).toBeNull()
    expect(container.querySelector('svg[data-qr]')).toBeNull()
    expect(container.querySelector('[class*="qr-code"]')).toBeNull()
    expect(container.querySelector('[class*="qrcode"]')).toBeNull()
  })

  it('renders NO visible pack-code string in the DOM', () => {
    const { container } = render(<SandraShareStep {...makeProps()} />)
    // The encoded payload may legitimately live inside a hidden URL embedded
    // in event handlers, but it must NEVER appear as visible text on the page.
    const visibleText = container.textContent ?? ''
    expect(visibleText).not.toContain(FAKE_ENCODED)
  })

  it('does NOT expose any element flagged as a pack-code copy target', () => {
    const { container } = render(<SandraShareStep {...makeProps()} />)
    expect(container.querySelector('[data-testid="pack-code"]')).toBeNull()
    expect(container.querySelector('[data-testid="pack-code-display"]')).toBeNull()
    expect(container.querySelector('pre[data-pack-code]')).toBeNull()
  })
})

describe('SandraShareStep – privacy hint (always rendered)', () => {
  it('renders the DE privacy hint with the anrede substituted', () => {
    const { container } = render(<SandraShareStep {...makeProps()} />)
    const expected = SANDRA_FLOW_DE.share.privacyHint.replace('{anrede}', 'Mama')
    expect(container.textContent ?? '').toContain(expected)
  })

  it('renders the privacy hint EVEN when only one question exists', () => {
    const { container } = render(<SandraShareStep {...makeProps({ questions: [makeQ('q1')] })} />)
    // Pull just the static portion of the privacy hint to avoid templating noise.
    const stem = SANDRA_FLOW_DE.share.privacyHint.split('{anrede}')[0]
    expect(container.textContent ?? '').toContain(stem)
  })
})

describe('SandraShareStep – relationship-send hint', () => {
  it('shows the relationship hint when ≥1 relationship-group question is in pack', () => {
    const qs = [
      makeQ('q1', 'biography'),
      makeQ('q2', 'relationship'),
    ]
    const { container } = render(<SandraShareStep {...makeProps({ questions: qs })} />)
    const stem = SANDRA_FLOW_DE.share.relationshipHint.split('{anrede}')[0]
    expect(container.textContent ?? '').toContain(stem)
  })

  it('does NOT show the relationship hint when only biography questions are in pack', () => {
    const qs = [
      makeQ('q1', 'biography'),
      makeQ('q2', 'biography'),
    ]
    const { container } = render(<SandraShareStep {...makeProps({ questions: qs })} />)
    const stem = SANDRA_FLOW_DE.share.relationshipHint.split('{anrede}')[0]
    expect(container.textContent ?? '').not.toContain(stem)
  })

  it('shows the hint also when ALL questions are relationship-group', () => {
    const qs = [
      makeQ('q1', 'relationship'),
      makeQ('q2', 'relationship'),
    ]
    const { container } = render(<SandraShareStep {...makeProps({ questions: qs })} />)
    const stem = SANDRA_FLOW_DE.share.relationshipHint.split('{anrede}')[0]
    expect(container.textContent ?? '').toContain(stem)
  })
})

describe('SandraShareStep – primary share action', () => {
  it('renders the share CTA as the single primary action', () => {
    const { container } = render(<SandraShareStep {...makeProps()} />)
    expect(container.querySelectorAll('[data-testid="sandra-share-cta"]').length).toBe(1)
  })

  it('the share CTA contains the anrede (DE: "An Mama senden")', () => {
    const { container } = render(<SandraShareStep {...makeProps()} />)
    const cta = container.querySelector<HTMLButtonElement>('[data-testid="sandra-share-cta"]')!
    expect(cta.textContent ?? '').toContain('Mama')
  })

  it('the share CTA reflects the EN bundle when given English strings', () => {
    const { container } = render(
      <SandraShareStep
        {...makeProps({ t: SANDRA_FLOW_EN, anchor: { relation: 'mama', anrede: 'Mom' } })}
      />,
    )
    const cta = container.querySelector<HTMLButtonElement>('[data-testid="sandra-share-cta"]')!
    expect(cta.textContent ?? '').toContain('Mom')
  })
})

import { describe, it, expect } from 'vitest'
import { compose, composeAll, sanitizeSlot } from './templateEngine'
import type { TemplateDef } from '../../types/sandraFlow'

// ─────────────────────────────────────────────────────────────────────────────
// templateEngine.compose – the slot-filling primitive for Sandra-Flow.
//
// Implementation Agent contract (templateEngine.ts):
//   compose(template, anrede, seed) → string | null
//     - {anrede} and {seed} placeholders are replaced verbatim
//     - If seed is empty (length === 0 after sanitize) AND no withoutSeed
//       variant is defined → returns null (caller filters it out)
//     - If seed is empty AND withoutSeed exists → uses withoutSeed
//     - sanitizeSlot strips `<`, `>`, backtick from user-controlled strings
//
// SPEC contract (§3 + §4):
//   - {anrede} XSS-safe (no script execution downstream)
//   - Unicode / umlauts / apostrophes preserved (only `<`, `>`, ` are stripped)
// ─────────────────────────────────────────────────────────────────────────────

const T_BOTH: TemplateDef = {
  id: 'tpl-both',
  withSeed: 'Wann hast du, {anrede}, {seed} erlebt?',
  withoutSeed: 'Was war für dich, {anrede}, ein prägender Moment?',
}

const T_WITH_ONLY: TemplateDef = {
  id: 'tpl-with-only',
  withSeed: 'Erzähl mir mehr über {seed}, {anrede}.',
}

describe('compose() – slot filling', () => {
  it('replaces both {anrede} and {seed} when both are present', () => {
    expect(compose(T_BOTH, 'Mama', 'Schulzeit')).toBe(
      'Wann hast du, Mama, Schulzeit erlebt?',
    )
  })

  it('uses withoutSeed when seed is empty string', () => {
    expect(compose(T_BOTH, 'Papa', '')).toBe(
      'Was war für dich, Papa, ein prägender Moment?',
    )
  })

  it('uses withoutSeed when seed is only whitespace (sanitizeSlot trims)', () => {
    expect(compose(T_BOTH, 'Oma', '   ')).toBe(
      'Was war für dich, Oma, ein prägender Moment?',
    )
  })

  it('uses withoutSeed when seed is undefined', () => {
    expect(compose(T_BOTH, 'Tante', undefined)).toBe(
      'Was war für dich, Tante, ein prägender Moment?',
    )
  })

  it('returns null when seed is empty AND there is no withoutSeed', () => {
    expect(compose(T_WITH_ONLY, 'Tante', '')).toBeNull()
    expect(compose(T_WITH_ONLY, 'Tante', '   ')).toBeNull()
    expect(compose(T_WITH_ONLY, 'Tante', undefined)).toBeNull()
  })

  it('still substitutes withSeed when seed is provided even if withoutSeed exists', () => {
    const out = compose(T_BOTH, 'Mama', 'das erste Auto')
    expect(out).toContain('das erste Auto')
    expect(out).not.toContain('prägender Moment')
  })
})

describe('compose() – XSS safety on {anrede}', () => {
  it('sanitizeSlot strips <, > and backticks from the anrede slot', () => {
    // Defence-in-depth: the *value itself* is stripped of HTML-significant
    // characters, so even if a consumer ever rendered the string as HTML by
    // mistake, no script tag would be reconstructable from it.
    const out = compose(T_BOTH, '<script>alert(1)</script>', 'X')
    expect(out).not.toBeNull()
    expect(out!).not.toContain('<')
    expect(out!).not.toContain('>')
    // The harmless text inside is allowed to remain.
    expect(out!).toContain('scriptalert(1)/script')
  })

  it('sanitizeSlot strips backticks (potential template-literal injection guard)', () => {
    expect(sanitizeSlot('Mama `evil`')).toBe('Mama evil')
  })

  it('preserves double quotes as plain text (not stripped)', () => {
    const out = compose(T_BOTH, `Mama "lieb"`, 'X')
    expect(out).toContain('Mama "lieb"')
  })
})

describe('compose() – Unicode + edge characters in seed', () => {
  it('preserves German umlauts and ß', () => {
    const out = compose(T_BOTH, 'Mama', 'Großtante')
    expect(out).toContain('Großtante')
  })

  it('preserves apostrophes and digits', () => {
    const out = compose(T_BOTH, 'Mama', "70er Jahre")
    expect(out).toContain('70er Jahre')
  })

  it('preserves emoji + multi-byte characters', () => {
    const out = compose(T_BOTH, 'Mama', '❤️ Kindheit')
    expect(out).toContain('❤️ Kindheit')
  })
})

describe('composeAll() – batch filter', () => {
  it('returns only templates that can render given the seed state', () => {
    const out = composeAll([T_BOTH, T_WITH_ONLY], 'Mama', '')
    // T_WITH_ONLY has no withoutSeed → dropped when seed is empty.
    expect(out).toHaveLength(1)
    expect(out[0].template.id).toBe('tpl-both')
    expect(out[0].text).toContain('prägender Moment')
  })

  it('returns ALL templates when seed is provided', () => {
    const out = composeAll([T_BOTH, T_WITH_ONLY], 'Mama', 'Schule')
    expect(out).toHaveLength(2)
  })
})

describe('compose() – no isPrivate / no private toggle leakage', () => {
  it('returns a plain string with no `isPrivate` metadata anywhere', () => {
    const out = compose(T_BOTH, 'Mama', 'X')
    expect(typeof out).toBe('string')
    expect(out).not.toContain('isPrivate')
    expect(out).not.toMatch(/private/i)
  })
})

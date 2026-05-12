import { describe, it, expect } from 'vitest'
import {
  getPersonalQuestionTriggers,
  getFreeformTrigger,
  getInspirationQuestions,
  findTrigger,
} from './loadPersonalQuestions'
import type { TriggerDef } from '../types/sandraFlow'

// ─────────────────────────────────────────────────────────────────────────────
// loadPersonalQuestions – locale-keyed bank loader for Sandra-Flow.
//
// Implementation Agent contract:
//   getPersonalQuestionTriggers(locale)  → TriggerDef[]
//   getFreeformTrigger(locale)           → TriggerDef
//   getInspirationQuestions(locale, id)  → string[]
//   findTrigger(locale, id)              → TriggerDef | undefined
//
// SPEC §10 contract:
//   - DE and EN expose the SAME trigger IDs (parity)
//   - Every trigger has ≥1 template
//   - Sections A 'biography' (6 triggers) and B 'relationship' (4 triggers)
//     are both present
// ─────────────────────────────────────────────────────────────────────────────

describe('getPersonalQuestionTriggers – locale resolution', () => {
  it('returns triggers for DE', () => {
    const de = getPersonalQuestionTriggers('de')
    expect(de.length).toBeGreaterThan(0)
  })

  it('returns triggers for EN', () => {
    const en = getPersonalQuestionTriggers('en')
    expect(en.length).toBeGreaterThan(0)
  })

  it('DE and EN are distinct objects (not aliases)', () => {
    expect(getPersonalQuestionTriggers('de')).not.toBe(getPersonalQuestionTriggers('en'))
  })
})

describe('DE/EN parity – trigger ids match exactly', () => {
  it('DE and EN expose the SAME trigger IDs', () => {
    const de = getPersonalQuestionTriggers('de').map(t => t.id).sort()
    const en = getPersonalQuestionTriggers('en').map(t => t.id).sort()
    expect(en).toEqual(de)
  })

  it('every EN trigger has at least one template (no holes)', () => {
    for (const trigger of getPersonalQuestionTriggers('en')) {
      expect(trigger.templates.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('every DE trigger has at least one template (no holes)', () => {
    for (const trigger of getPersonalQuestionTriggers('de')) {
      expect(trigger.templates.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('groups (biography / relationship) match per trigger id across locales', () => {
    const deByid: Record<string, TriggerDef> = Object.fromEntries(
      getPersonalQuestionTriggers('de').map(t => [t.id, t]),
    )
    const enByid: Record<string, TriggerDef> = Object.fromEntries(
      getPersonalQuestionTriggers('en').map(t => [t.id, t]),
    )
    for (const id of Object.keys(deByid)) {
      expect(enByid[id]).toBeDefined()
      expect(enByid[id].group).toBe(deByid[id].group)
    }
  })
})

describe('section coverage (SPEC §4 Screen 3)', () => {
  it('exposes biography triggers (Section A „Über sie/ihn") in both locales', () => {
    for (const locale of ['de', 'en'] as const) {
      const bio = getPersonalQuestionTriggers(locale).filter(t => t.group === 'biography')
      expect(bio.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('exposes relationship triggers (Section B „Über uns zwei") in both locales', () => {
    for (const locale of ['de', 'en'] as const) {
      const rel = getPersonalQuestionTriggers(locale).filter(t => t.group === 'relationship')
      expect(rel.length).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('TriggerDef shape', () => {
  it('each trigger has id, group, title, templates[]', () => {
    for (const trigger of getPersonalQuestionTriggers('de')) {
      expect(typeof trigger.id).toBe('string')
      expect(trigger.id.length).toBeGreaterThan(0)
      expect(['biography', 'relationship']).toContain(trigger.group)
      expect(typeof trigger.title).toBe('string')
      expect(trigger.title.length).toBeGreaterThan(0)
      expect(Array.isArray(trigger.templates)).toBe(true)
    }
  })

  it('each template has id + withSeed; withoutSeed is optional', () => {
    for (const locale of ['de', 'en'] as const) {
      for (const trigger of getPersonalQuestionTriggers(locale)) {
        for (const tpl of trigger.templates) {
          expect(typeof tpl.id).toBe('string')
          expect(typeof tpl.withSeed).toBe('string')
          expect(tpl.withSeed.length).toBeGreaterThan(0)
          if (tpl.withoutSeed !== undefined) {
            expect(typeof tpl.withoutSeed).toBe('string')
          }
        }
      }
    }
  })

  it('template ids are unique within a trigger', () => {
    for (const locale of ['de', 'en'] as const) {
      for (const trigger of getPersonalQuestionTriggers(locale)) {
        const ids = trigger.templates.map(t => t.id)
        expect(new Set(ids).size).toBe(ids.length)
      }
    }
  })

  it('trigger ids are globally unique within a locale', () => {
    for (const locale of ['de', 'en'] as const) {
      const ids = getPersonalQuestionTriggers(locale).map(t => t.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})

describe('getFreeformTrigger – escape hatch', () => {
  it('returns a freeform trigger for both locales', () => {
    expect(getFreeformTrigger('de')).toBeDefined()
    expect(getFreeformTrigger('en')).toBeDefined()
  })

  it('freeform trigger has the special id "freeform" and a templates array', () => {
    // Freeform is the escape hatch: the user composes a question without
    // any suggestion. The trigger therefore intentionally has an empty
    // templates list — but the array must still exist so consumers can
    // iterate over it without null checks.
    for (const locale of ['de', 'en'] as const) {
      const f = getFreeformTrigger(locale)
      expect(f.id).toBe('freeform')
      expect(Array.isArray(f.templates)).toBe(true)
    }
  })
})

describe('findTrigger – id lookup', () => {
  it('returns the matching trigger when the id exists', () => {
    const first = getPersonalQuestionTriggers('de')[0]
    expect(findTrigger('de', first.id)).toBe(first)
  })

  it('returns the freeform trigger for the magic id "freeform"', () => {
    expect(findTrigger('de', 'freeform')).toBe(getFreeformTrigger('de'))
    expect(findTrigger('en', 'freeform')).toBe(getFreeformTrigger('en'))
  })

  it('returns undefined for an unknown id', () => {
    expect(findTrigger('de', 'no-such-trigger-id-xyz')).toBeUndefined()
  })
})

describe('getInspirationQuestions', () => {
  it('returns [] for unknown trigger ids', () => {
    expect(getInspirationQuestions('de', 'no-such-id')).toEqual([])
    expect(getInspirationQuestions('en', 'no-such-id')).toEqual([])
  })
})

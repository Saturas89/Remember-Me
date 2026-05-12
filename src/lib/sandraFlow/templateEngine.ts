// Template engine for the Sandra-first flow.
//
// `compose(template, anrede, seed)` returns the final question text by
// substituting the `{anrede}` and `{seed}` placeholders. If `seed` is empty
// the engine falls back to `template.withoutSeed` (and returns null if that
// isn't defined either).
//
// XSS safety: substitution is performed in plain string space. The result is
// only ever rendered as text (never as innerHTML / dangerouslySetInnerHTML),
// but as a defence-in-depth measure we strip any `<`, `>` and backtick chars
// from user-controlled inputs (`anrede`, `seed`) before substitution.

import type { TemplateDef } from '../../types/sandraFlow'

/** Strip characters that would be dangerous if the result were ever
 *  accidentally rendered as HTML. The result is still always rendered as
 *  text, but stripping at the seam means the *value itself* is safe. */
export function sanitizeSlot(value: string): string {
  return value.replace(/[<>`]/g, '').trim()
}

const SEED_MIN_LENGTH = 1

/**
 * Substitute `{anrede}` and `{seed}` in a template string.
 *
 * If the seed is empty (or shorter than SEED_MIN_LENGTH) AND the template only
 * has a `withSeed` variant, returns `null` so the caller can skip rendering
 * this template until the user has typed something.
 *
 * @returns final question text, or `null` if the template requires a seed
 *          and none was provided.
 */
export function compose(
  template: TemplateDef,
  anrede: string,
  seed: string | undefined,
): string | null {
  const safeAnrede = sanitizeSlot(anrede)
  const safeSeed = sanitizeSlot(seed ?? '')
  const hasSeed = safeSeed.length >= SEED_MIN_LENGTH

  const source = hasSeed ? template.withSeed : template.withoutSeed
  if (!source) return null

  return source.replace(/\{anrede\}/g, safeAnrede).replace(/\{seed\}/g, safeSeed)
}

/** Returns all templates that can currently render given the seed state. */
export function composeAll(
  templates: TemplateDef[],
  anrede: string,
  seed: string | undefined,
): Array<{ template: TemplateDef; text: string }> {
  const out: Array<{ template: TemplateDef; text: string }> = []
  for (const template of templates) {
    const text = compose(template, anrede, seed)
    if (text !== null) out.push({ template, text })
  }
  return out
}

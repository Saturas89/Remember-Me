// Locale-aware loader for the Sandra-flow trigger bank and inspiration drawer.
//
// Picks the right language based on the i18n locale. Falls back to German
// (the original authoring language) for unknown locales.

import type { Locale } from '../locales'
import type { TriggerDef } from '../types/sandraFlow'
import {
  PERSONAL_QUESTION_TRIGGERS_DE,
  FREEFORM_TRIGGER_DE,
} from './personalQuestionTemplates.de'
import {
  PERSONAL_QUESTION_TRIGGERS_EN,
  FREEFORM_TRIGGER_EN,
} from './personalQuestionTemplates.en'
import { INSPIRATION_QUESTIONS_DE } from './inspirationQuestions.de'
import { INSPIRATION_QUESTIONS_EN } from './inspirationQuestions.en'

export function getPersonalQuestionTriggers(locale: Locale): TriggerDef[] {
  if (locale === 'en') return PERSONAL_QUESTION_TRIGGERS_EN
  return PERSONAL_QUESTION_TRIGGERS_DE
}

export function getFreeformTrigger(locale: Locale): TriggerDef {
  if (locale === 'en') return FREEFORM_TRIGGER_EN
  return FREEFORM_TRIGGER_DE
}

/** Returns the inspiration examples for a given trigger id, or [] if none. */
export function getInspirationQuestions(locale: Locale, triggerId: string): string[] {
  const bank = locale === 'en' ? INSPIRATION_QUESTIONS_EN : INSPIRATION_QUESTIONS_DE
  return bank[triggerId] ?? []
}

/** Convenience lookup: get a trigger by id for the active locale. */
export function findTrigger(locale: Locale, triggerId: string): TriggerDef | undefined {
  if (triggerId === 'freeform') return getFreeformTrigger(locale)
  return getPersonalQuestionTriggers(locale).find(t => t.id === triggerId)
}

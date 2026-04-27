import { REMINDER_MESSAGES } from '../data/reminderMessages'
import { getCategoriesForLocale } from '../data/categories'
import type { Locale } from '../locales'
import type { Answer, Question } from '../types'

export interface NotificationContentResult {
  title: string
  body: string
  questionId?: string
}

export interface ReminderState {
  permission: 'none' | 'enabled' | 'dismissed'
  backoffStage: 0 | 1 | 2 | 3
  lastShownAt?: number
  lastVariantIdx?: number
}

export function selectReminderVariant(
  locale: Locale,
  lastVariantIdx?: number
): { message: string; nextVariantIdx: number } {
  const messages = REMINDER_MESSAGES[locale]
  
  // Avoid repeating the same message by rotating through the pool
  let nextIdx = (lastVariantIdx ?? -1) + 1
  if (nextIdx >= messages.length) {
    nextIdx = 0
  }
  
  // Double-check we don't repeat if possible
  if (messages.length > 1 && nextIdx === lastVariantIdx) {
    nextIdx = (nextIdx + 1) % messages.length
  }
  
  return {
    message: messages[nextIdx],
    nextVariantIdx: nextIdx
  }
}

export function findNextUnansweredQuestion(
  answers: Record<string, Answer>,
  locale: Locale
): Question | null {
  const categories = getCategoriesForLocale(locale)
  
  for (const category of categories) {
    for (const question of category.questions) {
      const answer = answers[question.id]
      if (!answer || (!answer.value.trim() && !(answer.imageIds?.length))) {
        return question
      }
    }
  }
  
  return null
}

export function generateNotificationContent(
  locale: Locale,
  answers: Record<string, Answer>,
  profileName: string,
  lastVariantIdx?: number
): NotificationContentResult {
  const nextQuestion = findNextUnansweredQuestion(answers, locale)
  const { message, nextVariantIdx } = selectReminderVariant(locale, lastVariantIdx)
  
  const title = locale === 'de' 
    ? 'Zeit für Erinnerungen! ✨'
    : 'Time for memories! ✨'
  
  let body: string
  let questionId: string | undefined
  
  if (nextQuestion) {
    // Use personalized question text if available
    const questionText = nextQuestion.text.replace('{name}', profileName)
    body = locale === 'de'
      ? `Nächste Frage: "${questionText}"`
      : `Next question: "${questionText}"`
    questionId = nextQuestion.id
  } else {
    // Use random variant from pool
    body = message
  }
  
  return {
    title,
    body,
    questionId
  }
}

export function calculateNextReminderTime(backoffStage: 0 | 1 | 2 | 3): number {
  const now = Date.now()
  
  switch (backoffStage) {
    case 0:
    case 1:
      // 3 days after last activity
      return now + (3 * 24 * 60 * 60 * 1000)
    case 2:
      // 7 more days (total 10)
      return now + (7 * 24 * 60 * 60 * 1000)
    case 3:
      // 14 more days (total 24)
      return now + (14 * 24 * 60 * 60 * 1000)
    default:
      // No more reminders after stage 3
      return now + (365 * 24 * 60 * 60 * 1000) // Far future
  }
}

export function adjustForSilentHours(timestamp: number): number {
  const date = new Date(timestamp)
  const hours = date.getHours()
  
  // Silent hours: 22:00 - 8:00 local time
  if (hours >= 22 || hours < 8) {
    // Move to 8:00 AM same day or next day
    const adjusted = new Date(date)
    if (hours >= 22) {
      // Move to next day 8:00 AM
      adjusted.setDate(adjusted.getDate() + 1)
    }
    adjusted.setHours(8, 0, 0, 0)
    return adjusted.getTime()
  }
  
  return timestamp
}
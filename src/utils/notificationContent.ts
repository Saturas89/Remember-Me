import { REMINDER_MESSAGES } from '../data/reminderMessages'

export interface NotificationContentOptions {
  locale: 'de' | 'en'
  questionTitle?: string
  lastVariantIdx?: number
}

export interface NotificationContentResult {
  title: string
  body: string
  variantIdx: number
}

export function getNotificationContent(opts: NotificationContentOptions): NotificationContentResult {
  const { locale, questionTitle, lastVariantIdx } = opts
  const messages = REMINDER_MESSAGES[locale]
  
  // Rotate to avoid repeating the same variant immediately
  let nextIdx = 0
  if (lastVariantIdx !== undefined && lastVariantIdx !== -1) {
    nextIdx = (lastVariantIdx + 1) % messages.length
  }
  
  const body = questionTitle || messages[nextIdx]
  
  return {
    title: 'Remember Me',
    body,
    variantIdx: nextIdx
  }
}
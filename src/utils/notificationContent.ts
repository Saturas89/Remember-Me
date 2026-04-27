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

/**
 * Wählt eine Variante aus REMINDER_MESSAGES[locale], rotiert deterministisch
 * vorbei an lastVariantIdx (kein Wiederholen direkt hintereinander),
 * setzt body = questionTitle wenn übergeben.
 */
export function getNotificationContent(opts: NotificationContentOptions): NotificationContentResult {
  const { locale, questionTitle, lastVariantIdx } = opts
  const messages = REMINDER_MESSAGES[locale]
  
  // Find next variant index, avoiding the last one used
  let variantIdx = 0
  if (typeof lastVariantIdx === 'number' && lastVariantIdx >= 0) {
    // Pick next index, wrapping around but avoiding the same one
    variantIdx = (lastVariantIdx + 1) % messages.length
  } else {
    // First time or invalid index, pick randomly
    variantIdx = Math.floor(Math.random() * messages.length)
  }
  
  const title = messages[variantIdx]
  const body = questionTitle || (locale === 'de' 
    ? 'Beantworte weitere Fragen zu deinen Erinnerungen.'
    : 'Answer more questions about your memories.')
  
  return { title, body, variantIdx }
}
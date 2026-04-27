import { REMINDER_MESSAGES } from '../data/reminderMessages'

export interface NotificationContentOptions {
  locale: 'de' | 'en'
  questionTitle?: string         // wenn vorhanden, wird im Body verwendet
  lastVariantIdx?: number        // ≥0; -1 oder undefined = "keine Vorgängervariante"
}

export interface NotificationContentResult {
  title: string
  body: string
  variantIdx: number             // gewählter Pool-Index, für Persistierung
}

/**
 * Wählt eine Variante aus REMINDER_MESSAGES[locale], rotiert deterministisch
 * vorbei an lastVariantIdx (kein Wiederholen direkt hintereinander),
 * setzt body = questionTitle wenn übergeben.
 */
export function getNotificationContent(opts: NotificationContentOptions): NotificationContentResult {
  const { locale, questionTitle, lastVariantIdx } = opts
  const messages = REMINDER_MESSAGES[locale]
  
  // Select variant index, avoiding the last used one
  let variantIdx = 0
  if (messages.length > 1) {
    if (lastVariantIdx === undefined || lastVariantIdx === -1) {
      // No previous variant, pick first
      variantIdx = 0
    } else {
      // Pick next variant, wrapping around but avoiding the last one
      variantIdx = (lastVariantIdx + 1) % messages.length
    }
  }
  
  const title = messages[variantIdx]
  const body = questionTitle || (locale === 'de' 
    ? 'Schreibe weiter an deinem Vermächtnis!'
    : 'Continue writing your legacy!')
  
  return {
    title,
    body,
    variantIdx
  }
}
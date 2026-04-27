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

export function getNotificationContent(opts: NotificationContentOptions): NotificationContentResult {
  const { locale, questionTitle, lastVariantIdx } = opts
  const messages = REMINDER_MESSAGES[locale]
  
  // Select a variant that's different from the last one
  let variantIdx: number
  if (messages.length <= 1) {
    variantIdx = 0
  } else if (lastVariantIdx === undefined || lastVariantIdx === -1) {
    // No previous variant, choose randomly
    variantIdx = Math.floor(Math.random() * messages.length)
  } else {
    // Avoid the same variant as last time
    do {
      variantIdx = Math.floor(Math.random() * messages.length)
    } while (variantIdx === lastVariantIdx && messages.length > 1)
  }
  
  const title = messages[variantIdx]
  
  // Use question title in body if provided, otherwise use a generic message
  const body = questionTitle 
    ? (locale === 'de' ? `Nächste Frage: "${questionTitle}"` : `Next question: "${questionTitle}"`)
    : (locale === 'de' ? 'Schreibe weiter an deinem Vermächtnis.' : 'Continue writing your legacy.')
  
  return {
    title,
    body,
    variantIdx
  }
}
/**
 * Maps the app's two-letter locale code to a BCP-47 tag for
 * date/datetime formatting APIs (Intl.DateTimeFormat, toLocaleDateString, etc.).
 *
 *   de → de-DE
 *   en → en-GB  (day-first format, 24-hour clock — consistent with our EU user base)
 */
export function localeTag(locale: string): string {
  return locale === 'en' ? 'en-GB' : 'de-DE'
}

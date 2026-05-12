// Locale-aware accessor for Sandra-flow strings. Used by the Sandra-flow
// components and the receiver-side Friends-Receive modifications.

import { useTranslation } from '../locales'
import { SANDRA_FLOW_DE } from './de/sandraFlow'
import { SANDRA_FLOW_EN } from './en/sandraFlow'

export function useSandraFlowStrings() {
  const { locale } = useTranslation()
  return locale === 'en' ? SANDRA_FLOW_EN : SANDRA_FLOW_DE
}

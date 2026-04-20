import type { Translations } from '../types'
import { UI_DE } from './ui'
import { CATEGORIES_DE } from './categories'
import { FRIEND_TOPICS_DE } from './friendTopics'
import { FAQ_DE } from './faq'
import { FEATURES_DE } from './features'

export const de: Translations = {
  locale: 'de',
  ...UI_DE,
  faq: {
    topbarTitle: 'Hilfe & FAQ',
    intro: 'Deine Erinnerungen sind sicher – hier erfährst du, wie und warum.',
    footer: 'Noch eine Frage? Feedback oder Fehler melden unter remember-me.app.',
    sections: FAQ_DE,
  },
  feature: {
    ...UI_DE.feature,
    features: FEATURES_DE as unknown as Translations['feature']['features'],
  },
  categories: CATEGORIES_DE,
  friendTopics: FRIEND_TOPICS_DE,
}

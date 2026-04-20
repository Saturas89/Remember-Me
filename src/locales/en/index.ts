import type { Translations } from '../types'
import { UI_EN } from './ui'
import { CATEGORIES_EN } from './categories'
import { FRIEND_TOPICS_EN } from './friendTopics'
import { FAQ_EN } from './faq'
import { FEATURES_EN } from './features'

export const en: Translations = {
  locale: 'en',
  ...UI_EN,
  faq: {
    topbarTitle: 'Help & FAQ',
    intro: 'Your memories are safe – here\'s how and why.',
    footer: 'Have another question? Report feedback or bugs at remember-me.app.',
    sections: FAQ_EN,
  },
  feature: {
    ...UI_EN.feature,
    features: FEATURES_EN as unknown as Translations['feature']['features'],
  },
  categories: CATEGORIES_EN,
  friendTopics: FRIEND_TOPICS_EN,
}

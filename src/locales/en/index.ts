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
  impressum: {
    topbarTitle: 'Legal notice',
    intro: 'Provider information pursuant to § 5 DDG (German Digital Services Act) and § 18 (2) MStV (Interstate Media Treaty).',
    providerHeading: 'Provider',
    contactHeading: 'Contact',
    contactEmailLabel: 'Email',
    responsibleHeading: 'Responsible for content per § 18 (2) MStV',
    responsibleNote: 'Identical to the provider above.',
    disputeHeading: 'Dispute resolution',
    disputeOsLabel: 'European Commission platform for online dispute resolution',
    disputeOsHref: 'https://ec.europa.eu/consumers/odr/',
    disputeNote: 'We are neither willing nor obliged to participate in dispute resolution proceedings before a consumer arbitration board.',
    liabilityHeading: 'Liability for content and links',
    liabilityContent: 'As a service provider, we are responsible for our own content on this website under general law. However, we are not obliged to monitor transmitted or stored third-party information or to investigate circumstances that point to illegal activity.',
    liabilityLinks: 'Our service may contain links to external websites operated by third parties whose content we have no influence over. The respective provider or operator of the linked pages is always responsible for their content. Such links will be removed immediately if any infringement of the law becomes known.',
    copyrightHeading: 'Copyright',
    copyrightContent: 'Content created by the operators of this site is subject to German copyright law. Third-party contributions are marked as such. Duplication, processing or distribution outside the limits of copyright requires the written consent of the respective author.',
  },
  feature: {
    ...UI_EN.feature,
    features: FEATURES_EN as unknown as Translations['feature']['features'],
  },
  categories: CATEGORIES_EN,
  friendTopics: FRIEND_TOPICS_EN,
}

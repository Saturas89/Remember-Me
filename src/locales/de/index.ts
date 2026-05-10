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
  impressum: {
    topbarTitle: 'Impressum',
    intro: 'Angaben gemäß § 5 DDG (Digitale-Dienste-Gesetz) und § 18 Abs. 2 MStV (Medienstaatsvertrag).',
    providerHeading: 'Anbieter',
    contactHeading: 'Kontakt',
    contactEmailLabel: 'E-Mail',
    responsibleHeading: 'Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV',
    responsibleNote: 'Identisch mit dem Anbieter.',
    disputeHeading: 'Streitschlichtung',
    disputeOsLabel: 'Plattform der EU-Kommission zur Online-Streitbeilegung',
    disputeOsHref: 'https://ec.europa.eu/consumers/odr/',
    disputeNote: 'Wir sind nicht bereit oder verpflichtet, an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.',
    liabilityHeading: 'Haftung für Inhalte und Links',
    liabilityContent: 'Als Diensteanbieter sind wir für eigene Inhalte auf dieser Website nach den allgemeinen Gesetzen verantwortlich. Wir sind jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.',
    liabilityLinks: 'Unser Angebot kann Links zu externen Websites Dritter enthalten, auf deren Inhalte wir keinen Einfluss haben. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber verantwortlich. Bei Bekanntwerden von Rechtsverletzungen werden solche Links umgehend entfernt.',
    copyrightHeading: 'Urheberrecht',
    copyrightContent: 'Die durch die Betreiber dieser Seite erstellten Inhalte unterliegen dem deutschen Urheberrecht. Beiträge Dritter sind als solche gekennzeichnet. Vervielfältigung, Bearbeitung oder Verbreitung außerhalb der Grenzen des Urheberrechts bedürfen der schriftlichen Zustimmung des jeweiligen Urhebers.',
  },
  feature: {
    ...UI_DE.feature,
    features: FEATURES_DE as unknown as Translations['feature']['features'],
  },
  categories: CATEGORIES_DE,
  friendTopics: FRIEND_TOPICS_DE,
}

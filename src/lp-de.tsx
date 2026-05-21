import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { LpView } from './views/LpView'
import type { LpContent } from './views/LpView'

const content: LpContent = {
  howId: 'so-funktionierts',

  eyebrow: 'Bevor es zu spät ist',
  h1: 'Bewahre die Lebensgeschichten deiner Eltern, bevor sie verloren gehen.',
  heroBody:
    'Die wertvollsten Familienerinnerungen sind oft die, die nie aufgeschrieben oder aufgenommen wurden. Storyhold hilft dir dabei, die Geschichten, Erinnerungen und die Stimme deiner Eltern für die Zukunft festzuhalten.',
  ctaPrimary: 'Jetzt Erinnerungen bewahren',
  ctaSecondary: 'So funktioniert es',

  problemH2: 'In jeder Familie gibt es Geschichten, die man viel früher hätte festhalten wollen.',
  problemBody: [
    'Das Lachen eines Elternteils, Erinnerungen an die Kindheit, die Geschichte des Kennenlernens oder prägende Momente aus dem Leben — all das wirkt selbstverständlich, bis man merkt, wie schnell es verloren gehen kann.',
    'Storyhold hilft dir, diese Erinnerungen jetzt bewusst und einfühlsam zu bewahren.',
  ],

  howH2: 'So funktioniert Storyhold',
  steps: [
    { h3: 'Bedeutungsvolle Fragen auswählen', body: 'Nutze durchdachte Fragen, die echte Erinnerungen und persönliche Geschichten hervorholen.' },
    { h3: 'Geschichten einfach festhalten', body: 'Halte Erinnerungen in einem geführten, natürlichen und persönlichen Format fest.' },
    { h3: 'Für kommende Generationen bewahren', body: 'Schaffe etwas Bleibendes, auf das Kinder und Enkel immer wieder zurückblicken können.' },
  ],

  benefitsH2: 'Warum Familien Storyhold nutzen',
  benefits: [
    'Wertvolle Familienerinnerungen bewahren, bevor sie verblassen',
    'Persönliche Geschichten in einer bedeutungsvollen Form festhalten',
    'Perspektiven, Stimme und Vermächtnis der Eltern sichern',
    'Etwas schaffen, das auch für spätere Generationen wertvoll bleibt',
  ],

  proofH2: 'Das ist mehr als nur ein Erinnerungsprojekt.',
  proofBody:
    'Es ist eine Möglichkeit, die Menschen, die du liebst, durch ihre Geschichten, ihre Persönlichkeit und die prägenden Momente eurer Familie festzuhalten.',

  faqH2: 'Häufige Fragen',
  faq: [
    {
      q: 'Warum sollte ich die Geschichten meiner Eltern jetzt festhalten?',
      a: 'Weil sich der richtige Zeitpunkt oft nach später anfühlt — bis später irgendwann zu spät ist.',
    },
    {
      q: 'Welche Geschichten sollte man festhalten?',
      a: 'Kindheitserinnerungen, Familientraditionen, wichtige Wendepunkte, Lebenslektionen und persönliche Gedanken.',
    },
    {
      q: 'Ist Storyhold nur für ältere Eltern gedacht?',
      a: 'Nein. Storyhold ist für jede Familie, die Erinnerungen und Lebensgeschichten bewusst bewahren möchte.',
    },
  ],

  finalH2: 'Bewahre die Geschichten der Menschen, die du am meisten liebst.',
  finalBody: 'Beginne jetzt und schaffe etwas, für das deine Familie dir für immer dankbar sein wird.',
  finalCta: 'Mit Storyhold starten',
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LpView content={content} />
  </StrictMode>,
)

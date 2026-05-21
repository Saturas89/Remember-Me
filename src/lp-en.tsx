import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { LpView } from './views/LpView'
import type { LpContent } from './views/LpView'

const content: LpContent = {
  howId: 'how-it-works',

  eyebrow: "Before it's too late",
  h1: "Record your parents' stories before they are lost.",
  heroBody:
    "The most meaningful family memories are often the ones never written down. Storyhold helps you preserve your parents' voice, stories, and milestones in a way your family can keep forever.",
  ctaPrimary: 'Invite your mom and begin',
  ctaSecondary: 'See how it works',

  problemH2: 'Every family has stories they wish they had captured earlier.',
  problemBody: [
    "A parent's laugh, a childhood memory, the story of how they met, what life was like when they were young — these details feel permanent until suddenly they are not. Most families wait too long.",
    'Storyhold helps you capture those memories now, with care and intention.',
  ],

  howH2: 'How Storyhold works',
  steps: [
    { h3: 'Choose meaningful prompts', body: 'Use thoughtful questions designed to bring out real memories and life stories.' },
    { h3: 'Record stories with ease', body: 'Capture memories in a simple, guided format that feels natural and personal.' },
    { h3: 'Keep them for generations', body: 'Create a lasting family record your children and grandchildren can return to.' },
  ],

  benefitsH2: 'Why families use Storyhold',
  benefits: [
    'Preserve family memories before they fade',
    'Capture personal stories in a meaningful format',
    "Save a parent's perspective, voice, and legacy",
    'Create something future generations will treasure',
  ],

  proofH2: 'This is more than a memory project.',
  proofBody:
    'It is a way to hold on to the people you love — through their stories, their personality, and the moments that shaped your family.',

  faqH2: 'Frequently asked questions',
  faq: [
    {
      q: "Why should I record my parents' stories now?",
      a: 'Because the right time often feels like later — until later becomes too late.',
    },
    {
      q: 'What kinds of stories should we capture?',
      a: 'Childhood memories, family traditions, life lessons, turning points, and personal reflections.',
    },
    {
      q: 'Is Storyhold only for older parents?',
      a: 'No. It is for any family that wants to preserve memories and stories before they are forgotten.',
    },
  ],

  finalH2: 'Preserve the stories of the people you love most.',
  finalBody: 'Start now and create something your family will be grateful to have forever.',
  finalCta: 'Get started with Storyhold',
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LpView content={content} />
  </StrictMode>,
)

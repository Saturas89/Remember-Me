// English trigger bank for the Sandra-first flow (REQ-020).
//
// Semantically equivalent to the German bank in `personalQuestionTemplates.de.ts`,
// but idiomatic English rather than word-for-word.

import type { TriggerDef } from '../types/sandraFlow'

export const PERSONAL_QUESTION_TRIGGERS_EN: TriggerDef[] = [
  // ── Group A: biography ────────────────────────────────────────────────
  {
    id: 'time-rarely-spoken-of',
    group: 'biography',
    title: 'A time you rarely talk about',
    templates: [
      {
        id: 'time-rarely-spoken-of-1',
        withSeed: '{anrede}, what was {seed} really like – what comes to mind first?',
      },
      {
        id: 'time-rarely-spoken-of-2',
        withSeed: '{anrede}, what was the most beautiful thing about {seed}?',
      },
      {
        id: 'time-rarely-spoken-of-3',
        withSeed: '{anrede}, what was hardest about {seed}?',
      },
      {
        id: 'time-rarely-spoken-of-4',
        withSeed: "{anrede}, is there something about {seed} you've never told me?",
      },
    ],
  },
  {
    id: 'person-never-met',
    group: 'biography',
    title: 'A person I never got to meet',
    templates: [
      {
        id: 'person-never-met-1',
        withSeed: '{anrede}, what was {seed} really like – in your own words?',
      },
      {
        id: 'person-never-met-2',
        withSeed: '{anrede}, what would you have wanted me to know about {seed}?',
      },
      {
        id: 'person-never-met-3',
        withSeed: '{anrede}, if {seed} were sitting here today, what would they say?',
      },
    ],
  },
  {
    id: 'before-i-was-born',
    group: 'biography',
    title: 'Before I existed',
    templates: [
      {
        id: 'before-i-was-born-1',
        withSeed: '{anrede}, who were you before {seed} and I came along?',
        withoutSeed: '{anrede}, who were you before you became a parent?',
      },
    ],
  },
  {
    id: 'decision-that-changed-everything',
    group: 'biography',
    title: 'A decision that changed everything',
    templates: [
      {
        id: 'decision-that-changed-everything-1',
        withSeed: '{anrede}, was there a moment when your life tipped – something about {seed}?',
        withoutSeed: '{anrede}, which decision in your life changed everything?',
      },
    ],
  },
  {
    id: 'fragments-of-a-story',
    group: 'biography',
    title: 'Fragments of a story',
    templates: [
      {
        id: 'fragments-of-a-story-1',
        withSeed: '{anrede}, I only know half the story about {seed} – what was it really like?',
      },
    ],
  },
  {
    id: 'never-dared-to-ask',
    group: 'biography',
    title: "I never dared to ask",
    templates: [
      {
        id: 'never-dared-to-ask-1',
        withSeed: '{anrede}, I never dared to ask: {seed}?',
        withoutSeed:
          '{anrede}, is there something I never dared to ask you – but that you would tell me?',
      },
    ],
  },

  // ── Group B: relationship ─────────────────────────────────────────────
  {
    id: 'how-you-see-me',
    group: 'relationship',
    title: 'How you see me',
    templates: [
      {
        id: 'how-you-see-me-1',
        withSeed: "{anrede}, what do you see in {seed} that I might not see myself?",
        withoutSeed: '{anrede}, how do you really see me today?',
      },
      {
        id: 'how-you-see-me-2',
        withSeed: "{anrede}, what do you see in me that I might not see myself?",
        withoutSeed: "{anrede}, what do you see in me that I might not see myself?",
      },
      {
        id: 'how-you-see-me-3',
        withSeed: '{anrede}, when were you most proud of me – and when most sad about me?',
        withoutSeed: '{anrede}, when were you most proud of me – and when most sad about me?',
      },
    ],
  },
  {
    id: 'what-is-between-us',
    group: 'relationship',
    title: 'What was, or is, between us',
    templates: [
      {
        id: 'what-is-between-us-1',
        withSeed: '{anrede}, was there something about {seed} between us that we never put into words?',
        withoutSeed: '{anrede}, was there something between us that we never put into words?',
      },
      {
        id: 'what-is-between-us-2',
        withSeed: '{anrede}, what do you remember most fondly about the two of us – especially around {seed}?',
        withoutSeed: '{anrede}, what do you remember most fondly about the two of us?',
      },
      {
        id: 'what-is-between-us-3',
        withSeed: '{anrede}, is there an argument between us about {seed} that was never really resolved?',
        withoutSeed: '{anrede}, is there an argument between us that was never really resolved?',
      },
    ],
  },
  {
    id: 'what-you-would-do-differently',
    group: 'relationship',
    title: 'What you would have done differently',
    templates: [
      {
        id: 'what-you-would-do-differently-1',
        withSeed: "{anrede}, what would you have done differently raising me, especially around {seed}?",
        withoutSeed: '{anrede}, what would you have done differently raising me?',
      },
      {
        id: 'what-you-would-do-differently-2',
        withSeed: '{anrede}, what would you have wished from me back then – especially around {seed}?',
        withoutSeed: '{anrede}, what would you have wished from me back then?',
      },
      {
        id: 'what-you-would-do-differently-3',
        withSeed: '{anrede}, what would you ask my forgiveness for today – or I yours? Maybe about {seed}?',
        withoutSeed: '{anrede}, what would you ask my forgiveness for today – or I yours?',
      },
    ],
  },
  {
    id: 'what-should-remain',
    group: 'relationship',
    title: 'What should remain',
    templates: [
      {
        id: 'what-should-remain-1',
        withSeed: '{anrede}, what should I never forget that you passed on to me about {seed}?',
        withoutSeed: '{anrede}, what should I never forget that you passed on to me?',
      },
      {
        id: 'what-should-remain-2',
        withSeed: '{anrede}, which of your sayings – maybe about {seed} – should I carry on?',
        withoutSeed: '{anrede}, which of your sayings should I carry on?',
      },
      {
        id: 'what-should-remain-3',
        withSeed: '{anrede}, what would you tell my child about me – about {seed}?',
        withoutSeed: '{anrede}, what would you tell my child about me?',
      },
    ],
  },
]

/** Free-form trigger used when the user opts out of pre-set templates.
 *  The single template renders only when a seed is present (the user's own
 *  full question text), and surfaces it verbatim with the anrede prefix.
 *  Without a seed there is nothing to render — Sandra simply types directly. */
export const FREEFORM_TRIGGER_EN: TriggerDef = {
  id: 'freeform',
  group: 'biography',
  title: 'My own question',
  templates: [
    {
      id: 'freeform-1',
      withSeed: '{anrede}, {seed}',
    },
  ],
}

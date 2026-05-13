// German trigger bank for the Sandra-first flow (REQ-020).
//
// Each trigger has 3–4 template variants. Templates may contain
//   {anrede}   – how Sandra addresses the recipient (e.g. "Mama", "Omi")
//   {seed}     – the keyword Sandra typed into the composer textarea
//
// `withSeed` is used whenever the seed is non-empty.
// `withoutSeed` is an optional fallback when the seed is empty.

import type { TriggerDef } from '../types/sandraFlow'

export const PERSONAL_QUESTION_TRIGGERS_DE: TriggerDef[] = [
  // ── Group A: biography ────────────────────────────────────────────────
  {
    id: 'time-rarely-spoken-of',
    group: 'biography',
    title: 'Zeit, von der {anrede} selten spricht',
    templates: [
      {
        id: 'time-rarely-spoken-of-1',
        withSeed: '{anrede}, wie war die Zeit {seed} wirklich – woran erinnerst du dich zuerst?',
      },
      {
        id: 'time-rarely-spoken-of-2',
        withSeed: '{anrede}, was war das Schönste an {seed}?',
      },
      {
        id: 'time-rarely-spoken-of-3',
        withSeed: '{anrede}, was war das Schwerste an {seed}?',
      },
      {
        id: 'time-rarely-spoken-of-4',
        withSeed: '{anrede}, gibt es etwas {seed}, das du nie erzählt hast?',
      },
    ],
  },
  {
    id: 'person-never-met',
    group: 'biography',
    title: 'Mensch, den ich nie kennengelernt habe',
    templates: [
      {
        id: 'person-never-met-1',
        withSeed: '{anrede}, wie war {seed} wirklich – mit eigenen Worten?',
      },
      {
        id: 'person-never-met-2',
        withSeed: '{anrede}, was hättest du gewollt, dass ich von {seed} weiß?',
      },
      {
        id: 'person-never-met-3',
        withSeed: '{anrede}, wenn {seed} heute hier säße, was würde er/sie sagen?',
      },
    ],
  },
  {
    id: 'before-i-was-born',
    group: 'biography',
    title: 'Bevor es mich gab',
    templates: [
      {
        id: 'before-i-was-born-1',
        withSeed: '{anrede}, wer warst du, bevor es {seed} und mich gab?',
        withoutSeed: '{anrede}, wer warst du, bevor du Mutter/Vater wurdest?',
      },
    ],
  },
  {
    id: 'decision-that-changed-everything',
    group: 'biography',
    title: 'Entscheidung, die alles verändert hat',
    templates: [
      {
        id: 'decision-that-changed-everything-1',
        withSeed: '{anrede}, gab es einen Moment, an dem dein Leben kippte – {seed}?',
        withoutSeed: '{anrede}, welche Entscheidung in deinem Leben hat alles verändert?',
      },
    ],
  },
  {
    id: 'fragments-of-a-story',
    group: 'biography',
    title: 'Bruchstücke einer Geschichte',
    templates: [
      {
        id: 'fragments-of-a-story-1',
        withSeed: '{anrede}, ich kenne die Geschichte {seed} nur halb – wie war sie wirklich?',
      },
    ],
  },
  {
    id: 'never-dared-to-ask',
    group: 'biography',
    title: 'Nie zu fragen gewagt',
    templates: [
      {
        id: 'never-dared-to-ask-1',
        withSeed: '{anrede}, ich habe mich nie getraut zu fragen: {seed}?',
        withoutSeed:
          '{anrede}, gibt es etwas, was ich dich nie zu fragen gewagt habe – das du mir aber sagen würdest?',
      },
    ],
  },

  // ── Group B: relationship ─────────────────────────────────────────────
  {
    id: 'how-you-see-me',
    group: 'relationship',
    title: 'Wie du mich siehst',
    templates: [
      {
        id: 'how-you-see-me-1',
        withSeed: '{anrede}, was siehst du in {seed}, das ich selbst vielleicht nicht sehe?',
        withoutSeed: '{anrede}, wie denkst du heute über mich?',
      },
      {
        id: 'how-you-see-me-2',
        withSeed: '{anrede}, was siehst du in mir, das ich selbst vielleicht nicht sehe?',
        withoutSeed: '{anrede}, was siehst du in mir, das ich selbst vielleicht nicht sehe?',
      },
      {
        id: 'how-you-see-me-3',
        withSeed: '{anrede}, wann warst du am stolzesten auf mich – und wann am traurigsten?',
        withoutSeed: '{anrede}, wann warst du am stolzesten auf mich – und wann am traurigsten?',
      },
    ],
  },
  {
    id: 'what-is-between-us',
    group: 'relationship',
    title: 'Was zwischen uns war / ist',
    templates: [
      {
        id: 'what-is-between-us-1',
        withSeed: '{anrede}, gab es zwischen uns etwas zu {seed}, das nie ausgesprochen wurde?',
        withoutSeed: '{anrede}, gab es etwas zwischen uns, das nie ausgesprochen wurde?',
      },
      {
        id: 'what-is-between-us-2',
        withSeed: '{anrede}, woran erinnerst du dich am liebsten von uns beiden – besonders an {seed}?',
        withoutSeed: '{anrede}, woran erinnerst du dich am liebsten von uns beiden?',
      },
      {
        id: 'what-is-between-us-3',
        withSeed: '{anrede}, gibt es einen Streit zwischen uns ({seed}), der nie wirklich aufgelöst wurde?',
        withoutSeed: '{anrede}, gibt es einen Streit zwischen uns, der nie wirklich aufgelöst wurde?',
      },
    ],
  },
  {
    id: 'what-you-would-do-differently',
    group: 'relationship',
    title: 'Was du anders gemacht hättest',
    templates: [
      {
        id: 'what-you-would-do-differently-1',
        withSeed: '{anrede}, was hättest du in der Erziehung anders gemacht, besonders bei {seed}?',
        withoutSeed: '{anrede}, was hättest du in der Erziehung anders gemacht?',
      },
      {
        id: 'what-you-would-do-differently-2',
        withSeed: '{anrede}, was hättest du dir damals von mir gewünscht – vor allem bei {seed}?',
        withoutSeed: '{anrede}, was hättest du dir damals von mir gewünscht?',
      },
      {
        id: 'what-you-would-do-differently-3',
        withSeed: '{anrede}, wofür würdest du mich heute um Verzeihung bitten – oder ich dich? Vielleicht zu {seed}?',
        withoutSeed: '{anrede}, wofür würdest du mich heute um Verzeihung bitten – oder ich dich?',
      },
    ],
  },
  {
    id: 'what-should-remain',
    group: 'relationship',
    title: 'Was bleiben soll',
    templates: [
      {
        id: 'what-should-remain-1',
        withSeed: '{anrede}, was soll ich nie vergessen, was du mir zu {seed} mitgegeben hast?',
        withoutSeed: '{anrede}, was soll ich nie vergessen, was du mir mitgegeben hast?',
      },
      {
        id: 'what-should-remain-2',
        withSeed: '{anrede}, welchen Satz von dir – vielleicht zu {seed} – soll ich weitertragen?',
        withoutSeed: '{anrede}, welchen Satz von dir soll ich weitertragen?',
      },
      {
        id: 'what-should-remain-3',
        withSeed: '{anrede}, was würdest du meinem Kind über mich – über {seed} – erzählen?',
        withoutSeed: '{anrede}, was würdest du meinem Kind über mich erzählen?',
      },
    ],
  },
]

/** Free-form trigger used when the user opts out of pre-set templates.
 *  The single template renders only when a seed is present (the user's own
 *  full question text), and surfaces it verbatim with the anrede prefix.
 *  Without a seed there is nothing to render — Sandra simply types directly. */
export const FREEFORM_TRIGGER_DE: TriggerDef = {
  id: 'freeform',
  group: 'biography',
  title: 'Eigene Frage',
  templates: [
    {
      id: 'freeform-1',
      withSeed: '{anrede}, {seed}',
    },
  ],
}

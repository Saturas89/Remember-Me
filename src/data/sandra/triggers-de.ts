import { TriggerDef } from '../../types'

export const TRIGGERS_DE: TriggerDef[] = [
  // Biography group (6 triggers)
  {
    id: 'childhood',
    title: 'Bevor es dich gab',
    emoji: '👶',
    group: 'biography',
    description: 'Die frühen Jahre und Kindheitserinnerungen',
    templates: [
      {
        id: 'childhood-basic',
        withoutSeed: 'Erzähle mir von deiner Kindheit, {anrede}.',
        patterns: [
          { seedPattern: '.*', text: 'Du hast {seed} erwähnt – erzähle mir mehr darüber, {anrede}.' }
        ]
      },
      {
        id: 'childhood-specific',
        patterns: [
          { seedPattern: /haus|wohnung|zuhause/i, text: 'Wie war euer Zuhause, als du {seed} warst, {anrede}?' },
          { seedPattern: /spiel|spielzeug/i, text: 'Womit hast du als Kind am liebsten gespielt, {anrede}?' },
          { seedPattern: /schule|lehrer/i, text: 'Wie war die Schulzeit für dich, {anrede}?' }
        ]
      }
    ],
    inspirations: [
      'Wie war euer Zuhause, als du klein warst?',
      'Woran erinnerst du dich aus deiner Kindheit am liebsten?',
      'Hattest du ein Lieblingsspielzeug?',
      'Wie war dein erster Schultag?',
      'Mit wem warst du als Kind befreundet?',
      'Welche Geschichten haben dir deine Eltern erzählt?'
    ]
  },
  {
    id: 'youth',
    title: 'Als du jung warst',
    emoji: '🎓',
    group: 'biography',
    description: 'Jugend, Ausbildung und erste Erfahrungen',
    templates: [
      {
        id: 'youth-basic',
        withoutSeed: 'Erzähle mir von deiner Jugendzeit, {anrede}.',
        patterns: [
          { seedPattern: '.*', text: 'Du hast {seed} erwähnt – wie war das damals für dich, {anrede}?' }
        ]
      },
      {
        id: 'youth-specific',
        patterns: [
          { seedPattern: /beruf|ausbildung|arbeit/i, text: 'Wie hast du deinen Beruf gefunden, {anrede}?' },
          { seedPattern: /freund|liebe|partner/i, text: 'Erzähle mir von deiner ersten großen Liebe, {anrede}.' },
          { seedPattern: /reise|urlaub/i, text: 'Wohin bist du als junge Person gereist, {anrede}?' }
        ]
      }
    ],
    inspirations: [
      'Wie hast du deinen Beruf gefunden?',
      'Wovon hast du als Jugendliche geträumt?',
      'Was war dein größtes Abenteuer?',
      'Erzähle mir von deiner ersten großen Liebe.',
      'Welche Musik hast du damals gehört?',
      'Wie warst du als junger Mensch?'
    ]
  },
  {
    id: 'work',
    title: 'Dein Berufsleben',
    emoji: '💼',
    group: 'biography',
    description: 'Karriere, Kollegen und Arbeitserfahrungen',
    templates: [
      {
        id: 'work-basic',
        withoutSeed: 'Erzähle mir von deinem Berufsleben, {anrede}.',
        patterns: [
          { seedPattern: '.*', text: 'Du hast {seed} im Beruf erlebt – erzähle mir davon, {anrede}.' }
        ]
      },
      {
        id: 'work-specific',
        patterns: [
          { seedPattern: /kollege|chef|team/i, text: 'Wie waren deine Kollegen, {anrede}?' },
          { seedPattern: /projekt|erfolg/i, text: 'Auf welche beruflichen Erfolge bist du stolz, {anrede}?' },
          { seedPattern: /schwierig|problem/i, text: 'Welche Herausforderungen hattest du im Beruf, {anrede}?' }
        ]
      }
    ],
    inspirations: [
      'Wie waren deine Kollegen?',
      'Auf welche beruflichen Erfolge bist du stolz?',
      'Was war dein liebster Arbeitsplatz?',
      'Welche Herausforderungen hattest du im Beruf?',
      'Was hast du gerne an deiner Arbeit gemacht?',
      'Wie sah ein typischer Arbeitstag aus?'
    ]
  },
  {
    id: 'traditions',
    title: 'Unsere Traditionen',
    emoji: '🎄',
    group: 'biography',
    description: 'Feste, Bräuche und besondere Ereignisse',
    templates: [
      {
        id: 'traditions-basic',
        withoutSeed: 'Erzähle mir von unseren Familientraditionen, {anrede}.',
        patterns: [
          { seedPattern: '.*', text: 'Du hast {seed} erwähnt – wie haben wir das immer gefeiert, {anrede}?' }
        ]
      },
      {
        id: 'traditions-specific',
        patterns: [
          { seedPattern: /weihnachten|weihnacht/i, text: 'Wie war Weihnachten bei uns, {anrede}?' },
          { seedPattern: /geburtstag|fest/i, text: 'Wie haben wir Geburtstage gefeiert, {anrede}?' },
          { seedPattern: /essen|kochen/i, text: 'Welche besonderen Gerichte hast du gekocht, {anrede}?' }
        ]
      }
    ],
    inspirations: [
      'Wie war Weihnachten bei uns?',
      'Welche Gerichte hast du für die Familie gekocht?',
      'Wie haben wir Geburtstage gefeiert?',
      'Welche Feste waren dir besonders wichtig?',
      'Was für Familientraditionen hattest du?',
      'Welche Rezepte sollte ich unbedingt kennen?'
    ]
  },
  {
    id: 'wisdom',
    title: 'Was du gelernt hast',
    emoji: '💡',
    group: 'biography',
    description: 'Lebenserfahrungen und wichtige Erkenntnisse',
    templates: [
      {
        id: 'wisdom-basic',
        withoutSeed: 'Was ist das Wichtigste, was du gelernt hast, {anrede}?',
        patterns: [
          { seedPattern: '.*', text: 'Du hast {seed} erwähnt – was hast du daraus gelernt, {anrede}?' }
        ]
      },
      {
        id: 'wisdom-specific',
        patterns: [
          { seedPattern: /fehler|bereuen/i, text: 'Gibt es etwas, was du anders machen würdest, {anrede}?' },
          { seedPattern: /stolz|erfolg/i, text: 'Worauf bist du besonders stolz, {anrede}?' },
          { seedPattern: /ratschlag|tipp/i, text: 'Welchen Rat möchtest du mir geben, {anrede}?' }
        ]
      }
    ],
    inspirations: [
      'Welchen Rat möchtest du mir geben?',
      'Worauf bist du besonders stolz?',
      'Was ist das Wichtigste, was du gelernt hast?',
      'Gibt es etwas, was du anders machen würdest?',
      'Was bedeutet ein gutes Leben für dich?',
      'Wofür bist du dankbar?'
    ]
  },
  {
    id: 'places',
    title: 'Orte, die wichtig waren',
    emoji: '🏠',
    group: 'biography',
    description: 'Bedeutsame Orte und Erinnerungen daran',
    templates: [
      {
        id: 'places-basic',
        withoutSeed: 'Erzähle mir von Orten, die dir wichtig waren, {anrede}.',
        patterns: [
          { seedPattern: '.*', text: 'Du hast {seed} erwähnt – was verbindest du mit diesem Ort, {anrede}?' }
        ]
      },
      {
        id: 'places-specific',
        patterns: [
          { seedPattern: /haus|zuhause|wohnung/i, text: 'Erzähle mir von unserem Zuhause, {anrede}.' },
          { seedPattern: /urlaub|reise/i, text: 'Welche Reisen waren für dich besonders, {anrede}?' },
          { seedPattern: /stadt|dorf/i, text: 'Wie war das Leben in {seed}, {anrede}?' }
        ]
      }
    ],
    inspirations: [
      'Erzähle mir von unserem Zuhause.',
      'Welche Orte waren für dich besonders?',
      'Wohin bist du gerne gereist?',
      'Wie war das Leben früher hier?',
      'Welcher Ort bedeutet dir am meisten?',
      'Wo warst du am glücklichsten?'
    ]
  },
  // Relationship group (4 triggers)
  {
    id: 'love-story',
    title: 'Eure Liebesgeschichte',
    emoji: '💕',
    group: 'relationship',
    description: 'Wie sich die Eltern kennengelernt haben',
    templates: [
      {
        id: 'love-basic',
        withoutSeed: 'Erzähle mir, wie du Papa kennengelernt hast, {anrede}.',
        patterns: [
          { seedPattern: '.*', text: 'Du hast {seed} erwähnt – erzähle mir mehr über euren Anfang, {anrede}.' }
        ]
      },
      {
        id: 'love-specific',
        patterns: [
          { seedPattern: /tanzen|party|fest/i, text: 'Wie war euer erstes Treffen, {anrede}?' },
          { seedPattern: /hochzeit/i, text: 'Erzähle mir von eurer Hochzeit, {anrede}.' },
          { seedPattern: /verliebt/i, text: 'Wann wusstest du, dass er der Richtige ist, {anrede}?' }
        ]
      }
    ],
    inspirations: [
      'Wie habt ihr euch kennengelernt?',
      'Wann wusstest du, dass er der Richtige ist?',
      'Erzähle mir von eurem ersten Date.',
      'Wie war eure Hochzeit?',
      'Was liebst du an Papa am meisten?',
      'Was war euer glücklichster Moment zusammen?'
    ]
  },
  {
    id: 'early-parenting',
    title: 'Als ich klein war',
    emoji: '👨‍👩‍👧‍👦',
    group: 'relationship',
    description: 'Die ersten Jahre als Eltern',
    templates: [
      {
        id: 'parenting-basic',
        withoutSeed: 'Erzähle mir, wie es war, als ich klein war, {anrede}.',
        patterns: [
          { seedPattern: '.*', text: 'Du hast {seed} erwähnt – wie war das für dich als Mama, {anrede}?' }
        ]
      },
      {
        id: 'parenting-specific',
        patterns: [
          { seedPattern: /geburt|baby/i, text: 'Wie war es, als ich geboren wurde, {anrede}?' },
          { seedPattern: /nacht|schlaf/i, text: 'Wie waren die ersten Nächte mit mir, {anrede}?' },
          { seedPattern: /stolz|freude/i, text: 'Worauf warst du stolz, als ich klein war, {anrede}?' }
        ]
      }
    ],
    inspirations: [
      'Wie war es, als ich geboren wurde?',
      'Woran erinnerst du dich von meiner Babyzeit?',
      'Was war lustig, als ich klein war?',
      'Wie waren die ersten Jahre als Mama?',
      'Worauf warst du stolz, als ich klein war?',
      'Was hast du dir für mich gewünscht?'
    ]
  },
  {
    id: 'growing-up',
    title: 'Als ich aufgewachsen bin',
    emoji: '🌱',
    group: 'relationship',
    description: 'Kindheit und Jugend der Kinder',
    templates: [
      {
        id: 'growing-basic',
        withoutSeed: 'Erzähle mir, wie es war, mich aufwachsen zu sehen, {anrede}.',
        patterns: [
          { seedPattern: '.*', text: 'Du hast {seed} erwähnt – was denkst du darüber, {anrede}?' }
        ]
      },
      {
        id: 'growing-specific',
        patterns: [
          { seedPattern: /schule|noten/i, text: 'Wie warst du mit meiner Schulzeit, {anrede}?' },
          { seedPattern: /freund|freundin/i, text: 'Was dachtest du über meine Freunde, {anrede}?' },
          { seedPattern: /sorge|angst/i, text: 'Was hat dir Sorgen gemacht, {anrede}?' }
        ]
      }
    ],
    inspirations: [
      'Was hat dir an meiner Kindheit gefallen?',
      'Was hat dir Sorgen gemacht?',
      'Wann warst du besonders stolz auf mich?',
      'Was dachtest du über meine Freunde?',
      'Wie war es, mich aufwachsen zu sehen?',
      'Welche Eigenschaften habe ich von dir?'
    ]
  },
  {
    id: 'us-now',
    title: 'Wir heute',
    emoji: '🤗',
    group: 'relationship',
    description: 'Die heutige Beziehung zueinander',
    templates: [
      {
        id: 'now-basic',
        withoutSeed: 'Was denkst du über unsere Beziehung heute, {anrede}?',
        patterns: [
          { seedPattern: '.*', text: 'Du hast {seed} erwähnt – wie siehst du das, {anrede}?' }
        ]
      },
      {
        id: 'now-specific',
        patterns: [
          { seedPattern: /stolz/i, text: 'Worauf bist du stolz bei mir, {anrede}?' },
          { seedPattern: /wunsch|hoffnung/i, text: 'Was wünschst du dir für unsere Zukunft, {anrede}?' },
          { seedPattern: /wichtig/i, text: 'Was ist dir in unserer Beziehung wichtig, {anrede}?' }
        ]
      }
    ],
    inspirations: [
      'Worauf bist du stolz bei mir?',
      'Was schätzt du an unserer Beziehung?',
      'Was wünschst du dir für unsere Zukunft?',
      'Wobei kann ich dir helfen?',
      'Was möchtest du mir noch sagen?',
      'Was ist dir in unserer Beziehung wichtig?'
    ]
  }
]
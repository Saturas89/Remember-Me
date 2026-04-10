import type { Question } from '../types'

/**
 * Questions designed for friends to answer about the main user.
 * Use {name} as placeholder – gets replaced with the real name at runtime.
 */
export const FRIEND_QUESTIONS: Question[] = [
  {
    id: 'friend-01',
    categoryId: 'friend',
    type: 'text',
    text: 'Wie habt ihr euch kennengelernt?',
    helpText: 'Wo war das, wann war das, was war der erste Moment?',
  },
  {
    id: 'friend-02',
    categoryId: 'friend',
    type: 'text',
    text: 'Was war dein erster Eindruck von {name}?',
  },
  {
    id: 'friend-03',
    categoryId: 'friend',
    type: 'text',
    text: 'Wie würdest du {name} in drei Worten beschreiben?',
  },
  {
    id: 'friend-04',
    categoryId: 'friend',
    type: 'text',
    text: 'Was schätzt du an {name} am meisten?',
  },
  {
    id: 'friend-05',
    categoryId: 'friend',
    type: 'text',
    text: 'Was ist deine schönste gemeinsame Erinnerung mit {name}?',
  },
  {
    id: 'friend-06',
    categoryId: 'friend',
    type: 'text',
    text: 'Wann hat {name} dich zum Lachen gebracht?',
    helpText: 'Eine lustige oder unvergessliche Situation',
  },
  {
    id: 'friend-07',
    categoryId: 'friend',
    type: 'text',
    text: 'Was macht {name} einzigartig oder besonders?',
  },
  {
    id: 'friend-08',
    categoryId: 'friend',
    type: 'text',
    text: 'Hast du von {name} etwas gelernt? Was war das?',
  },
  {
    id: 'friend-09',
    categoryId: 'friend',
    type: 'choice',
    text: 'Wenn {name} ein Tier wäre, welches wäre es?',
    options: [
      'Löwe – mutig und führend',
      'Delfin – klug und verspielt',
      'Eule – weise und ruhig',
      'Hund – treu und herzlich',
    ],
  },
  {
    id: 'friend-10',
    categoryId: 'friend',
    type: 'text',
    text: 'Was möchtest du {name} mitgeben – eine Botschaft für die Nachwelt?',
    helpText: 'Was sollen andere über {name} wissen?',
  },
]

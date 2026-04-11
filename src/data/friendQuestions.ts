import type { Question } from '../types'

export interface FriendTopic {
  id: string
  title: string
  emoji: string
  description: string
  questions: Question[]
}

export const FRIEND_TOPICS: FriendTopic[] = [
  {
    id: 'friendship',
    title: 'Unsere Freundschaft',
    emoji: '🤝',
    description: 'Wie ihr euch kennt und was euch verbindet',
    questions: [
      {
        id: 'friend-f1',
        categoryId: 'friend',
        type: 'text',
        text: 'Wie habt ihr euch kennengelernt?',
        helpText: 'Wo war das, wann war das – was war der erste Moment?',
      },
      {
        id: 'friend-f2',
        categoryId: 'friend',
        type: 'text',
        text: 'Was war dein erster Eindruck von {name}?',
      },
      {
        id: 'friend-f3',
        categoryId: 'friend',
        type: 'text',
        text: 'Was ist deine schönste gemeinsame Erinnerung mit {name}?',
      },
      {
        id: 'friend-f4',
        categoryId: 'friend',
        type: 'text',
        text: 'Was macht {name} als Freund:in besonders?',
        helpText: 'Was schätzt du besonders an der Freundschaft?',
      },
      {
        id: 'friend-f5',
        categoryId: 'friend',
        type: 'text',
        text: 'Was möchtest du {name} mitgeben – eine Botschaft für die Nachwelt?',
        helpText: 'Was sollen andere über {name} wissen?',
      },
    ],
  },
  {
    id: 'personality',
    title: 'Persönlichkeit',
    emoji: '✨',
    description: 'Charakter, Stärken und was {name} besonders macht',
    questions: [
      {
        id: 'friend-p1',
        categoryId: 'friend',
        type: 'text',
        text: 'Wie würdest du {name} in drei Worten beschreiben?',
      },
      {
        id: 'friend-p2',
        categoryId: 'friend',
        type: 'text',
        text: 'Was macht {name} einzigartig oder besonders?',
      },
      {
        id: 'friend-p3',
        categoryId: 'friend',
        type: 'text',
        text: 'Wann hat {name} dich beeindruckt oder überrascht?',
        helpText: 'Eine Situation, die dir in Erinnerung geblieben ist',
      },
      {
        id: 'friend-p4',
        categoryId: 'friend',
        type: 'text',
        text: 'Hast du von {name} etwas gelernt? Was war das?',
      },
      {
        id: 'friend-p5',
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
    ],
  },
  {
    id: 'memories',
    title: 'Gemeinsame Erlebnisse',
    emoji: '🌟',
    description: 'Momente, die euch verbinden',
    questions: [
      {
        id: 'friend-m1',
        categoryId: 'friend',
        type: 'text',
        text: 'Wann hat {name} dich zum Lachen gebracht?',
        helpText: 'Eine lustige oder unvergessliche Situation',
      },
      {
        id: 'friend-m2',
        categoryId: 'friend',
        type: 'text',
        text: 'Gibt es einen Moment, in dem {name} für dich da war?',
        helpText: 'Eine Situation, in der {name} dir geholfen oder dich unterstützt hat',
      },
      {
        id: 'friend-m3',
        categoryId: 'friend',
        type: 'text',
        text: 'Welches Abenteuer oder Erlebnis verbindet euch besonders?',
      },
      {
        id: 'friend-m4',
        categoryId: 'friend',
        type: 'text',
        text: 'Was hat sich in eurer Beziehung im Laufe der Zeit verändert?',
      },
      {
        id: 'friend-m5',
        categoryId: 'friend',
        type: 'text',
        text: 'Was schätzt du an {name} am meisten?',
        helpText: 'Eine Eigenschaft, eine Gewohnheit oder etwas, das dir wichtig ist',
      },
    ],
  },
  {
    id: 'family',
    title: 'Familie',
    emoji: '👨‍👩‍👧',
    description: 'Für Familienmitglieder – Erinnerungen und Weitergabe',
    questions: [
      {
        id: 'friend-fa1',
        categoryId: 'friend',
        type: 'text',
        text: 'Wie würdest du {name} als Familienmitglied beschreiben?',
      },
      {
        id: 'friend-fa2',
        categoryId: 'friend',
        type: 'text',
        text: 'Was ist deine liebste Kindheitserinnerung mit {name}?',
      },
      {
        id: 'friend-fa3',
        categoryId: 'friend',
        type: 'text',
        text: 'Was hat {name} dir mitgegeben, das du nie vergessen wirst?',
        helpText: 'Ein Wert, eine Lektion oder etwas, das dich geprägt hat',
      },
      {
        id: 'friend-fa4',
        categoryId: 'friend',
        type: 'text',
        text: 'Welche Eigenschaft von {name} hoffst du weitergegeben zu haben oder zu bekommen?',
      },
      {
        id: 'friend-fa5',
        categoryId: 'friend',
        type: 'text',
        text: 'Was möchtest du anderen über {name} erzählen – was sollen sie über ihn oder sie wissen?',
      },
    ],
  },
]

/**
 * Flat list of all questions across all topics.
 * Used in ArchiveView to resolve question IDs to their text.
 */
export const FRIEND_QUESTIONS = FRIEND_TOPICS.flatMap(t => t.questions)

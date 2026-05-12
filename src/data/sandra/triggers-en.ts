import { TriggerDef } from '../../types'

export const TRIGGERS_EN: TriggerDef[] = [
  // Biography group (6 triggers)
  {
    id: 'childhood',
    title: 'Before I was here',
    emoji: '👶',
    group: 'biography',
    description: 'Early years and childhood memories',
    templates: [
      {
        id: 'childhood-basic',
        withoutSeed: 'Tell me about your childhood, {anrede}.',
        patterns: [
          { seedPattern: '.*', text: 'You mentioned {seed} – tell me more about that, {anrede}.' }
        ]
      },
      {
        id: 'childhood-specific',
        patterns: [
          { seedPattern: /house|home|place/i, text: 'What was your home like when you were {seed}, {anrede}?' },
          { seedPattern: /play|toy|game/i, text: 'What did you love to play with as a child, {anrede}?' },
          { seedPattern: /school|teacher/i, text: 'How was school for you, {anrede}?' }
        ]
      }
    ],
    inspirations: [
      'What was your home like when you were little?',
      'What do you remember most fondly from your childhood?',
      'Did you have a favorite toy?',
      'How was your first day of school?',
      'Who were your childhood friends?',
      'What stories did your parents tell you?'
    ]
  },
  {
    id: 'youth',
    title: 'When you were young',
    emoji: '🎓',
    group: 'biography',
    description: 'Youth, education and first experiences',
    templates: [
      {
        id: 'youth-basic',
        withoutSeed: 'Tell me about when you were young, {anrede}.',
        patterns: [
          { seedPattern: '.*', text: 'You mentioned {seed} – how was that for you back then, {anrede}?' }
        ]
      },
      {
        id: 'youth-specific',
        patterns: [
          { seedPattern: /job|career|work/i, text: 'How did you find your career, {anrede}?' },
          { seedPattern: /friend|love|partner/i, text: 'Tell me about your first love, {anrede}.' },
          { seedPattern: /travel|trip|vacation/i, text: 'Where did you travel as a young person, {anrede}?' }
        ]
      }
    ],
    inspirations: [
      'How did you find your career?',
      'What did you dream about as a teenager?',
      'What was your biggest adventure?',
      'Tell me about your first love.',
      'What music did you listen to back then?',
      'What were you like as a young person?'
    ]
  },
  {
    id: 'work',
    title: 'Your working life',
    emoji: '💼',
    group: 'biography',
    description: 'Career, colleagues and work experiences',
    templates: [
      {
        id: 'work-basic',
        withoutSeed: 'Tell me about your working life, {anrede}.',
        patterns: [
          { seedPattern: '.*', text: 'You experienced {seed} at work – tell me about that, {anrede}.' }
        ]
      },
      {
        id: 'work-specific',
        patterns: [
          { seedPattern: /colleague|boss|team/i, text: 'What were your colleagues like, {anrede}?' },
          { seedPattern: /project|success/i, text: 'What professional achievements are you proud of, {anrede}?' },
          { seedPattern: /difficult|problem|challenge/i, text: 'What challenges did you face at work, {anrede}?' }
        ]
      }
    ],
    inspirations: [
      'What were your colleagues like?',
      'What professional achievements are you proud of?',
      'What was your favorite workplace?',
      'What challenges did you face at work?',
      'What did you enjoy about your job?',
      'What was a typical work day like?'
    ]
  },
  {
    id: 'traditions',
    title: 'Our traditions',
    emoji: '🎄',
    group: 'biography',
    description: 'Celebrations, customs and special occasions',
    templates: [
      {
        id: 'traditions-basic',
        withoutSeed: 'Tell me about our family traditions, {anrede}.',
        patterns: [
          { seedPattern: '.*', text: 'You mentioned {seed} – how did we always celebrate that, {anrede}?' }
        ]
      },
      {
        id: 'traditions-specific',
        patterns: [
          { seedPattern: /christmas|holiday/i, text: 'What was Christmas like in our family, {anrede}?' },
          { seedPattern: /birthday|party/i, text: 'How did we celebrate birthdays, {anrede}?' },
          { seedPattern: /food|cooking|meal/i, text: 'What special dishes did you make, {anrede}?' }
        ]
      }
    ],
    inspirations: [
      'What was Christmas like in our family?',
      'What special dishes did you make for the family?',
      'How did we celebrate birthdays?',
      'Which holidays were especially important to you?',
      'What family traditions did you have?',
      'Which recipes should I definitely know?'
    ]
  },
  {
    id: 'wisdom',
    title: 'What you learned',
    emoji: '💡',
    group: 'biography',
    description: 'Life experiences and important insights',
    templates: [
      {
        id: 'wisdom-basic',
        withoutSeed: 'What is the most important thing you learned, {anrede}?',
        patterns: [
          { seedPattern: '.*', text: 'You mentioned {seed} – what did you learn from that, {anrede}?' }
        ]
      },
      {
        id: 'wisdom-specific',
        patterns: [
          { seedPattern: /mistake|regret/i, text: 'Is there anything you would do differently, {anrede}?' },
          { seedPattern: /proud|success/i, text: 'What are you especially proud of, {anrede}?' },
          { seedPattern: /advice|tip/i, text: 'What advice would you like to give me, {anrede}?' }
        ]
      }
    ],
    inspirations: [
      'What advice would you like to give me?',
      'What are you especially proud of?',
      'What is the most important thing you learned?',
      'Is there anything you would do differently?',
      'What does a good life mean to you?',
      'What are you grateful for?'
    ]
  },
  {
    id: 'places',
    title: 'Important places',
    emoji: '🏠',
    group: 'biography',
    description: 'Meaningful places and memories of them',
    templates: [
      {
        id: 'places-basic',
        withoutSeed: 'Tell me about places that were important to you, {anrede}.',
        patterns: [
          { seedPattern: '.*', text: 'You mentioned {seed} – what do you connect with that place, {anrede}?' }
        ]
      },
      {
        id: 'places-specific',
        patterns: [
          { seedPattern: /house|home|apartment/i, text: 'Tell me about our home, {anrede}.' },
          { seedPattern: /vacation|travel|trip/i, text: 'Which trips were special for you, {anrede}?' },
          { seedPattern: /city|town|village/i, text: 'What was life like in {seed}, {anrede}?' }
        ]
      }
    ],
    inspirations: [
      'Tell me about our home.',
      'Which places were special to you?',
      'Where did you love to travel?',
      'What was life like here in the past?',
      'Which place means the most to you?',
      'Where were you happiest?'
    ]
  },
  // Relationship group (4 triggers)
  {
    id: 'love-story',
    title: 'Your love story',
    emoji: '💕',
    group: 'relationship',
    description: 'How the parents met',
    templates: [
      {
        id: 'love-basic',
        withoutSeed: 'Tell me how you met Dad, {anrede}.',
        patterns: [
          { seedPattern: '.*', text: 'You mentioned {seed} – tell me more about your beginning, {anrede}.' }
        ]
      },
      {
        id: 'love-specific',
        patterns: [
          { seedPattern: /dance|party|celebration/i, text: 'How was your first meeting, {anrede}?' },
          { seedPattern: /wedding|marry/i, text: 'Tell me about your wedding, {anrede}.' },
          { seedPattern: /love|fell/i, text: 'When did you know he was the one, {anrede}?' }
        ]
      }
    ],
    inspirations: [
      'How did you two meet?',
      'When did you know he was the one?',
      'Tell me about your first date.',
      'How was your wedding?',
      'What do you love most about Dad?',
      'What was your happiest moment together?'
    ]
  },
  {
    id: 'early-parenting',
    title: 'When I was little',
    emoji: '👨‍👩‍👧‍👦',
    group: 'relationship',
    description: 'The first years as parents',
    templates: [
      {
        id: 'parenting-basic',
        withoutSeed: 'Tell me what it was like when I was little, {anrede}.',
        patterns: [
          { seedPattern: '.*', text: 'You mentioned {seed} – how was that for you as a mother, {anrede}?' }
        ]
      },
      {
        id: 'parenting-specific',
        patterns: [
          { seedPattern: /birth|baby/i, text: 'What was it like when I was born, {anrede}?' },
          { seedPattern: /night|sleep/i, text: 'How were the first nights with me, {anrede}?' },
          { seedPattern: /proud|joy/i, text: 'What were you proud of when I was little, {anrede}?' }
        ]
      }
    ],
    inspirations: [
      'What was it like when I was born?',
      'What do you remember from when I was a baby?',
      'What was funny when I was little?',
      'How were the first years as a mother?',
      'What were you proud of when I was little?',
      'What did you wish for me?'
    ]
  },
  {
    id: 'growing-up',
    title: 'As I grew up',
    emoji: '🌱',
    group: 'relationship',
    description: 'Childhood and youth of the children',
    templates: [
      {
        id: 'growing-basic',
        withoutSeed: 'Tell me what it was like watching me grow up, {anrede}.',
        patterns: [
          { seedPattern: '.*', text: 'You mentioned {seed} – what do you think about that, {anrede}?' }
        ]
      },
      {
        id: 'growing-specific',
        patterns: [
          { seedPattern: /school|grade/i, text: 'How did you feel about my school years, {anrede}?' },
          { seedPattern: /friend|boyfriend|girlfriend/i, text: 'What did you think of my friends, {anrede}?' },
          { seedPattern: /worry|concern/i, text: 'What worried you about me, {anrede}?' }
        ]
      }
    ],
    inspirations: [
      'What did you enjoy about my childhood?',
      'What worried you about me?',
      'When were you especially proud of me?',
      'What did you think of my friends?',
      'What was it like watching me grow up?',
      'What traits did I get from you?'
    ]
  },
  {
    id: 'us-now',
    title: 'Us today',
    emoji: '🤗',
    group: 'relationship',
    description: 'The current relationship with each other',
    templates: [
      {
        id: 'now-basic',
        withoutSeed: 'What do you think about our relationship today, {anrede}?',
        patterns: [
          { seedPattern: '.*', text: 'You mentioned {seed} – how do you see that, {anrede}?' }
        ]
      },
      {
        id: 'now-specific',
        patterns: [
          { seedPattern: /proud/i, text: 'What are you proud of about me, {anrede}?' },
          { seedPattern: /wish|hope/i, text: 'What do you wish for our future, {anrede}?' },
          { seedPattern: /important/i, text: 'What is important to you in our relationship, {anrede}?' }
        ]
      }
    ],
    inspirations: [
      'What are you proud of about me?',
      'What do you value about our relationship?',
      'What do you wish for our future?',
      'How can I help you?',
      'What else would you like to tell me?',
      'What is important to you in our relationship?'
    ]
  }
]
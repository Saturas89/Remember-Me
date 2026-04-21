import type { FriendTopic } from '../../types'

export const FRIEND_TOPICS_EN: FriendTopic[] = [
  {
    id: 'friendship',
    title: 'Our Friendship',
    emoji: '🤝',
    description: 'How you know each other and what connects you',
    questions: [
      { id: 'friend-f1', categoryId: 'friend', type: 'text', text: 'How did you meet?', helpText: 'Where was it, when was it – what was that first moment?' },
      { id: 'friend-f2', categoryId: 'friend', type: 'text', text: 'What was your first impression of {name}?' },
      { id: 'friend-f3', categoryId: 'friend', type: 'text', text: 'What is your favourite shared memory with {name}?' },
      { id: 'friend-f4', categoryId: 'friend', type: 'text', text: 'What makes {name} special as a friend?', helpText: 'What do you particularly appreciate about the friendship?' },
      { id: 'friend-f5', categoryId: 'friend', type: 'text', text: 'What would you like to pass on to {name} – a message for posterity?', helpText: 'What should others know about {name}?' },
    ],
  },
  {
    id: 'personality',
    title: 'Personality',
    emoji: '✨',
    description: 'Character, strengths and what makes {name} unique',
    questions: [
      { id: 'friend-p1', categoryId: 'friend', type: 'text', text: 'How would you describe {name} in three words?' },
      { id: 'friend-p2', categoryId: 'friend', type: 'text', text: 'What makes {name} unique or special?' },
      { id: 'friend-p3', categoryId: 'friend', type: 'text', text: 'When has {name} impressed or surprised you?', helpText: 'A situation that has stayed with you' },
      { id: 'friend-p4', categoryId: 'friend', type: 'text', text: 'Have you learned something from {name}? What was it?' },
      { id: 'friend-p5', categoryId: 'friend', type: 'choice', text: 'If {name} were an animal, which one would it be?', options: ['Lion – brave and leading', 'Dolphin – clever and playful', 'Owl – wise and calm', 'Dog – loyal and warm-hearted'] },
    ],
  },
  {
    id: 'memories',
    title: 'Shared Experiences',
    emoji: '🌟',
    description: 'Moments that connect you',
    questions: [
      { id: 'friend-m1', categoryId: 'friend', type: 'text', text: 'When has {name} made you laugh?', helpText: 'A funny or unforgettable situation' },
      { id: 'friend-m2', categoryId: 'friend', type: 'text', text: 'Is there a moment when {name} was there for you?', helpText: 'A situation where {name} helped or supported you' },
      { id: 'friend-m3', categoryId: 'friend', type: 'text', text: 'Which adventure or experience connects you most?' },
      { id: 'friend-m4', categoryId: 'friend', type: 'text', text: 'What has changed in your relationship over time?' },
      { id: 'friend-m5', categoryId: 'friend', type: 'text', text: 'What do you appreciate most about {name}?', helpText: 'A trait, a habit, or something that matters to you' },
    ],
  },
  {
    id: 'family',
    title: 'Family',
    emoji: '👨‍👩‍👧',
    description: 'For family members – memories and passing things on',
    questions: [
      { id: 'friend-fa1', categoryId: 'friend', type: 'text', text: 'How would you describe {name} as a family member?' },
      { id: 'friend-fa2', categoryId: 'friend', type: 'text', text: 'What is your favourite childhood memory with {name}?' },
      { id: 'friend-fa3', categoryId: 'friend', type: 'text', text: 'What has {name} given you that you will never forget?', helpText: 'A value, a lesson, or something that shaped you' },
      { id: 'friend-fa4', categoryId: 'friend', type: 'text', text: 'Which quality of {name} do you hope has been passed on to you or others?' },
      { id: 'friend-fa5', categoryId: 'friend', type: 'text', text: 'What would you like to tell others about {name} – what should they know about them?' },
    ],
  },
]

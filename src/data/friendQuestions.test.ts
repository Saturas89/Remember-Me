import { describe, it, expect } from 'vitest'
import {
  FRIEND_TOPICS,
  FRIEND_QUESTIONS,
  getFriendTopicsForLocale,
  getFriendQuestionsForLocale,
} from './friendQuestions'
import { FRIEND_TOPICS_EN } from '../locales/en/friendTopics'

describe('FRIEND_TOPICS (DE)', () => {
  it('defines four topics with stable ids', () => {
    const ids = FRIEND_TOPICS.map(t => t.id).sort()
    expect(ids).toEqual(['family', 'friendship', 'memories', 'personality'])
  })

  it('every topic carries title, emoji, description and at least five questions', () => {
    for (const topic of FRIEND_TOPICS) {
      expect(topic.title).toBeTruthy()
      expect(topic.emoji).toBeTruthy()
      expect(topic.description).toBeTruthy()
      expect(topic.questions.length).toBeGreaterThanOrEqual(5)
    }
  })

  it('uses the "friend" categoryId on every question (required for archive/export)', () => {
    for (const q of FRIEND_QUESTIONS) {
      expect(q.categoryId).toBe('friend')
    }
  })

  it('question ids are globally unique across topics', () => {
    const ids = FRIEND_QUESTIONS.map(q => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('FRIEND_QUESTIONS is the flat concatenation of all topic questions', () => {
    const flat = FRIEND_TOPICS.flatMap(t => t.questions)
    expect(FRIEND_QUESTIONS).toEqual(flat)
  })

  it('choice questions provide non-empty options', () => {
    for (const q of FRIEND_QUESTIONS) {
      if (q.type === 'choice') {
        expect(Array.isArray(q.options)).toBe(true)
        expect(q.options!.length).toBeGreaterThan(0)
      }
    }
  })

  it('embeds the friend-name placeholder {name} in at least one question per topic after the first one', () => {
    // The "friendship" topic intentionally opens with a neutral question,
    // but every other topic should reference the friend by name.
    const topicsWithPlaceholder = FRIEND_TOPICS.filter(t =>
      t.questions.some(q => q.text.includes('{name}')),
    )
    expect(topicsWithPlaceholder.length).toBe(FRIEND_TOPICS.length)
  })
})

describe('getFriendTopicsForLocale / getFriendQuestionsForLocale', () => {
  it('returns the German topics for locale "de"', () => {
    expect(getFriendTopicsForLocale('de')).toBe(FRIEND_TOPICS)
  })

  it('returns the English topics for locale "en"', () => {
    expect(getFriendTopicsForLocale('en')).toBe(FRIEND_TOPICS_EN)
  })

  it('returns a flat question list matching the selected locale', () => {
    const de = getFriendQuestionsForLocale('de')
    const en = getFriendQuestionsForLocale('en')
    expect(de.length).toBe(FRIEND_TOPICS.flatMap(t => t.questions).length)
    expect(en.length).toBe(FRIEND_TOPICS_EN.flatMap(t => t.questions).length)
  })
})

import { describe, it, expect } from 'vitest'
import { CATEGORIES } from './categories'
import { FRIEND_TOPICS, FRIEND_QUESTIONS } from './friendQuestions'

const EXPECTED_IDS = ['childhood', 'family', 'career', 'values', 'memories', 'legacy']
const VALID_QUESTION_TYPES = new Set(['text', 'choice', 'scale', 'year'])

// ── CATEGORIES ────────────────────────────────────────────────────────────────

describe('CATEGORIES — structure (REQ-002)', () => {
  it('contains exactly 6 categories', () => {
    expect(CATEGORIES).toHaveLength(6)
  })

  it('has all required category IDs', () => {
    const ids = CATEGORIES.map(c => c.id)
    for (const id of EXPECTED_IDS) {
      expect(ids, `missing category "${id}"`).toContain(id)
    }
  })

  it('each category has required display fields (title, description, emoji)', () => {
    for (const cat of CATEGORIES) {
      expect(cat.title, `${cat.id} missing title`).toBeTruthy()
      expect(cat.description, `${cat.id} missing description`).toBeTruthy()
      expect(cat.emoji, `${cat.id} missing emoji`).toBeTruthy()
    }
  })

  it('each category has at least 10 questions (REQ-002)', () => {
    for (const cat of CATEGORIES) {
      expect(
        cat.questions.length,
        `category "${cat.id}" has only ${cat.questions.length} questions`,
      ).toBeGreaterThanOrEqual(10)
    }
  })

  it('all questions have required fields (id, text, type, categoryId)', () => {
    for (const cat of CATEGORIES) {
      for (const q of cat.questions) {
        expect(q.id, `question in ${cat.id} missing id`).toBeTruthy()
        expect(q.text, `${q.id} missing text`).toBeTruthy()
        expect(q.type, `${q.id} missing type`).toBeTruthy()
        expect(q.categoryId, `${q.id} missing categoryId`).toBeTruthy()
      }
    }
  })

  it('all question types are valid (text | choice | scale | year)', () => {
    for (const cat of CATEGORIES) {
      for (const q of cat.questions) {
        expect(
          VALID_QUESTION_TYPES.has(q.type),
          `${q.id} has invalid type "${q.type}"`,
        ).toBe(true)
      }
    }
  })

  it('question categoryId matches its parent category id', () => {
    for (const cat of CATEGORIES) {
      for (const q of cat.questions) {
        expect(q.categoryId, `${q.id} categoryId mismatch`).toBe(cat.id)
      }
    }
  })

  it('choice questions have at least 2 options', () => {
    for (const cat of CATEGORIES) {
      for (const q of cat.questions) {
        if (q.type === 'choice') {
          expect(q.options, `${q.id} needs options array`).toBeDefined()
          expect(
            q.options!.length,
            `${q.id} needs at least 2 options`,
          ).toBeGreaterThanOrEqual(2)
        }
      }
    }
  })

  it('no duplicate question IDs across all categories', () => {
    const ids = CATEGORIES.flatMap(c => c.questions.map(q => q.id))
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })
})

// ── FRIEND_TOPICS ─────────────────────────────────────────────────────────────

describe('FRIEND_TOPICS — structure', () => {
  it('contains exactly 4 topics', () => {
    expect(FRIEND_TOPICS).toHaveLength(4)
  })

  it('each topic has exactly 5 questions', () => {
    for (const topic of FRIEND_TOPICS) {
      expect(
        topic.questions.length,
        `topic "${topic.id}" has ${topic.questions.length} questions`,
      ).toBe(5)
    }
  })

  it('each topic has required display fields', () => {
    for (const topic of FRIEND_TOPICS) {
      expect(topic.title, `${topic.id} missing title`).toBeTruthy()
      expect(topic.emoji, `${topic.id} missing emoji`).toBeTruthy()
      expect(topic.description, `${topic.id} missing description`).toBeTruthy()
    }
  })

  it('all friend question types are valid', () => {
    for (const q of FRIEND_QUESTIONS) {
      expect(
        VALID_QUESTION_TYPES.has(q.type),
        `${q.id} has invalid type "${q.type}"`,
      ).toBe(true)
    }
  })

  it('no duplicate question IDs within friend questions', () => {
    const ids = FRIEND_QUESTIONS.map(q => q.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it('FRIEND_QUESTIONS flat list contains all topic questions', () => {
    const total = FRIEND_TOPICS.reduce((sum, t) => sum + t.questions.length, 0)
    expect(FRIEND_QUESTIONS).toHaveLength(total)
  })

  it('choice questions in friend topics have options', () => {
    for (const q of FRIEND_QUESTIONS) {
      if (q.type === 'choice') {
        expect(q.options, `${q.id} needs options`).toBeDefined()
        expect(q.options!.length).toBeGreaterThanOrEqual(2)
      }
    }
  })
})

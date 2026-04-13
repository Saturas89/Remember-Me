import { describe, it, expect, vi } from 'vitest'
import {
  downloadFile,
  exportAsBackup,
  exportAsMarkdown,
  exportAsEnrichedJSON,
  BACKUP_TYPE,
  type ExportData,
} from './export'
import { CATEGORIES } from '../data/categories'
import type { Profile, Answer, Friend, FriendAnswer } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeProfile(name = 'Testperson', birthYear = 1970): Profile {
  return { name, birthYear, createdAt: '2024-01-01T00:00:00.000Z' }
}

function makeAnswer(questionId: string, categoryId: string, value: string): Answer {
  return {
    id: questionId,
    questionId,
    categoryId,
    value,
    createdAt: '2024-03-01T12:00:00.000Z',
    updatedAt: '2024-03-01T12:00:00.000Z',
  }
}

function makeFriend(id = 'f-1', name = 'Klaus'): Friend {
  return { id, name, addedAt: '2024-01-01T00:00:00.000Z' }
}

function makeFriendAnswer(overrides: Partial<FriendAnswer> = {}): FriendAnswer {
  return {
    id: 'fa-1',
    friendId: 'f-1',
    friendName: 'Klaus',
    questionId: 'test-q-id',
    value: 'Eine Antwort',
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const EMPTY: ExportData = {
  profile: null,
  answers: {},
  friends: [],
  friendAnswers: [],
  customQuestions: [],
}

// ── exportAsBackup ────────────────────────────────────────────────────────────

describe('exportAsBackup', () => {
  it('produces parseable JSON', () => {
    expect(() => JSON.parse(exportAsBackup(EMPTY))).not.toThrow()
  })

  it('sets $type to BACKUP_TYPE constant', () => {
    expect(JSON.parse(exportAsBackup(EMPTY)).$type).toBe(BACKUP_TYPE)
  })

  it('sets BACKUP_TYPE to the expected value', () => {
    expect(BACKUP_TYPE).toBe('remember-me-backup')
  })

  it('sets version to 2', () => {
    expect(JSON.parse(exportAsBackup(EMPTY)).version).toBe(2)
  })

  it('sets app name to "Remember Me"', () => {
    expect(JSON.parse(exportAsBackup(EMPTY)).app).toBe('Remember Me')
  })

  it('embeds profile data in state', () => {
    const data = { ...EMPTY, profile: makeProfile('Gertrude') }
    const { state } = JSON.parse(exportAsBackup(data))
    expect(state.profile.name).toBe('Gertrude')
    expect(state.profile.birthYear).toBe(1970)
  })

  it('embeds answers in state', () => {
    const data = { ...EMPTY, answers: { q1: makeAnswer('q1', 'childhood', 'Berlin') } }
    const { state } = JSON.parse(exportAsBackup(data))
    expect(state.answers.q1.value).toBe('Berlin')
    expect(state.answers.q1.categoryId).toBe('childhood')
  })

  it('embeds empty collections for fresh state', () => {
    const { state } = JSON.parse(exportAsBackup(EMPTY))
    expect(state.profile).toBeNull()
    expect(state.friends).toEqual([])
    expect(state.friendAnswers).toEqual([])
    expect(state.customQuestions).toEqual([])
  })

  it('includes exportedAt timestamp', () => {
    const { exportedAt } = JSON.parse(exportAsBackup(EMPTY))
    expect(exportedAt).toBeTruthy()
    expect(new Date(exportedAt).getFullYear()).toBeGreaterThan(2020)
  })
})

// ── exportAsMarkdown ──────────────────────────────────────────────────────────

describe('exportAsMarkdown', () => {
  it('includes profile name in title', () => {
    const data = { ...EMPTY, profile: makeProfile('Gertrude') }
    expect(exportAsMarkdown(data)).toContain('Gertrude')
  })

  it('falls back to "Unbekannt" when profile is null', () => {
    expect(exportAsMarkdown(EMPTY)).toContain('Unbekannt')
  })

  it('includes birth year when present', () => {
    const data = { ...EMPTY, profile: makeProfile('Anna', 1960) }
    expect(exportAsMarkdown(data)).toContain('1960')
  })

  it('includes answered question text and answer value', () => {
    const q = CATEGORIES[0].questions[0] // childhood-01
    const data = {
      ...EMPTY,
      profile: makeProfile('Max'),
      answers: { [q.id]: makeAnswer(q.id, q.categoryId, 'Ich wuchs in München auf') },
    }
    const md = exportAsMarkdown(data)
    expect(md).toContain(q.text)
    expect(md).toContain('Ich wuchs in München auf')
  })

  it('omits categories where no question has been answered', () => {
    const data = { ...EMPTY, profile: makeProfile() }
    const md = exportAsMarkdown(data)
    expect(md).not.toContain('## 🧒 Kindheit')
    expect(md).not.toContain('## 👨‍👩‍👧‍👦 Familie')
  })

  it('uses stored questionText for friend answers (resilient, no ID lookup needed)', () => {
    const data: ExportData = {
      ...EMPTY,
      profile: makeProfile('Lena'),
      friends: [makeFriend()],
      friendAnswers: [makeFriendAnswer({
        questionId: 'id-that-no-longer-exists',
        questionText: 'Was magst du an ihr?',
        value: 'Alles.',
      })],
    }
    const md = exportAsMarkdown(data)
    expect(md).toContain('Was magst du an ihr?')
    expect(md).toContain('Alles.')
  })

  it('falls back to "Frage nicht mehr verfügbar" for unknown IDs with no stored text', () => {
    const data: ExportData = {
      ...EMPTY,
      profile: makeProfile(),
      friends: [makeFriend()],
      friendAnswers: [makeFriendAnswer({ questionId: 'completely-gone-id' })],
    }
    expect(exportAsMarkdown(data)).toContain('Frage nicht mehr verfügbar')
  })

  it('resolves known friend question IDs via FRIEND_QUESTIONS lookup', () => {
    const data: ExportData = {
      ...EMPTY,
      profile: makeProfile('Hanna'),
      friends: [makeFriend()],
      friendAnswers: [makeFriendAnswer({ questionId: 'friend-f1', value: 'Im Verein' })],
    }
    const md = exportAsMarkdown(data)
    expect(md).toContain('Im Verein')
    expect(md).not.toContain('Frage nicht mehr verfügbar')
  })

  it('substitutes {name} placeholder with profile name', () => {
    const data: ExportData = {
      ...EMPTY,
      profile: makeProfile('Hanna'),
      friends: [makeFriend()],
      // friend-f2: 'Was war dein erster Eindruck von {name}?'
      friendAnswers: [makeFriendAnswer({ questionId: 'friend-f2', value: 'Sehr sympathisch' })],
    }
    const md = exportAsMarkdown(data)
    expect(md).toContain('Hanna')
    expect(md).not.toContain('{name}')
  })

  it('includes custom questions section when answered', () => {
    const data: ExportData = {
      ...EMPTY,
      profile: makeProfile(),
      customQuestions: [{
        id: 'cq-1',
        text: 'Deine persönliche Frage?',
        type: 'text',
        createdAt: '2024-01-01T00:00:00.000Z',
      }],
      answers: { 'cq-1': makeAnswer('cq-1', 'custom', 'Meine persönliche Antwort') },
    }
    const md = exportAsMarkdown(data)
    expect(md).toContain('Eigene Fragen')
    expect(md).toContain('Deine persönliche Frage?')
    expect(md).toContain('Meine persönliche Antwort')
  })

  it('includes friend section heading when friend has answers', () => {
    const data: ExportData = {
      ...EMPTY,
      profile: makeProfile('Max'),
      friends: [makeFriend('f-1', 'Petra')],
      friendAnswers: [makeFriendAnswer({ friendId: 'f-1', friendName: 'Petra', value: 'Antwort' })],
    }
    const md = exportAsMarkdown(data)
    expect(md).toContain('Was Freunde über mich sagen')
    expect(md).toContain('Petra')
  })

  it('ends with Remember Me footer', () => {
    const md = exportAsMarkdown(EMPTY)
    expect(md).toContain('Remember Me')
  })
})

// ── exportAsEnrichedJSON ──────────────────────────────────────────────────────

describe('exportAsEnrichedJSON', () => {
  it('produces valid JSON', () => {
    expect(() => JSON.parse(exportAsEnrichedJSON(EMPTY))).not.toThrow()
  })

  it('includes profile section with name, birthYear, memberSince', () => {
    const data = { ...EMPTY, profile: makeProfile('Max', 1975) }
    const json = JSON.parse(exportAsEnrichedJSON(data))
    expect(json.profile.name).toBe('Max')
    expect(json.profile.birthYear).toBe(1975)
    expect(json.profile.memberSince).toBe('2024-01-01')
  })

  it('includes answered category with question text and answer', () => {
    const q = CATEGORIES[0].questions[0]
    const data = {
      ...EMPTY,
      profile: makeProfile(),
      answers: { [q.id]: makeAnswer(q.id, q.categoryId, 'Meine Antwort') },
    }
    const { categories } = JSON.parse(exportAsEnrichedJSON(data))
    expect(categories).toHaveLength(1)
    expect(categories[0].id).toBe('childhood')
    expect(categories[0].answers[0].question).toBe(q.text)
    expect(categories[0].answers[0].answer).toBe('Meine Antwort')
  })

  it('omits empty categories', () => {
    const { categories } = JSON.parse(exportAsEnrichedJSON(EMPTY))
    expect(categories).toEqual([])
  })

  it('omits customQuestions key when none are answered', () => {
    const { customQuestions } = JSON.parse(exportAsEnrichedJSON(EMPTY))
    expect(customQuestions).toBeUndefined()
  })

  it('includes friend perspectives when present', () => {
    const data: ExportData = {
      ...EMPTY,
      profile: makeProfile(),
      friends: [makeFriend('f-1', 'Petra')],
      friendAnswers: [makeFriendAnswer({
        friendId: 'f-1',
        friendName: 'Petra',
        questionText: 'Was schätzt du?',
        value: 'Vieles',
      })],
    }
    const { friendPerspectives } = JSON.parse(exportAsEnrichedJSON(data))
    expect(friendPerspectives).toHaveLength(1)
    expect(friendPerspectives[0].friendName).toBe('Petra')
    expect(friendPerspectives[0].answers[0].answer).toBe('Vieles')
  })

  it('omits friendPerspectives key when none exist', () => {
    const { friendPerspectives } = JSON.parse(exportAsEnrichedJSON(EMPTY))
    expect(friendPerspectives).toBeUndefined()
  })
})

describe('downloadFile', () => {
  it('creates an object URL, appends an anchor, clicks it, and cleans up', () => {
    // Mock URL functions
    const createObjectURL = vi.fn(() => 'blob:test-url')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })

    // Spy on DOM methods
    const appendSpy = vi.spyOn(document.body, 'appendChild')
    const removeSpy = vi.spyOn(document.body, 'removeChild')
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    downloadFile('test content', 'test-file.txt', 'text/plain')

    // Verify Blob creation and URL generation
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    const blobArg = createObjectURL.mock.calls[0][0]
    expect(blobArg).toBeInstanceOf(Blob)
    expect(blobArg.type).toBe('text/plain')

    // Verify DOM manipulation and click
    expect(appendSpy).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(removeSpy).toHaveBeenCalledTimes(1)

    const appendedNode = appendSpy.mock.calls[0][0] as HTMLAnchorElement
    expect(appendedNode.tagName).toBe('A')
    expect(appendedNode.href).toMatch(/blob:.*test-url/)
    expect(appendedNode.download).toBe('test-file.txt')

    const removedNode = removeSpy.mock.calls[0][0]
    expect(removedNode).toBe(appendedNode)

    // Verify cleanup
    expect(revokeObjectURL).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-url')

    // Restore all mocks and stubs
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })
})

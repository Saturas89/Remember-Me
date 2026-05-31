import { describe, it, expect } from 'vitest'
import { answerHasContent } from './answerContent'

describe('answerHasContent', () => {
  it('treats empty and whitespace-only text as no content', () => {
    expect(answerHasContent({ value: '' })).toBe(false)
    expect(answerHasContent({ value: '   \n\t' })).toBe(false)
  })

  it('counts non-empty text as content', () => {
    expect(answerHasContent({ value: 'hello' })).toBe(true)
  })

  it('counts each media type as content even without text', () => {
    expect(answerHasContent({ value: '', imageIds: ['i1'] })).toBe(true)
    expect(answerHasContent({ value: '', videoIds: ['v1'] })).toBe(true)
    expect(answerHasContent({ value: '', audioId: 'a1' })).toBe(true)
    expect(answerHasContent({ value: '', audioTranscript: 'spoken words' })).toBe(true)
  })

  it('ignores empty media arrays', () => {
    expect(answerHasContent({ value: '', imageIds: [], videoIds: [] })).toBe(false)
  })

  it('handles null media fields', () => {
    expect(answerHasContent({ value: '', audioId: null, audioTranscript: null })).toBe(false)
  })
})

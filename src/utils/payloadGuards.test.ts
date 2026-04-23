import { describe, it, expect } from 'vitest'
import {
  validateInviteData,
  validateAnswerExport,
  validateMemorySharePayload,
  validateContactHandshake,
} from './payloadGuards'

describe('validateInviteData', () => {
  it('accepts the minimal valid shape', () => {
    expect(validateInviteData({ profileName: 'Anna' })).toEqual({
      profileName: 'Anna',
      friendId: undefined,
      topicId: undefined,
    })
  })

  it('passes through optional friendId / topicId', () => {
    expect(
      validateInviteData({ profileName: 'Anna', friendId: 'f-1', topicId: 't-1' }),
    ).toEqual({ profileName: 'Anna', friendId: 'f-1', topicId: 't-1' })
  })

  it('rejects missing profileName', () => {
    expect(validateInviteData({})).toBeNull()
  })

  it('rejects wrong-type profileName', () => {
    expect(validateInviteData({ profileName: 42 })).toBeNull()
  })

  it('rejects non-string topicId when present', () => {
    expect(validateInviteData({ profileName: 'Anna', topicId: 99 })).toBeNull()
  })

  it('rejects profileName that would blow up the UI', () => {
    expect(validateInviteData({ profileName: 'x'.repeat(10_000) })).toBeNull()
  })

  it('rejects non-object input', () => {
    expect(validateInviteData(null)).toBeNull()
    expect(validateInviteData('string')).toBeNull()
    expect(validateInviteData([])).toEqual(null) // array is typeof object but no profileName
  })
})

describe('validateAnswerExport', () => {
  const ok = {
    friendId: 'f-1',
    friendName: 'Klaus',
    answers: [{ questionId: 'q1', value: 'Antwort' }],
  }

  it('accepts the full valid shape', () => {
    expect(validateAnswerExport(ok)).toEqual(ok)
  })

  it('accepts empty answers list', () => {
    expect(validateAnswerExport({ ...ok, answers: [] })?.answers).toEqual([])
  })

  it('accepts empty friendName', () => {
    expect(validateAnswerExport({ ...ok, friendName: '' })?.friendName).toBe('')
  })

  it('rejects non-array answers', () => {
    expect(validateAnswerExport({ ...ok, answers: 'nope' })).toBeNull()
  })

  it('rejects answers with wrong-type questionId', () => {
    expect(
      validateAnswerExport({ ...ok, answers: [{ questionId: 0, value: 'x' }] }),
    ).toBeNull()
  })

  it('rejects oversized answers array', () => {
    const huge = Array.from({ length: 600 }, (_, i) => ({
      questionId: `q${i}`,
      value: 'x',
    }))
    expect(validateAnswerExport({ ...ok, answers: huge })).toBeNull()
  })

  it('rejects oversized answer value (DoS guard)', () => {
    expect(
      validateAnswerExport({
        ...ok,
        answers: [{ questionId: 'q1', value: 'x'.repeat(100_000) }],
      }),
    ).toBeNull()
  })
})

describe('validateMemorySharePayload', () => {
  it('accepts a minimal payload', () => {
    expect(validateMemorySharePayload({ memories: [{ title: 'Hallo' }] })).toEqual({
      memories: [{ title: 'Hallo', content: undefined }],
      sharedBy: undefined,
    })
  })

  it('passes through optional content + sharedBy', () => {
    expect(
      validateMemorySharePayload({
        memories: [{ title: 'A', content: 'B' }],
        sharedBy: 'Anna',
      }),
    ).toEqual({
      memories: [{ title: 'A', content: 'B' }],
      sharedBy: 'Anna',
    })
  })

  it('rejects non-array memories', () => {
    expect(validateMemorySharePayload({ memories: 99 })).toBeNull()
  })

  it('rejects an entry with non-string title', () => {
    expect(validateMemorySharePayload({ memories: [{ title: 42 }] })).toBeNull()
  })

  it('rejects oversized memories array', () => {
    const big = Array.from({ length: 600 }, () => ({ title: 'x' }))
    expect(validateMemorySharePayload({ memories: big })).toBeNull()
  })
})

describe('validateContactHandshake', () => {
  const ok = {
    $type: 'remember-me-contact',
    version: 1,
    deviceId: 'abc-123',
    publicKey: 'AAAA-BBBB_CCCC',
    displayName: 'Anna',
  }

  it('accepts a valid handshake', () => {
    expect(validateContactHandshake(ok)).toEqual(ok)
  })

  it('rejects wrong $type', () => {
    expect(validateContactHandshake({ ...ok, $type: 'phishing' })).toBeNull()
  })

  it('rejects missing deviceId', () => {
    expect(validateContactHandshake({ ...ok, deviceId: '' })).toBeNull()
  })

  it('rejects publicKey with non-base64url chars', () => {
    expect(validateContactHandshake({ ...ok, publicKey: 'has spaces!' })).toBeNull()
  })

  it('rejects absurdly long publicKey', () => {
    expect(
      validateContactHandshake({ ...ok, publicKey: 'A'.repeat(5_000) }),
    ).toBeNull()
  })

  it('accepts empty displayName (users may stay anonymous)', () => {
    expect(validateContactHandshake({ ...ok, displayName: '' })?.displayName).toBe('')
  })

  it('rejects oversized displayName', () => {
    expect(
      validateContactHandshake({ ...ok, displayName: 'x'.repeat(1_000) }),
    ).toBeNull()
  })
})

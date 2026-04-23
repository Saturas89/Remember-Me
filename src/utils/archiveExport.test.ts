import { describe, it, expect, vi, beforeEach } from 'vitest'
import JSZip from 'jszip'
import type { ExportData } from './export'
import type { Answer } from '../types'

// ── Mocks for the IDB-backed media stores ─────────────────────────────────
const imageMap = new Map<string, string>()
const audioMap = new Map<string, Blob>()
const videoMap = new Map<string, Blob>()

vi.mock('../hooks/useImageStore', () => ({
  getImageDataUrl: vi.fn(async (id: string) => imageMap.get(id)),
  putImageById: vi.fn(async (id: string, url: string) => { imageMap.set(id, url) }),
  useImageStore: () => ({ cache: {}, loadImages: vi.fn(), addImage: vi.fn(), removeImage: vi.fn() }),
}))
vi.mock('../hooks/useAudioStore', () => ({
  getAudioBlob: vi.fn(async (id: string) => audioMap.get(id) ?? null),
  addAudio: vi.fn(),
  removeAudio: vi.fn(),
  putAudioById: vi.fn(),
}))
vi.mock('../hooks/useVideoStore', () => ({
  getVideoBlob: vi.fn(async (id: string) => videoMap.get(id) ?? null),
  addVideo: vi.fn(),
  removeVideo: vi.fn(),
  putVideoById: vi.fn(),
}))

import {
  buildMemoryArchive,
  buildFriendAnswerArchive,
  fmtBytes,
} from './archiveExport'

// ── Helpers ──────────────────────────────────────────────────────────────

function makeAnswer(overrides: Partial<Answer> = {}): Answer {
  return {
    id: 'q1',
    questionId: 'q1',
    categoryId: 'childhood',
    value: 'antwort',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function emptyExportData(): ExportData {
  return {
    profile: { name: 'Anna', createdAt: '2024-01-01T00:00:00.000Z' },
    answers: {},
    friends: [],
    friendAnswers: [],
    customQuestions: [],
  }
}

function readBlob(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
}

async function unzip(blob: Blob): Promise<JSZip> {
  return await JSZip.loadAsync(await readBlob(blob))
}

// ── Reset stores between tests ───────────────────────────────────────────

beforeEach(() => {
  imageMap.clear()
  audioMap.clear()
  videoMap.clear()
})

// ── fmtBytes ─────────────────────────────────────────────────────────────

describe('fmtBytes', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1024, '1.0 KB'],
    [1536, '1.5 KB'],
    [1024 * 1024, '1.0 MB'],
    [5 * 1024 * 1024, '5.0 MB'],
  ])('formats %d bytes as %s', (bytes, expected) => {
    expect(fmtBytes(bytes)).toBe(expected)
  })
})

// ── buildMemoryArchive ───────────────────────────────────────────────────

describe('buildMemoryArchive', () => {
  it('writes memories.json at the root and returns the ZIP blob', async () => {
    const { blob, stats } = await buildMemoryArchive({ data: emptyExportData() })
    expect(blob.size).toBeGreaterThan(0)
    expect(stats).toEqual({ photoCount: 0, audioCount: 0, videoCount: 0, totalBytes: blob.size })
    const zip = await unzip(blob)
    expect(zip.file('memories.json')).not.toBeNull()
  })

  it('includes all media referenced by answers (photos, audio, videos)', async () => {
    imageMap.set('img-1', 'data:image/jpeg;base64,QUJD')
    imageMap.set('img-2', 'data:image/jpeg;base64,REVG')
    audioMap.set('aud-1', new Blob(['audio-bytes'], { type: 'audio/webm' }))
    videoMap.set('vid-1', new Blob(['video-bytes'], { type: 'video/mp4' }))

    const data = emptyExportData()
    data.answers['q1'] = makeAnswer({
      imageIds: ['img-1', 'img-2'],
      audioId: 'aud-1',
      videoIds: ['vid-1'],
    })

    const { blob, stats } = await buildMemoryArchive({ data })
    expect(stats.photoCount).toBe(2)
    expect(stats.audioCount).toBe(1)
    expect(stats.videoCount).toBe(1)

    const zip = await unzip(blob)
    expect(zip.file('photos/img-1.jpg')).not.toBeNull()
    expect(zip.file('photos/img-2.jpg')).not.toBeNull()
    expect(zip.file('audio/aud-1.webm')).not.toBeNull()
    expect(zip.file('videos/vid-1.mp4')).not.toBeNull()
  })

  it('picks webm for opus audio, mp4 for mp4, mov for quicktime videos', async () => {
    audioMap.set('aud-mp4', new Blob(['x'], { type: 'audio/mp4' }))
    audioMap.set('aud-webm', new Blob(['x'], { type: 'audio/webm;codecs=opus' }))
    videoMap.set('vid-mov', new Blob(['x'], { type: 'video/quicktime' }))
    videoMap.set('vid-webm', new Blob(['x'], { type: 'video/webm' }))

    const data = emptyExportData()
    data.answers['q1'] = makeAnswer({ audioId: 'aud-mp4',  videoIds: ['vid-mov'] })
    data.answers['q2'] = makeAnswer({ id: 'q2', audioId: 'aud-webm', videoIds: ['vid-webm'] })

    const { blob } = await buildMemoryArchive({ data })
    const zip = await unzip(blob)
    expect(zip.file('audio/aud-mp4.mp4')).not.toBeNull()
    expect(zip.file('audio/aud-webm.webm')).not.toBeNull()
    expect(zip.file('videos/vid-mov.mov')).not.toBeNull()
    expect(zip.file('videos/vid-webm.webm')).not.toBeNull()
  })

  it('skips media that cannot be resolved (store returned undefined/null)', async () => {
    const data = emptyExportData()
    data.answers['q1'] = makeAnswer({ imageIds: ['missing-img'], audioId: 'missing-aud' })
    const { stats } = await buildMemoryArchive({ data })
    expect(stats.photoCount).toBe(0)
    expect(stats.audioCount).toBe(0)
  })

  it('reports progress through the onProgress callback', async () => {
    const onProgress = vi.fn()
    await buildMemoryArchive({ data: emptyExportData(), onProgress })
    expect(onProgress).toHaveBeenCalled()
    const percents = onProgress.mock.calls.map(([, pct]) => pct as number)
    expect(Math.min(...percents)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...percents)).toBeLessThanOrEqual(100)
  })
})

// ── buildFriendAnswerArchive ─────────────────────────────────────────────

describe('buildFriendAnswerArchive', () => {
  it('creates a ZIP with friend-answers.json and the expected $type marker', async () => {
    const { blob } = await buildFriendAnswerArchive({
      friendId: 'f-1',
      friendName: 'Ben',
      answers: [
        { questionId: 'friend-f1', value: 'answer', questionText: 'Q?', imageIds: [], videoIds: [] },
      ],
    })
    const zip = await unzip(blob)
    const payload = JSON.parse(await zip.file('friend-answers.json')!.async('text'))
    expect(payload.$type).toBe('remember-me-friend-answers')
    expect(payload.version).toBe(1)
    expect(payload.friendId).toBe('f-1')
    expect(payload.friendName).toBe('Ben')
    expect(payload.answers).toHaveLength(1)
    expect(payload.answers[0].value).toBe('answer')
  })

  it('packs media files under deterministic ai/vi-indexed paths', async () => {
    imageMap.set('img-a', 'data:image/jpeg;base64,QUJD')
    audioMap.set('aud-a', new Blob(['x'], { type: 'audio/webm' }))
    videoMap.set('vid-a', new Blob(['x'], { type: 'video/mp4' }))

    const { blob, stats } = await buildFriendAnswerArchive({
      friendId: 'f-1',
      friendName: 'Ben',
      answers: [
        {
          questionId: 'friend-f1',
          value: 'a',
          questionText: 'Q',
          imageIds: ['img-a'],
          audioId: 'aud-a',
          videoIds: ['vid-a'],
        },
      ],
    })
    expect(stats).toMatchObject({ photoCount: 1, audioCount: 1, videoCount: 1 })

    const zip = await unzip(blob)
    expect(zip.file('photos/photo-0-0.jpg')).not.toBeNull()
    expect(zip.file('audio/audio-0.webm')).not.toBeNull()
    expect(zip.file('videos/video-0-0.mp4')).not.toBeNull()

    const payload = JSON.parse(await zip.file('friend-answers.json')!.async('text'))
    expect(payload.answers[0].imageFiles).toEqual(['photos/photo-0-0.jpg'])
    expect(payload.answers[0].audioFile).toBe('audio/audio-0.webm')
    expect(payload.answers[0].videoFiles).toEqual(['videos/video-0-0.mp4'])
  })

  it('leaves imageFiles/videoFiles undefined when there is no media', async () => {
    const { blob } = await buildFriendAnswerArchive({
      friendId: 'f-1',
      friendName: 'Ben',
      answers: [
        { questionId: 'friend-f1', value: 'a', questionText: 'Q', imageIds: [], videoIds: [] },
      ],
    })
    const zip = await unzip(blob)
    const payload = JSON.parse(await zip.file('friend-answers.json')!.async('text'))
    expect(payload.answers[0].imageFiles).toBeUndefined()
    expect(payload.answers[0].videoFiles).toBeUndefined()
    expect(payload.answers[0].audioFile).toBeUndefined()
  })
})

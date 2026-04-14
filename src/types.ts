export type QuestionType = 'text' | 'choice' | 'scale' | 'year'

export interface Question {
  id: string
  categoryId: string
  type: QuestionType
  text: string          // may contain {name} placeholder
  helpText?: string
  options?: string[]
  scaleMin?: string
  scaleMax?: string
}

export interface Category {
  id: string
  title: string
  description: string
  emoji: string
  questions: Question[]
}

export interface Answer {
  id: string
  questionId: string
  categoryId: string
  value: string
  imageIds?: string[]
  /** IDs of video recordings stored in IndexedDB ('rm-videos') */
  videoIds?: string[]
  /** ID of the audio recording stored in IndexedDB ('rm-audio') */
  audioId?: string
  /** ISO 8601 timestamp of when the audio was transcribed */
  audioTranscribedAt?: string
  createdAt: string
  updatedAt: string
  /** ISO 8601 date of the actual event (may differ from createdAt for imported entries) */
  eventDate?: string
  /** Set when the answer was imported from a social media platform */
  importSource?: {
    platform: 'instagram' | 'facebook'
    originalId: string
    originalCaption?: string
    importedAt: string
  }
}

export interface Profile {
  name: string
  birthYear?: number
  createdAt: string
}

export interface Friend {
  id: string
  name: string
  addedAt: string
}

export interface FriendAnswer {
  id: string
  friendId: string
  friendName: string
  questionId: string
  /** Resolved question text (with {name} substituted). Stored for resilience
   *  so the archive never depends on runtime ID lookup. */
  questionText?: string
  value: string
  createdAt: string
}

export interface CustomQuestion {
  id: string
  text: string
  helpText?: string
  type: 'text' | 'choice' | 'scale'
  options?: string[]
  createdAt: string
}

export interface AppState {
  profile: Profile | null
  answers: Record<string, Answer>
  friends: Friend[]
  friendAnswers: FriendAnswer[]
  customQuestions: CustomQuestion[]
}

/** A shareable bundle of custom questions */
export interface QuestionPack {
  questions: CustomQuestion[]
  createdBy?: string
}

/** Payload embedded in a #ms/ memory-share URL */
export interface MemorySharePayload {
  memories: Array<{ title: string; content?: string }>
  sharedBy?: string
}

/** Encoded inside the invite URL shared with a friend.
 *
 *  `friendId` and `topicId` are optional so the same permanent link can be
 *  reused for many friends: each friend picks their own name and topic in
 *  FriendAnswerView, and a fresh friendId is generated on submit. */
export interface InviteData {
  profileName: string
  friendId?: string
  topicId?: string
}

/** Encoded as a text code that the friend sends back after answering */
export interface AnswerExport {
  friendId: string
  friendName: string
  answers: Array<{
    questionId: string
    value: string
    /** Resolved question text included so the receiver can display it without a lookup */
    questionText?: string
  }>
}

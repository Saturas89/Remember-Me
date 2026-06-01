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
  /** ID of the audio recording stored in IndexedDB ('rm-audio') – optional, only set when user chose to save the audio file */
  audioId?: string
  /** ISO 8601 timestamp of when the audio was transcribed */
  audioTranscribedAt?: string
  /** Text transcript of the audio recording – always stored when audio is recorded */
  audioTranscript?: string
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
  updatedAt?: string
}

export interface Friend {
  id: string
  name: string
  addedAt: string
  /** Online-sharing contact handshake (optional). Present when the friend was
   *  linked via a #contact/ invite so we can end-to-end-encrypt memories to them.
   *  Absent for friends that only use the URL/ZIP fallback flow – those still work
   *  without any server contact. */
  online?: {
    deviceId: string      // opaque UUID, same as Supabase devices.id
    publicKey: string     // ECDH P-256 SPKI as base64url
    linkedAt: string
    /** Binary share decision (REQ-022). When true, every saved Answer is
     *  auto-shared with this friend; when false, nothing is sent. Friends
     *  loaded from older storage without this field are migrated to true. */
    shareAll: boolean
  }
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
  imageIds?: string[]
  videoIds?: string[]
  audioId?: string
  createdAt: string
}

/** Written as `friend-answers.json` inside a friend-answer ZIP */
export const FRIEND_ANSWER_ZIP_TYPE = 'remember-me-friend-answers'

export interface FriendAnswerZipPayload {
  $type: typeof FRIEND_ANSWER_ZIP_TYPE
  version: 1
  exportedAt: string
  friendId: string
  friendName: string
  answers: Array<{
    questionId: string
    value: string
    questionText?: string
    /** Stable ZIP-internal paths, e.g. "photos/photo-0-0.jpg". Not IndexedDB IDs. */
    imageFiles?: string[]
    audioFile?: string
    videoFiles?: string[]
  }>
}

export interface FriendTopic {
  id: string
  title: string
  emoji: string
  description: string
  questions: Question[]
}

export interface CustomQuestion {
  id: string
  text: string
  helpText?: string
  type: 'text' | 'choice' | 'scale'
  options?: string[]
  createdAt: string
}

export type SyncProviderType = 'google-drive' | 'onedrive' | 'supabase'
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'success'

export interface PrivateSyncState {
  providerType: SyncProviderType
  userId: string
  lastSyncAt: string | null
  status: SyncStatus
  errorMessage: string | null
  encryption?: 'recovery-code'
}

export type AppMode = 'simple' | 'full'

/** Soft-deletion registry (tombstones). Maps a deleted record's id to the ISO
 *  timestamp it was deleted, per collection. Without this, a record removed on
 *  one device gets resurrected by another device on the next sync because the
 *  union-merge can't tell "never seen" from "deliberately deleted". */
export interface DeletionTombstones {
  answers?: Record<string, string>
  friends?: Record<string, string>
  friendAnswers?: Record<string, string>
  customQuestions?: Record<string, string>
}

export interface AppState {
  /** Schema version of this persisted state (see lib/appStateSchema). Absent on
   *  states written before versioning was introduced ⇒ treated as version 1. */
  schemaVersion?: number
  profile: Profile | null
  answers: Record<string, Answer>
  friends: Friend[]
  friendAnswers: FriendAnswer[]
  customQuestions: CustomQuestion[]
  /** Undefined until the user explicitly opts in to online sharing.
   *  Absent ⇒ no Supabase module is ever loaded, no network requests are made. */
  onlineSharing?: OnlineSharingState
  /** Optional streak tracking for engagement notifications */
  streak?: {
    current: number
    longest: number
    lastAnswerDate: string   // ISO 8601 (YYYY-MM-DD)
  }
  /** Undefined until the user explicitly opts in to private sync. */
  privateSync?: PrivateSyncState
  /** Undefined ⇒ user hasn't picked yet (triggers mode-choice in onboarding). */
  appMode?: AppMode
  /** Tombstones for records deleted on this (or a synced) device. */
  deletions?: DeletionTombstones
}

export interface OnlineSharingState {
  enabled: boolean
  activatedAt?: string
  /** Opaque device UUID registered on the sync server. */
  deviceId?: string
  /** ECDH public key (SPKI base64url). Server also has this – needed for other
   *  devices to encrypt memories to us. */
  publicKey?: string
}

// ── Online sharing payload schemas ──────────────────────────────────────────
//
// Everything in these structures is encrypted client-side before it touches
// the server. The plaintext forms below are what lives on the user's device
// after successful decryption.

/** The plaintext body of a shared memory, before AES-GCM encryption. */
export interface ShareBody {
  $type: 'remember-me-share'
  version: 1
  questionId?: string
  questionText: string
  value: string
  imageCount: number
  createdAt: string
  ownerName: string
}

/** A shared memory that arrived from another device (post-decryption). */
export interface SharedMemory {
  shareId: string
  ownerDeviceId: string
  ownerName: string
  questionId?: string
  questionText: string
  value: string
  imageIds: string[]        // IndexedDB IDs after local media download
  createdAt: string
  updatedAt: string
}

/** The plaintext body of an annotation ("Ergänzung"). */
export interface AnnotationBody {
  $type: 'remember-me-annotation'
  version: 1
  text: string
  imageCount: number
  authorName: string
  createdAt: string
}

/** An annotation on a shared memory (post-decryption). */
export interface Annotation {
  annotationId: string
  shareId: string
  authorDeviceId: string
  authorName: string
  text: string
  imageIds: string[]
  createdAt: string
}

/** Payload of a #contact/ handshake URL – how two devices link up. */
export interface ContactHandshake {
  $type: 'remember-me-contact'
  version: 1
  deviceId: string
  publicKey: string    // base64url SPKI
  displayName: string
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

// Sandra-Flow types (REQ-020) live in `./types/sandraFlow.ts` — see there for
// PersonalPackMeta, PersonalQuestionPack, SandraDraft, ComposedQuestion,
// TemplateDef, TriggerDef. Imported via `from './types/sandraFlow'`.

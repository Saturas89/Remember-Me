/**
 * Single source of truth for "does this answer hold any meaningful content?".
 *
 * Before this helper the predicate was copy-pasted across nine call sites with
 * three subtly different definitions (some omitted video/audio, some omitted the
 * transcript), so the same record could count as "answered" in one view and
 * "empty" in another. Everything that decides whether an answer is substantive
 * must route through here.
 */

/** Structural shape shared by `Answer` and `FriendAnswer`. */
export interface AnswerLike {
  value: string
  imageIds?: string[]
  videoIds?: string[]
  audioId?: string | null
  audioTranscript?: string | null
}

/** True when the answer has text, an image, a video, recorded audio, or a
 *  transcript. Whitespace-only text counts as empty. */
export function answerHasContent(a: AnswerLike): boolean {
  return (
    a.value.trim() !== '' ||
    (a.imageIds?.length ?? 0) > 0 ||
    (a.videoIds?.length ?? 0) > 0 ||
    !!a.audioId ||
    !!a.audioTranscript
  )
}

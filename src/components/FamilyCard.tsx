import type { Friend, FriendAnswer } from '../types'
import { FRIEND_QUESTIONS } from '../data/friendQuestions'
import { answerHasContent } from '../lib/answerContent'
import { useTranslation } from '../locales'

function avatarColor(name: string): string {
  const hue = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  return `hsl(${hue}, 55%, 38%)`
}

/** Pick the most recent createdAt among answers as the family member's last
 *  activity. Maps to a relative-date string via the locale, so Sandra can spot
 *  inactive contributors without having to ask via WhatsApp (#167). */
function formatLastActive(
  iso: string,
  s: ReturnType<typeof useTranslation>['t']['friends'],
): string {
  const now = Date.now()
  const diffMs = Math.max(0, now - new Date(iso).getTime())
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000))
  if (days <= 0) return s.lastActiveToday
  if (days === 1) return s.lastActiveYesterday
  if (days < 14) return s.lastActiveDays.replace('{n}', String(days))
  const weeks = Math.floor(days / 7)
  if (weeks < 8) return s.lastActiveWeeks.replace('{n}', String(weeks))
  const months = Math.floor(days / 30)
  return s.lastActiveMonths.replace('{n}', String(months))
}

interface Props {
  friend: Friend
  answers: FriendAnswer[]
  onRemove: () => void
}

export function FamilyCard({ friend, answers, onRemove }: Props) {
  const { t } = useTranslation()
  const answered = answers.filter(answerHasContent).length
  const progress = Math.round((answered / FRIEND_QUESTIONS.length) * 100)

  // Most recent activity = latest createdAt across substantive answers.
  // Falls back to friend.addedAt when there are no answers yet so the card
  // still gives Sandra a date anchor.
  const lastActivityIso = answers.length > 0
    ? answers.reduce((latest, a) => (a.createdAt > latest ? a.createdAt : latest), answers[0].createdAt)
    : friend.addedAt
  const lastActiveLabel = formatLastActive(lastActivityIso, t.friends)

  return (
    <div className="family-card">
      <div className="family-card__avatar" style={{ background: avatarColor(friend.name) }}>
        {friend.name.charAt(0).toUpperCase()}
      </div>
      <div className="family-card__body">
        <span className="family-card__name">{friend.name}</span>
        <span className="family-card__status">
          {answered > 0
            ? t.friends.friendAnsweredCount
                .replace('{answered}', String(answered))
                .replace('{total}', String(FRIEND_QUESTIONS.length))
            : t.friends.friendNoAnswers}
        </span>
        <span className="family-card__last-active">{lastActiveLabel}</span>
        {answered > 0 && (
          <div className="family-progress-bar">
            <div className="family-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      <div className="family-card__actions">
        <button className="btn btn--ghost btn--sm" onClick={onRemove} title={t.friends.friendRemoveTitle}>
          ✕
        </button>
      </div>
    </div>
  )
}

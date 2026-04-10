import type { Friend, FriendAnswer } from '../types'
import { FRIEND_QUESTIONS } from '../data/friendQuestions'

function avatarColor(name: string): string {
  const hue = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  return `hsl(${hue}, 55%, 38%)`
}

interface Props {
  friend: Friend
  answers: FriendAnswer[]
  onInvite: () => void
  onRemove: () => void
}

export function FriendCard({ friend, answers, onInvite, onRemove }: Props) {
  const answered = answers.filter(a => a.value.trim()).length
  const progress = Math.round((answered / FRIEND_QUESTIONS.length) * 100)

  return (
    <div className="friend-card">
      <div className="friend-card__avatar" style={{ background: avatarColor(friend.name) }}>
        {friend.name.charAt(0).toUpperCase()}
      </div>
      <div className="friend-card__body">
        <span className="friend-card__name">{friend.name}</span>
        <span className="friend-card__status">
          {answered > 0
            ? `${answered} von ${FRIEND_QUESTIONS.length} Fragen beantwortet`
            : 'Noch keine Antworten'}
        </span>
        {answered > 0 && (
          <div className="friend-progress-bar">
            <div className="friend-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      <div className="friend-card__actions">
        <button className="btn btn--outline btn--sm" onClick={onInvite} title="Einladungslink">
          🔗 Link
        </button>
        <button className="btn btn--ghost btn--sm" onClick={onRemove} title="Entfernen">
          ✕
        </button>
      </div>
    </div>
  )
}

import type { MemorySharePayload } from '../types'

interface Props {
  payload: MemorySharePayload
}

export function SharedMemoryView({ payload }: Props) {
  const { memories, sharedBy } = payload

  return (
    <div className="friend-answer-view">
      <div className="friend-welcome shared-memory">
        <div className="friend-welcome__icon">📖</div>
        <h1>Geteilte Erinnerung</h1>
        {sharedBy && (
          <p>
            <strong>{sharedBy}</strong> hat {memories.length === 1 ? 'eine Erinnerung' : 'Erinnerungen'} mit dir geteilt.
          </p>
        )}

        <div className="shared-memory__list">
          {memories.map((m, i) => (
            <div key={i} className="archive-entry shared-memory__entry">
              <p className="archive-entry__question">{m.title}</p>
              {m.content && (
                <p className="archive-entry__answer shared-memory__answer">{m.content}</p>
              )}
            </div>
          ))}
        </div>

        <p className="shared-memory__cta">
          Möchtest du deine eigenen Erinnerungen festhalten?{' '}
          <a href="/" className="shared-memory__link">Remember Me öffnen →</a>
        </p>
      </div>
    </div>
  )
}

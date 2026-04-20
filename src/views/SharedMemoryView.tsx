import type { MemorySharePayload } from '../types'

interface Props {
  payload: MemorySharePayload
}

export function SharedMemoryView({ payload }: Props) {
  const { memories, sharedBy } = payload

  return (
    <div className="friend-answer-view">
      <div className="friend-welcome" style={{ textAlign: 'left', maxWidth: '560px' }}>
        <div className="friend-welcome__icon">📖</div>
        <h1>Geteilte Erinnerung</h1>
        {sharedBy && (
          <p>
            <strong>{sharedBy}</strong> hat {memories.length === 1 ? 'eine Erinnerung' : 'Erinnerungen'} mit dir geteilt.
          </p>
        )}

        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {memories.map((m, i) => (
            <div key={i} className="archive-entry" style={{ background: 'var(--card-bg, #1e1e3a)', borderRadius: '12px', padding: '1rem 1.25rem' }}>
              <p className="archive-entry__question">{m.title}</p>
              {m.content && (
                <p className="archive-entry__answer" style={{ whiteSpace: 'pre-wrap' }}>{m.content}</p>
              )}
            </div>
          ))}
        </div>

        <p style={{ marginTop: '1.5rem', color: 'var(--text-muted, #888)', fontSize: '0.85rem' }}>
          Möchtest du deine eigenen Erinnerungen festhalten?{' '}
          <a href="/" style={{ color: 'var(--accent, #a78bfa)' }}>
            Remember Me öffnen →
          </a>
        </p>
      </div>
    </div>
  )
}

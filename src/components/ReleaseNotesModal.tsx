import { useTranslation } from '../locales'
import { RELEASE_NOTES } from '../data/releaseNotes'

interface Props {
  onClose: () => void
}

export function ReleaseNotesModal({ onClose }: Props) {
  const { t } = useTranslation()

  return (
    <div className="release-notes-modal" role="dialog" aria-modal="true" aria-label={t.releaseNotes.title}>
      <div className="release-notes-modal__topbar">
        <button
          className="btn btn--ghost btn--sm"
          onClick={onClose}
          aria-label={t.releaseNotes.close}
        >
          {t.global.back}
        </button>
        <span className="release-notes-modal__title">{t.releaseNotes.title}</span>
      </div>
      <div className="release-notes-modal__body">
        {RELEASE_NOTES.map((entry, i) => (
          <div key={entry.version} className={`release-notes-entry${i === 0 ? ' release-notes-entry--current' : ''}`}>
            <div className="release-notes-entry__header">
              <span className="release-notes-entry__version">
                {t.releaseNotes.versionPrefix} {entry.version}
              </span>
              <span className="release-notes-entry__date">{entry.date}</span>
            </div>
            <ul className="release-notes-entry__list">
              {entry.highlights.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

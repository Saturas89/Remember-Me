import { useTranslation } from '../locales'

interface Props {
  onBack: () => void
}

const CONTACT_EMAIL = 'StoryholdApp@Gmail.com'
const PROVIDER_NAME = 'Alexander Arians'
const PROVIDER_STREET = 'Nachtigallenweg 3'
const PROVIDER_CITY = '50829 Köln'

export function PrivacyView({ onBack }: Props) {
  const { t } = useTranslation()
  const p = t.privacy

  return (
    <div className="impressum-view">
      <div className="quiz-topbar">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>
          {t.global.back}
        </button>
        <h2 className="archive-title">{p.title}</h2>
      </div>

      <p className="friends-hint">{p.intro}</p>

      {/* 1. Verantwortlicher */}
      <section className="friends-section">
        <h3 className="friends-section-title">{p.controllerHeading}</h3>
        <address className="impressum-address">
          <span>{PROVIDER_NAME}</span>
          <span>{PROVIDER_STREET}</span>
          <span>{PROVIDER_CITY}</span>
          <span>Deutschland</span>
          <span>
            {p.contactEmail}:{' '}
            <a className="impressum-link" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
          </span>
        </address>
      </section>

      {/* 2. Lokale Datenspeicherung */}
      <section className="friends-section">
        <h3 className="friends-section-title">{p.localStorageHeading}</h3>
        <p className="friends-hint">{p.localStorageBody}</p>
        <ul className="friends-hint">
          <li>{p.localStorageItem1}</li>
          <li>{p.localStorageItem2}</li>
          <li>{p.localStorageItem3}</li>
        </ul>
        <p className="friends-hint">{p.localStorageLegal}</p>
      </section>

      {/* 3. Cloud-Sync (optional) */}
      <section className="friends-section">
        <h3 className="friends-section-title">{p.cloudSyncHeading}</h3>
        <p className="friends-hint">{p.cloudSyncBody}</p>
        <p className="friends-hint">{p.cloudSyncLegal}</p>
      </section>

      {/* 4. Analytik */}
      <section className="friends-section">
        <h3 className="friends-section-title">{p.analyticsHeading}</h3>
        <p className="friends-hint">{p.analyticsBody}</p>
        <p className="friends-hint">{p.analyticsOptOut}</p>
      </section>

      {/* 5. Drittanbieter */}
      <section className="friends-section">
        <h3 className="friends-section-title">{p.thirdPartyHeading}</h3>
        <p className="friends-hint">{p.thirdPartyBody}</p>
        <ul className="friends-hint">
          <li>
            <strong>Supabase Inc.</strong> — {p.thirdPartySupabase}{' '}
            <a className="impressum-link" href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">
              supabase.com/privacy
            </a>
          </li>
          <li>
            <strong>PostHog Inc.</strong> — {p.thirdPartyPosthog}{' '}
            <a className="impressum-link" href="https://posthog.com/privacy" target="_blank" rel="noopener noreferrer">
              posthog.com/privacy
            </a>
          </li>
          <li>
            <strong>Google LLC / Microsoft Corporation</strong> — {p.thirdPartyDrive}
          </li>
        </ul>
      </section>

      {/* 6. Betroffenenrechte */}
      <section className="friends-section">
        <h3 className="friends-section-title">{p.rightsHeading}</h3>
        <p className="friends-hint">{p.rightsBody}</p>
        <ul className="friends-hint">
          <li>{p.rightsAccess}</li>
          <li>{p.rightsRectification}</li>
          <li>{p.rightsDeletion}</li>
          <li>{p.rightsPortability}</li>
          <li>{p.rightsObjection}</li>
        </ul>
        <p className="friends-hint">
          {p.rightsContact}{' '}
          <a className="impressum-link" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
        </p>
      </section>

      {/* 7. Aufsichtsbehörde */}
      <section className="friends-section">
        <h3 className="friends-section-title">{p.authorityHeading}</h3>
        <p className="friends-hint">{p.authorityBody}</p>
        <p className="friends-hint">
          {p.authorityName}
          {' — '}
          <a className="impressum-link" href="https://www.ldi.nrw.de" target="_blank" rel="noopener noreferrer">
            www.ldi.nrw.de
          </a>
        </p>
      </section>

      <p className="friends-hint friends-hint--muted">{p.lastUpdated}</p>
    </div>
  )
}

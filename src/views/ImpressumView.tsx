import { useTranslation } from '../locales'

interface Props {
  onBack: () => void
}

const PROVIDER_NAME = 'Alexander Arians'
const PROVIDER_STREET = 'Nachtigallenweg 3'
const PROVIDER_CITY = '50829 Köln'
const PROVIDER_COUNTRY = 'Deutschland'
const CONTACT_EMAIL = 'StoryholdApp@Gmail.com'

export function ImpressumView({ onBack }: Props) {
  const { t } = useTranslation()
  const i = t.impressum

  return (
    <div className="impressum-view">
      <div className="quiz-topbar">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>
          {t.global.back}
        </button>
        <h2 className="archive-title">{i.topbarTitle}</h2>
      </div>

      <p className="friends-intro">{i.intro}</p>

      <div className="friends-tags impressum-badges" aria-label="Storyhold trust badges">
        <span className="friends-tag friends-tag--accent">{i.badgeOpenSource}</span>
        <span className="friends-tag friends-tag--accent">{i.badgeMadeInGermany}</span>
      </div>

      <section className="friends-section">
        <h3 className="friends-section-title">{i.providerHeading}</h3>
        <address className="impressum-address">
          <span>{PROVIDER_NAME}</span>
          <span>{PROVIDER_STREET}</span>
          <span>{PROVIDER_CITY}</span>
          <span>{PROVIDER_COUNTRY}</span>
        </address>
      </section>

      <section className="friends-section">
        <h3 className="friends-section-title">{i.contactHeading}</h3>
        <p className="friends-hint">
          {i.contactEmailLabel}:{' '}
          <a className="impressum-link" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
        </p>
      </section>

      <section className="friends-section">
        <h3 className="friends-section-title">{i.responsibleHeading}</h3>
        <p className="friends-hint">{i.responsibleNote}</p>
        <address className="impressum-address">
          <span>{PROVIDER_NAME}</span>
          <span>{PROVIDER_STREET}</span>
          <span>{PROVIDER_CITY}</span>
        </address>
      </section>

      <section className="friends-section">
        <h3 className="friends-section-title">{i.disputeHeading}</h3>
        <p className="friends-hint">
          {i.disputeOsLabel}:{' '}
          <a
            className="impressum-link"
            href={i.disputeOsHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            {i.disputeOsHref}
          </a>
        </p>
        <p className="friends-hint">{i.disputeNote}</p>
      </section>

      <section className="friends-section">
        <h3 className="friends-section-title">{i.liabilityHeading}</h3>
        <p className="friends-hint">{i.liabilityContent}</p>
        <p className="friends-hint">{i.liabilityLinks}</p>
      </section>

      <section className="friends-section">
        <h3 className="friends-section-title">{i.copyrightHeading}</h3>
        <p className="friends-hint">{i.copyrightContent}</p>
      </section>
    </div>
  )
}

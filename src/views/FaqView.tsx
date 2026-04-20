import { useEffect } from 'react'
import { useTranslation } from '../locales'

interface Props {
  onBack: () => void
}

export function FaqView({ onBack }: Props) {
  const { t } = useTranslation()
  const sections = t.faq.sections

  useEffect(() => {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.id = 'faq-ld-schema'
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: sections.flatMap(s =>
        s.items.map(item => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        }))
      ),
    })
    document.head.appendChild(script)
    return () => { document.getElementById('faq-ld-schema')?.remove() }
  }, [sections])

  return (
    <div className="faq-view">
      <div className="faq-topbar">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>
          {t.global.back}
        </button>
        <span className="faq-topbar__title">{t.faq.topbarTitle}</span>
      </div>

      <div className="faq-intro">
        <p>{t.faq.intro}</p>
      </div>

      {sections.map(section => (
        <section key={section.title} className="faq-section">
          <h2 className="faq-section__title">
            {section.emoji} {section.title}
          </h2>
          <div className="faq-list">
            {section.items.map(item => (
              <details key={item.q} className="faq-item">
                <summary className="faq-item__q">
                  <span>{item.q}</span>
                  <span className="faq-item__chevron" aria-hidden="true">›</span>
                </summary>
                <p className="faq-item__a">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      ))}

      <p className="faq-footer">{t.faq.footer}</p>
    </div>
  )
}

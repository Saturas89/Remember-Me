import { useEffect } from 'react'
import { useTranslation } from '../locales'
import type { Translations } from '../locales/types'

interface SEOHeadProps {
  viewName: string
}

type SeoView = keyof Translations['seo']

const CANONICAL: Record<SeoView, string> = {
  home: 'https://rememberme.dad/',
  archive: 'https://rememberme.dad/archive',
  friends: 'https://rememberme.dad/friends',
  profile: 'https://rememberme.dad/profile',
  feature: 'https://rememberme.dad/feature',
  faq: 'https://rememberme.dad/',
}

function isSeoView(name: string, seo: Translations['seo']): name is SeoView {
  return name in seo
}

export function SEOHead({ viewName }: SEOHeadProps) {
  const { t } = useTranslation()

  const view: SeoView = isSeoView(viewName, t.seo) ? viewName : 'home'
  const meta = { ...t.seo[view], canonical: CANONICAL[view] }

  useEffect(() => {
    document.title = meta.title

    const descEl = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (descEl) descEl.content = meta.description

    const canonEl = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (canonEl) canonEl.href = meta.canonical

    const ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]')
    if (ogUrl) ogUrl.content = meta.canonical

    const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]')
    if (ogTitle) ogTitle.content = meta.title
  }, [meta.title, meta.description, meta.canonical])

  return null
}

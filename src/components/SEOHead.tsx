import { useEffect } from 'react'

interface SEOHeadProps {
  viewName: string
}

interface SEOMeta {
  title: string
  description: string
  canonical: string
}

const SEO_META: Record<string, SEOMeta> = {
  home: {
    title: 'Remember Me',
    description: 'Halte deine Lebensgeschichte für Kinder und Enkel fest – privat, sicher, auf deinem Gerät.',
    canonical: 'https://rememberme.dad/',
  },
  archive: {
    title: 'Lebensarchiv – Remember Me',
    description: 'Alle deine Erinnerungen auf einen Blick – dein persönliches Lebensarchiv.',
    canonical: 'https://rememberme.dad/archive',
  },
  friends: {
    title: 'Freunde einladen – Remember Me',
    description: 'Lade Freunde und Familie ein, deine Geschichte aus ihrer Perspektive zu ergänzen.',
    canonical: 'https://rememberme.dad/friends',
  },
  profile: {
    title: 'Profil & Einstellungen – Remember Me',
    description: 'Verwalte dein Profil, exportiere deine Erinnerungen und passe die App an.',
    canonical: 'https://rememberme.dad/profile',
  },
  feature: {
    title: 'Was kommt als Nächstes – Remember Me',
    description: 'Entdecke geplante Features: Lebenszeitlinie, privater Sync und mehr.',
    canonical: 'https://rememberme.dad/feature',
  },
  faq: {
    title: 'Hilfe & FAQ – Remember Me',
    description: 'Antworten zu Datenschutz, Import, Export und der Funktionsweise von Remember Me.',
    canonical: 'https://rememberme.dad/',
  },
}

const DEFAULT_META = SEO_META.home

export function SEOHead({ viewName }: SEOHeadProps) {
  const meta = SEO_META[viewName] ?? DEFAULT_META

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

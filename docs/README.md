# Storyhold – Projekt-Übersicht

**Status:** 🔵 IN PROGRESS
**Version:** 2.8.0
**Letzte Aktualisierung:** 2026-05-14

> Version und Datum werden per `npm test` (`scripts/check-docs-sync.mjs`)
> gegen `package.json` und das jüngste `docs/CHANGELOG.md`-Datum
> verifiziert. Bei jedem Versions-Bump müssen **Version** und
> **Letzte Aktualisierung** oben mit aktualisiert werden, sonst schlägt
> der Check fehl. Details: [CLAUDE.md → „Doc-Sync-Pflicht"](../CLAUDE.md).
>
> Auf der Suche nach dem **Pitch / Getting Started**? Siehe das Root-
> [`README.md`](../README.md). Diese Datei richtet sich an Entwickler,
> Beiträger und Auditoren und beschreibt den aktuellen Stand der App,
> die Roadmap, die Architektur und das Glossar.

---

## Projektbeschreibung

**Storyhold** ist eine Progressive Web App (PWA), mit der Menschen ihre Lebensgeschichte, persönlichen Erinnerungen, Werte und Erfahrungen spielerisch für die Nachwelt festhalten können.

Die Idee: Viele Menschen möchten ihren Kindern, Enkeln und Angehörigen mehr hinterlassen als nur Fotos – echte Geschichten, Werte, Ratschläge, Kindheitserinnerungen. **Storyhold** führt sie durch gezielte Fragen in Lebenskategorien und macht daraus ein persönliches, bleibendes Dokument.

Die App ist vollständig responsiv und funktioniert nahtlos auf:
- 📱 Mobilgeräten – installierbar als PWA auf iOS & Android
- 💻 Desktop/Tablet – für längere Antworten
- 📴 Offline – mit Service Worker & Workbox-Caching

---

## Status-Übersicht (REQ-Specs)

Legende: ✔️ Completed · 🟢 Draft (Code existiert, Spec nur historisch) · 🟡 Planned

| ID | Titel | Status |
|----|-------|--------|
| [REQ-001](requirements/REQ-001-pwa-foundation-clean.md) | PWA Foundation & Responsive Design | ✔️ |
| [REQ-002](requirements/REQ-002-question-engine.md) | Frage-Engine & Fragenkatalog | ✔️ |
| [REQ-003](requirements/REQ-003-story-storage.md) | Lebensarchiv & Datenspeicherung | ✔️ |
| [REQ-004](requirements/REQ-004-export-sharing.md) | Export & Teilen | ✔️ |
| [REQ-005](requirements/REQ-005-ci-cd-pipeline.md) | CI/CD Pipeline | ✔️ |
| [REQ-006](requirements/REQ-006-life-timeline.md) | Lebenszeitlinie | 🟡 |
| [REQ-007](requirements/REQ-007-social-media-import.md) | Social Media Import | 🟡 |
| [REQ-008](requirements/REQ-008-biography-generator.md) | Biografie-Generator (Premium) | 🟡 |
| [REQ-009](requirements/REQ-009-audio-recording.md) | Audio-Aufnahme & Transkription | ✔️ |
| [REQ-010](requirements/REQ-010-faq.md) | Hilfe & FAQ | ✔️ |
| [REQ-011](requirements/REQ-011-archive-export.md) | Erinnerungs-Archiv ZIP-Export | ✔️ |
| [REQ-012](requirements/REQ-012-video-attachments.md) | Video-Anhänge | ✔️ |
| [REQ-013](requirements/REQ-013-archive-import.md) | Erinnerungs-Archiv-Import | ✔️ |
| [REQ-014](requirements/REQ-014-release-notes.md) | Release Notes / „Was ist neu?" | ✔️ |
| [REQ-015](requirements/REQ-015-familienmodus.md) | Familienmodus | ✔️ |
| [REQ-016](requirements/REQ-016-pwa-notifications.md) | Engagement-Benachrichtigungen | 🟡 |
| [REQ-017](requirements/REQ-017-privater-sync.md) | Privater Sync (Google Drive · OneDrive · Storyhold Server) | ✔️ |
| [REQ-018](requirements/REQ-018-sync-key-loss-reset.md) | Sync-Login: Schlüssel verloren? (Reset) | ✔️ |
| [REQ-019](requirements/REQ-019-einfach-modus.md) | Vereinfachter Bedienmodus | ✔️ |
| [REQ-020](requirements/REQ-020-sandra-flow.md) | Sandra-First Flow | ✔️ |
| [REQ-021](requirements/REQ-021-feedback.md) | Leichtgewichtiges In-App-Feedback | ✔️ |

### Architektur-Entscheidungen (ADRs)

| ID | Titel | Status |
|----|-------|--------|
| [ADR-001](architecture/ADR-001-open-source-vs-proprietary.md) | Open-Source-Kern, proprietäre Premium-Features serverseitig | ✅ |

---

## Kernkonzept

```
Benutzer öffnet App (oder installiert sie auf dem Startbildschirm)
      ↓
Wählt Modus (vollständig oder vereinfacht – Ingrid-Persona)
      ↓
Wählt Kategorie (z.B. "Kindheit") oder erstellt eigene Fragen
      ↓
Beantwortet Fragen spielerisch (Text, Auswahl, Skala, Jahreszahl, Foto, Audio, Video)
      ↓
Antworten werden lokal gespeichert (localStorage + IndexedDB für Medien)
      ↓
Optional: Sync zwischen Geräten (Google Drive / OneDrive / Storyhold-Server, E2E-verschlüsselt)
      ↓
Lebensarchiv wächst mit der Zeit
      ↓
Teilen / Exportieren (PDF, Markdown, JSON, ZIP-Archiv, KI-Export, Freunde einladen)
```

---

## Was die App heute kann ✔️

### Foundation (v1.x)
- [x] Progressive Web App (PWA) Grundstruktur, Vercel Deployment (REQ-001)
- [x] Vite + React 19 + TypeScript Setup
- [x] Frage-Engine mit 6 Kategorien, 50+ Fragen (text, choice, scale, year) (REQ-002)
- [x] Lokale Datenspeicherung (localStorage, Auto-Save, forward-compatible migration) (REQ-003)
- [x] Vollständiger Fragenkatalog (alle 6 Kategorien)
- [x] Antwort-Übersicht / Lebensarchiv (alle Kategorien + Freunde-Beiträge)
- [x] Antworten bearbeitbar im Archiv (Inline-Edit)
- [x] PDF/Druck-Export via `window.print()` + `@media print` CSS (REQ-004)
- [x] Freunde einladen (Einladungslinks via URL-Hash, Base64-codiert)
- [x] Freundes-Antwort-Import (Export-Code System, vollständig offline)
- [x] Profil-Seite (Name, Geburtsjahr, Statistiken)
- [x] Eigene Fragen erstellen, beantworten, teilen (Question-Pack-Codes)
- [x] 4 wechselbare Themes (Nacht, Hell, Sepia, Ozean) mit CSS-Variablen
- [x] Logo + HeroLogo-Komponente mit animiertem Herz-SVG
- [x] App-Icons (192px, 512px, apple-touch 180px) mit Gradienten
- [x] PWA installierbar: iOS-Meta-Tags, android `mobile-web-app-capable`
- [x] Install-Prompt: Android nativ (`beforeinstallprompt`), iOS Anleitung
- [x] KI-lesbarer Export: Markdown (`.md`) + Enriched JSON (`.json`) – v1.4.0
- [x] Foto-Anhänge zu Antworten (IndexedDB, Komprimierung, Lightbox) – v1.5.0
- [x] Themen-Auswahl für Freundes-Einladungen (4 Themen × 5 Fragen) – v1.5.0
- [x] Fragen überspringen (eigener Flow + Freunde-Flow) – v1.5.1
- [x] Onboarding-Screen beim Erststart – v1.5.2
- [x] Profil-Seite UX-Redesign (Avatar, Karten, Theme-Grid) – v1.5.4
- [x] Bottom-Tab-Navigation (5 Tabs, iOS/Android-Stil, Badge-Zähler) – v1.5.5
- [x] Export & Backup-Funktion im Profil – v1.5.6
- [x] PWA Update-Benachrichtigung (Service Worker Prompt, Banner) – v1.5.8
- [x] Freunde-Einladung: Share-Link-Flow (Web Share API, automatischer Import) – v1.5.9
- [x] **Release Notes / „Was ist neu?"** – in-App Versionshistorie (REQ-014) – v1.6.0
- [x] **Audio-Aufnahme & Transkription** – einsprechen statt tippen, lokale Web-Speech-API-Transkription (REQ-009) – v1.7.0
- [x] **Video-Anhänge** – IndexedDB-Speicher (`rm-videos`), Inline-Wiedergabe, ZIP-Export (REQ-012) – v1.8.0
- [x] **Hilfe & FAQ** – Datenschutz, Import, Export, Offline-Nutzung (REQ-010) – v1.9.0
- [x] **Erinnerungs-Archiv ZIP-Export** – Komplettarchiv inkl. Fotos, Audio & Video (REQ-011) – v1.9.x
- [x] **Erinnerungs-Archiv-Import** – Wiederherstellung aus ZIP oder JSON-Backup (REQ-013) – v1.9.x

### Sync, Privacy & Brand (v2.x)
- [x] **Familienmodus** – Familien-Räume mit E2E-Verschlüsselung (REQ-015) – v1.9.x
- [x] **Rebrand auf Storyhold** – Logo, Splash, Manifest, Markdown-Branding in Exports – v2.0.0
- [x] **Privater Sync** – geräteübergreifende Synchronisation über drei Provider (Google Drive, Microsoft OneDrive, Storyhold-Server), AES-256-GCM mit Recovery-Code-abgeleitetem Key (REQ-017) – v2.0.x
- [x] **Sync-Login: „Schlüssel verloren?"** – Reset-Flow mit Neuanlegen eines Recovery-Codes (REQ-018) – v2.3.0
- [x] **Vereinfachter Bedienmodus** – Ingrid-Persona: reduzierte UI, größere Schrift, Power-Features ausgeblendet (REQ-019) – v2.4.0
- [x] **Impressum-Seite** – rechtskonform nach DDG § 5 und MStV § 18, im Profil unter „Hilfe & FAQ" – v2.5.0
- [x] **Sync-Setup: Wartebildschirm für E-Mail-Bestätigung** – Wizard zeigt jetzt Hinweistext + Resend-Button statt stummem Skip – v2.6.0
- [x] **Mehrsprachigkeit DE / EN** – alle UI-Strings, Onboarding, FAQ, Release Notes, Kategorien und Fragen lokalisiert (`src/locales/de/`, `src/locales/en/`, `detectLocale.ts`)
- [x] **Sandra-First Flow** – tech-affinerer Käufer formuliert eigene Fragen und schickt sie als Pack-Link an Mama/Papa/Oma (REQ-020) – v2.7.0
- [x] **Leichtgewichtiges In-App-Feedback** – 5-Smiley-Modal mit optionalem Kommentar im Profil, anonyme Insert-Tabelle (REQ-021) – v2.8.0

## Roadmap 📋

- [ ] **Engagement-Benachrichtigungen** – OS-Reminder mit Backoff-Cadence (3/10/24 Tage), iOS-Welcome-Back-Banner, Streak-Tracking & Meilenstein-Glückwünsche (REQ-016)
- [ ] **Lebenszeitlinie** – chronologische Ansicht aller Erlebnisse und Fotos auf einer visuellen Timeline, filterbar nach Jahr und Kategorie; optional ungefähres Alter pro Eintrag, wird automatisch aus Geburtsjahr vorgeschlagen (REQ-006)
- [ ] **Import bestehender Erinnerungen** – Erinnerungen und Fotos aus sozialen Netzwerken (Facebook, Instagram), Clouds und lokalen Ordnern importieren, mit optionaler eigener Beschreibung (REQ-007)
- [ ] **Automatische Lebensgeschichte (Premium)** – aus den gespeicherten Antworten per KI eine fertige, lesbare Lebensgeschichte generieren, vorschau- und exportierbar; Architektur ADR-001-konform als Supabase Edge Function im privaten Pro-Repo (REQ-008)

---

## Fragenkategorien

| Kategorie | Emoji | Fragen | Status |
|-----------|-------|--------|--------|
| Kindheit & Jugend | 🧒 | 10 | ✔️ |
| Familie & Beziehungen | 👨‍👩‍👧‍👦 | 10 | ✔️ |
| Beruf & Leidenschaften | 💼 | 10 | ✔️ |
| Werte & Überzeugungen | 🌟 | 10 | ✔️ |
| Erinnerungen & Erlebnisse | 📸 | 10 | ✔️ |
| Wünsche & Vermächtnis | ✉️ | 10 | ✔️ |
| **Eigene Fragen** | ✏️ | unbegrenzt | ✔️ |
| **Freunde-Perspektive** | 👥 | 4 Themen × 5 | ✔️ |

---

## Technologie-Stack

| Schicht | Technologie |
|---------|-------------|
| Framework | React 19 + TypeScript |
| Build | Vite 7 |
| PWA | vite-plugin-pwa + Workbox |
| Styling | CSS Custom Properties (4 Themes) |
| i18n | Eigene Locales in `src/locales/{de,en}/` + `detectLocale.ts` |
| Persistenz | localStorage (Zustand) + IndexedDB (Bilder, Audio, Video) |
| Crypto | Web Crypto API (ECDH P-256, HKDF-SHA256, AES-256-GCM) |
| Online-Backend (optional) | Supabase (Auth, Postgres mit RLS, Storage) |
| OAuth | `@react-oauth/google` (Google Drive), `@azure/msal-browser` (OneDrive) |
| Analytics | `@vercel/analytics` + `@vercel/speed-insights` |
| Deployment | Vercel (static SPA) |
| Icons | sharp (SVG → PNG, `npm run generate-icons`) |
| Tests | Vitest (Unit), Playwright (E2E, 5-Browser-Matrix in CI) |

---

## Datenmodell (aktuell)

```
AppState (localStorage: 'remember-me-state')
├── profile: { name, birthYear?, createdAt, locale?, simplifiedMode? }
├── answers: Record<questionId, Answer>
│   └── Answer: { id, questionId, categoryId, value, imageIds?, audioId?,
│                  audioTranscribedAt?, audioTranscript?, videoIds?,
│                  eventDate?, approxAge?, importSource?, createdAt, updatedAt }
├── friends: Friend[]
│   └── Friend: { id, name, addedAt }
├── friendAnswers: FriendAnswer[]
│   └── FriendAnswer: { id, friendId, friendName, questionId, questionText?, value, createdAt }
└── customQuestions: CustomQuestion[]
    └── CustomQuestion: { id, text, type, helpText?, options?, createdAt }

IndexedDB: 'rm-images' (store: 'images')
└── key: imageId → value: JPEG data URL (max 1200px, 82% quality)

IndexedDB: 'rm-audio' (store: 'audio')
└── key: audioId → value: Audio-Aufnahme (WebM/Opus)

IndexedDB: 'rm-videos' (store: 'videos')
└── key: videoId → value: Video-Datei
```

Vollständige Typ-Definitionen: `src/types.ts`
Zustandsverwaltung: `src/hooks/useAnswers.ts`
PWA Service Worker: `src/hooks/useServiceWorker.ts` – `{ needRefresh, applyUpdate, dismiss }`
Update-Banner: `src/components/UpdateBanner.tsx` – Toast bei verfügbarem SW-Update
Sync-Schicht: `src/integration/` (Google Drive · OneDrive · Storyhold-Server)
i18n-Schicht: `src/locales/index.ts` + `src/locales/detectLocale.ts`

---

## Glossar

| Begriff | Beschreibung |
|---------|-------------|
| PWA | Progressive Web App – installierbar, offline-fähig |
| Frage-Engine | System zur Präsentation und Verwaltung von Fragen |
| Lebensarchiv | Alle gespeicherten Antworten eines Benutzers |
| Kategorie | Thematische Gruppe von Fragen (z.B. „Kindheit") |
| Eintrag | Eine beantwortete Frage mit Datum |
| QuestionPack | Shareable Bundle eigener Fragen (base64-codiert) |
| AnswerExport | Antworten eines Freundes (base64-codierter Code) |
| InviteData | Daten im Einladungslink (profileName + friendId + topicId?) |
| FriendTopic | Thema für Freundes-Einladung (id, title, emoji, description, 5 questions) |
| Release Notes | Versionsbeschreibungen für Nutzer – abrufbar im Update-Banner und im Profil – ✔️ umgesetzt |
| E2EE | Ende-zu-Ende-Verschlüsselung (Familienmodus, Privater Sync) – ✔️ umgesetzt |
| KI-Export | Archiv in KI-lesbarem Format (Markdown/JSON) – ✔️ umgesetzt |
| Audio-Aufnahme | Fragen einsprechen statt tippen; Transkript immer gespeichert, Originalton-Datei optional – ✔️ umgesetzt |
| Video-Anhänge | Videos zu Antworten hinzufügen; IndexedDB-basiert – ✔️ umgesetzt |
| Erinnerungs-Archiv | ZIP-Export & -Import inkl. Fotos, Audio, Video – ✔️ umgesetzt |
| Privater Sync | Verschlüsselte Synchronisation zwischen Geräten über Google Drive, OneDrive oder Storyhold-Server (REQ-017) – ✔️ umgesetzt |
| Vereinfachter Modus | Reduzierte UI für ältere Nutzer (Ingrid-Persona): Power-Features ausgeblendet, größere Schrift (REQ-019) – ✔️ umgesetzt |
| approxAge | Ungefähres Lebensalter zum Zeitpunkt eines Erlebnisses, für die Zeitlinie |
| Lebenszeitlinie | Chronologische visuelle Ansicht aller Einträge und Fotos; mit optionalem ca. Alter (REQ-006, geplant) |
| Import Erinnerungen | Import aus sozialen Netzwerken, Clouds, lokalen Ordnern (REQ-007, geplant) |
| Biografie-Generator | KI-gestützte Umwandlung der Antworten in eine fertige Lebensgeschichte als Premium-Feature über Supabase Edge Function (REQ-008, geplant) |
| Engagement-Benachrichtigungen | Reminder-System mit 3/10/24-Tage-Backoff-Cadence, Welcome-Back-Banner als iOS-Fallback, Meilenstein-Glückwünsche (REQ-016, geplant) |

---

## Wo gibt es Details?

- [CHANGELOG.md](CHANGELOG.md) – Versionshistorie
- [requirements/README.md](requirements/README.md) – MoSCoW-Priorisierung der REQs
- [architecture/ADR-001-open-source-vs-proprietary.md](architecture/ADR-001-open-source-vs-proprietary.md) – Open-Source-Kern, proprietäre Premium-Features serverseitig
- [DEPLOYMENT.md](DEPLOYMENT.md) – Vercel Setup
- [DATA_STORAGE.md](DATA_STORAGE.md) – Lokale & Cloud-Datenspeicherung
- [SUPABASE_SETUP.md](SUPABASE_SETUP.md) – Supabase-Projekt & RLS
- [SECRETS_SECURITY.md](SECRETS_SECURITY.md) – Geheimnisverwaltung
- [modules/README.md](modules/README.md) – Architektur & Modulübersicht
- [design/AI_READABLE_EXPORT.md](design/AI_READABLE_EXPORT.md) – KI-Export-Konzept
- [guides/CONTRIBUTING.md](guides/CONTRIBUTING.md) – Beitragsrichtlinien
- [testing-conventions.md](testing-conventions.md) – Test-Konventionen
- [req-016-pr74-postmortem.md](req-016-pr74-postmortem.md) – PR-74 Postmortem

---

## Key Stakeholder

- **Projekt Owner:** Saturas89
- **Lead Developer:** Claude Code
- **Zielgruppe:** Menschen aller Altersgruppen, besonders 40+ / Familien

# Storyhold – Dokumentation

**Version:** 2.7.0 | **Stand:** 2026-05-13

> Diese Datei wird per `npm test` (`scripts/check-docs-sync.mjs`) gegen
> `package.json#version` und das jüngste `docs/CHANGELOG.md`-Datum
> abgeglichen. Bei jedem Versions-Bump müssen **Version** und **Stand**
> oben mit aktualisiert werden, sonst schlägt der Check fehl.
> Details: [CLAUDE.md → „Doc-Sync-Pflicht"](../CLAUDE.md).

---

## Hauptdokumentation

| Dokument | Inhalt |
|----------|--------|
| [PROJECT.md](PROJECT.md) | Konzept, Roadmap, Datenmodell, Glossar |
| [CHANGELOG.md](CHANGELOG.md) | Versionshistorie aller Releases |
| [modules/README.md](modules/README.md) | Architektur & Modulübersicht |

## Anforderungen (REQ-Specs)

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

## Architektur-Entscheidungen (ADRs)

| ID | Titel | Status |
|----|-------|--------|
| [ADR-001](architecture/ADR-001-open-source-vs-proprietary.md) | Open-Source-Kern, proprietäre Premium-Features serverseitig | ✅ |

## Weitere Dokumentation

- [DEPLOYMENT.md](DEPLOYMENT.md) – Vercel Setup
- [SECRETS_SECURITY.md](SECRETS_SECURITY.md) – Geheimnisverwaltung
- [SUPABASE_SETUP.md](SUPABASE_SETUP.md) – Supabase-Projekt & RLS
- [DATA_STORAGE.md](DATA_STORAGE.md) – Lokale & Cloud-Datenspeicherung
- [CONTRIBUTING.md](guides/CONTRIBUTING.md) – Beitragsrichtlinien
- [AI_READABLE_EXPORT.md](design/AI_READABLE_EXPORT.md) – KI-Export Konzept
- [testing-conventions.md](testing-conventions.md) – Test-Konventionen
- [requirements/README.md](requirements/README.md) – MoSCoW-Priorisierung
- [req-016-pr74-postmortem.md](req-016-pr74-postmortem.md) – PR-74 Postmortem

## Struktur

```
docs/
├── INDEX.md               ← DU BIST HIER
├── PROJECT.md             ← Projektübersicht & Roadmap
├── CHANGELOG.md           ← Versionshistorie
├── DEPLOYMENT.md          ← Vercel Deployment
├── DATA_STORAGE.md        ← Lokale & Cloud-Datenspeicherung
├── SECRETS_SECURITY.md    ← Sicherheit
├── SUPABASE_SETUP.md      ← Supabase-Setup
├── testing-conventions.md ← Test-Konventionen
├── req-016-pr74-postmortem.md
├── architecture/
│   └── ADR-001-open-source-vs-proprietary.md
├── design/
│   └── AI_READABLE_EXPORT.md
├── guides/
│   └── CONTRIBUTING.md
├── modules/
│   └── README.md          ← Architektur
└── requirements/
    ├── README.md
    ├── _TEMPLATE.md
    └── REQ-001 … REQ-019
```

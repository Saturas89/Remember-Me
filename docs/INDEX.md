# Remember Me – Dokumentation

**Version:** 1.5.9 | **Stand:** 2026-04-16

---

## Hauptdokumentation

| Dokument | Inhalt |
|----------|--------|
| [PROJECT.md](PROJECT.md) | Konzept, Roadmap, Datenmodell, Glossar |
| [CHANGELOG.md](CHANGELOG.md) | Versionshistorie aller Releases |
| [modules/README.md](modules/README.md) | Architektur & Modulübersicht |

## Anforderungen (REQ-Specs)

| ID | Titel | Status |
|----|-------|--------|
| [REQ-001](requirements/REQ-001-pwa-foundation-clean.md) | PWA Foundation & Responsive Design | ✔️ |
| [REQ-002](requirements/REQ-002-question-engine.md) | Frage-Engine & Fragenkatalog | ✔️ |
| [REQ-003](requirements/REQ-003-story-storage.md) | Lebensarchiv & Datenspeicherung | ✔️ |
| [REQ-004](requirements/REQ-004-export-sharing.md) | Export & Teilen | ✔️ |
| [REQ-005](requirements/REQ-005-ci-cd-pipeline.md) | CI/CD Pipeline | ✔️ |
| [REQ-006](requirements/REQ-006-life-timeline.md) | Lebenszeitlinie | 🟢 |
| [REQ-007](requirements/REQ-007-social-media-import.md) | Social Media Import | 🟢 |
| [REQ-008](requirements/REQ-008-biography-generator.md) | Biografie-Generator | 🟢 |
| [REQ-009](requirements/REQ-009-audio-recording.md) | Audio-Aufnahme & Transkription | ✔️ |
| [REQ-010](requirements/REQ-010-faq.md) | Hilfe & FAQ | ✔️ |
| [REQ-011](requirements/REQ-011-archive-export.md) | Erinnerungs-Archiv ZIP-Export | ✔️ |
| [REQ-012](requirements/REQ-012-video-attachments.md) | Video-Anhänge | ✔️ |
| [REQ-013](requirements/REQ-013-archive-import.md) | Erinnerungs-Archiv-Import | ✔️ |

## Weitere Dokumentation

- [DEPLOYMENT.md](DEPLOYMENT.md) – Vercel Setup
- [SECRETS_SECURITY.md](SECRETS_SECURITY.md) – Geheimnisverwaltung
- [CONTRIBUTING.md](guides/CONTRIBUTING.md) – Beitragsrichtlinien
- [AI_READABLE_EXPORT.md](design/AI_READABLE_EXPORT.md) – KI-Export Konzept
- [requirements/README.md](requirements/README.md) – MoSCoW-Priorisierung

## Struktur

```
docs/
├── INDEX.md               ← DU BIST HIER
├── PROJECT.md             ← Projektübersicht & Roadmap
├── CHANGELOG.md           ← Versionshistorie
├── DEPLOYMENT.md          ← Vercel Deployment
├── SECRETS_SECURITY.md    ← Sicherheit
├── design/
│   └── AI_READABLE_EXPORT.md
├── guides/
│   └── CONTRIBUTING.md
├── modules/
│   └── README.md          ← Architektur
└── requirements/
    ├── README.md
    └── REQ-001 … REQ-013
```

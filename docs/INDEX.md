# Remember Me – Dokumentation Index

**Stand:** 2026-04-16 | **Version:** 1.5.9

---

## 🚀 Schnellstart

```
1. Projekt verstehen:  docs/PROJECT.md
2. Anforderungen:      docs/requirements/README.md
3. Changelog:          docs/CHANGELOG.md  ← Versionshistorie
4. Deployment:         docs/DEPLOYMENT.md
```

---

## 📋 Versionen

| Version | Datum | Inhalt |
|---------|-------|--------|
| [1.5.9](./CHANGELOG.md#159--2026-04-16) | 2026-04-16 | Share-Link-Flow für Freunde-Einladung |
| [1.5.8](./CHANGELOG.md#158--2026-04-12) | 2026-04-12 | PWA Update-Benachrichtigung |
| [1.5.6](./CHANGELOG.md#156--2026-04-12) | 2026-04-12 | Export & Backup-Funktion |
| [1.5.5](./CHANGELOG.md#155--2026-04-11) | 2026-04-11 | Bottom-Tab-Navigation |
| [1.5.0](./CHANGELOG.md#150--2026-04-11) | 2026-04-11 | Foto-Anhänge, Themen für Freunde |
| [1.4.0](./CHANGELOG.md#140--2026-04-11) | 2026-04-11 | KI-lesbarer Datenexport |
| [1.3.0](./CHANGELOG.md#130--2026-04-10) | 2026-04-10 | Profil, Archiv bearbeitbar, Eigene Fragen |
| [1.2.0](./CHANGELOG.md#120--2026-04-10) | 2026-04-10 | Logo, 4 Themes |
| [1.1.0](./CHANGELOG.md#110--2026-04-10) | 2026-04-10 | Freunde einladen, Antworten importieren |
| [1.0.0](./CHANGELOG.md#100--2026-04-10) | 2026-04-10 | PWA-Grundstruktur, Frage-Engine, Archiv |

---

## 📚 Hauptdokumentation

### Projekt
- **[PROJECT.md](PROJECT.md)** – Konzept, Ziele, Kategorien, Glossar
- **[CHANGELOG.md](CHANGELOG.md)** – Versionshistorie aller Releases

### Anforderungen
- **[requirements/README.md](requirements/README.md)** – Übersicht mit MoSCoW-Priorisierung
- **[REQ-001](requirements/REQ-001-pwa-foundation-clean.md)** – PWA Foundation & Responsive Design ✔️
- **[REQ-002](requirements/REQ-002-question-engine.md)** – Frage-Engine & Fragenkatalog ✔️
- **[REQ-003](requirements/REQ-003-story-storage.md)** – Lebensarchiv & Datenspeicherung ✔️
- **[REQ-004](requirements/REQ-004-export-sharing.md)** – Export & Teilen ✔️
- **[REQ-005](requirements/REQ-005-ci-cd-pipeline.md)** – CI/CD Pipeline ✔️
- **REQ-006** – KI-lesbarer Datenexport ✔️
- **REQ-007** – Medienanhänge (Fotos) ✔️
- **REQ-008** – E2EE-Sync (opt-in) 🟢
- **[REQ-009](requirements/REQ-009-audio-recording.md)** – Audio-Aufnahme & Transkription ✔️
- **[REQ-010](requirements/REQ-010-faq.md)** – Hilfe & FAQ ✔️
- **[REQ-011](requirements/REQ-011-archive-export.md)** – Erinnerungs-Archiv (ZIP + Share Sheet) ✔️
- **[REQ-012](requirements/REQ-012-video-attachments.md)** – Video-Anhänge ✔️
- **[REQ-013](requirements/REQ-013-archive-import.md)** – Erinnerungs-Archiv-Import ✔️

### Module
- **[modules/README.md](modules/README.md)** – Modulübersicht & Abhängigkeiten
- **[Core](modules/core/README.md)** – PWA Foundation, Service Worker
- **[Data](modules/data/README.md)** – localStorage / IndexedDB
- **[UI](modules/ui/README.md)** – Komponenten & Design System

### Deployment & Betrieb
- **[DEPLOYMENT.md](DEPLOYMENT.md)** – Vercel Setup & CI/CD
- **[SECRETS_SECURITY.md](SECRETS_SECURITY.md)** – Geheimnisverwaltung

### Entwicklung
- **[guides/CONTRIBUTING.md](guides/CONTRIBUTING.md)** – Beitragsrichtlinien
- **[design/DESIGN_SYSTEM.md](design/DESIGN_SYSTEM.md)** – Design System

---

## 🗂️ Struktur

```
docs/
├── INDEX.md               ← DU BIST HIER
├── CHANGELOG.md           ← Versionshistorie
├── PROJECT.md             ← Projektübersicht
├── DEPLOYMENT.md          ← Vercel Deployment
├── SECRETS_SECURITY.md    ← Sicherheit
├── IMPLEMENTATION_DETAILS.md
├── design/
│   └── DESIGN_SYSTEM.md
├── guides/
│   └── CONTRIBUTING.md
├── modules/               ← Technische Module
│   ├── core/
│   ├── data/
│   ├── ui/
│   └── ...
├── requirements/          ← Feature-Anforderungen
│   ├── README.md
│   ├── REQ-001 … REQ-013
└── api/
    └── API_REFERENCE.md
```

# Remember Me – Dokumentation Index

**Stand:** 2026-04-10 | **Version:** 1.1.0

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
| [1.1.0](./CHANGELOG.md#110--2026-04-10) | 2026-04-10 | Freunde einladen, Antworten importieren |
| [1.0.0](./CHANGELOG.md#100--2026-04-10) | 2026-04-10 | PWA-Grundstruktur, Frage-Engine, Archiv |

---

## 📚 Hauptdokumentation

### Projekt
- **[PROJECT.md](PROJECT.md)** – Konzept, Ziele, Kategorien, Glossar
- **[CHANGELOG.md](CHANGELOG.md)** – Versionshistorie aller Releases

### Anforderungen
- **[requirements/README.md](requirements/README.md)** – Übersicht mit MoSCoW-Priorisierung
- **[REQ-001](requirements/REQ-001-pwa-foundation-clean.md)** – PWA Foundation & Responsive Design
- **[REQ-002](requirements/REQ-002-question-engine.md)** – Frage-Engine & Fragenkatalog
- **[REQ-003](requirements/REQ-003-story-storage.md)** – Lebensarchiv & Datenspeicherung
- **[REQ-004](requirements/REQ-004-export-sharing.md)** – Export & Teilen
- **[REQ-005](requirements/REQ-005-ci-cd-pipeline.md)** – CI/CD Pipeline

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
│   ├── REQ-001 … REQ-005
└── api/
    └── API_REFERENCE.md
```

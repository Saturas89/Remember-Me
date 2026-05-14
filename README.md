# Storyhold

*Digitale Erinnerung + persönliche Biografie + kontrolliertes Vermächtnis*

[![License: AGPL v3+](https://img.shields.io/badge/License-AGPL%20v3%2B-blue.svg)](./LICENSE)
[![Made in Germany](https://img.shields.io/badge/Made%20in-Germany-000000?labelColor=DD0000&color=FFCE00)](./docs/DATA_STORAGE.md)

**Storyhold** ist eine Progressive Web App (PWA), mit der Menschen ihre Lebensgeschichte, Erinnerungen, Werte und persönliche Informationen spielerisch für die Nachwelt festhalten.

## Wie es funktioniert

1. **Kategorien wählen** – Kindheit, Familie, Beruf, Werte, Erinnerungen, Vermächtnis
2. **Fragen beantworten** – Geführte Fragen im Quiz-Format (Text, Auswahl, Skala, Foto, Audio, Video)
3. **Speichern & teilen** – Lokal gespeichert, exportierbar als PDF, Markdown, JSON oder ZIP-Archiv

## Features

- 6 Lebenskategorien mit 50+ Fragen + eigene Fragen erstellen
- 4 Themes (Nacht, Hell, Sepia, Ozean)
- Foto-, Audio- und Video-Anhänge zu Antworten
- Freunde einladen (Share-Link-Flow, Web Share API)
- Export: PDF, Markdown, JSON, Backup, ZIP-Archiv mit allen Medien
- Vollständig offline-fähig (PWA, Service Worker)
- Installierbar auf iOS & Android
- **Optional:** Online-Teilen mit E2E-Verschlüsselung (strikt opt-in, Standard aus)

## Privacy by default

Storyhold arbeitet standardmäßig **komplett offline**. Keine Accounts,
keine Server-Kommunikation, keine Tracker. Wer eigene Erinnerungen
online mit bestimmten Kontakten teilen möchte, kann das optionale
Online-Teilen aktivieren – es ist Ende-zu-Ende-verschlüsselt (ECDH P-256
+ AES-256-GCM, Zero-Knowledge-Server). Details:
[`docs/DATA_STORAGE.md`](./docs/DATA_STORAGE.md).

## Tech Stack

| Schicht        | Technologie                                                      |
|----------------|------------------------------------------------------------------|
| Framework      | React 19 + TypeScript                                            |
| Build          | Vite 6 + vite-plugin-pwa                                         |
| Persistenz     | localStorage + IndexedDB (Bilder, Audio, Video)                  |
| Crypto         | Web Crypto API (ECDH P-256, HKDF-SHA256, AES-256-GCM)            |
| Online-Backend (optional) | Supabase (anonymous auth, Postgres mit RLS, Storage) |
| Deployment     | Vercel                                                           |
| Tests          | Vitest (Unit), Playwright (E2E, 5-Browser-Matrix in CI)          |

## Entwicklung

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run test
```

## Dokumentation

Vollständige Specs und Architektur unter [`/docs`](./docs/README.md).

## Lizenz

Storyhold steht unter der [**GNU Affero General Public License v3.0 oder
später (AGPL-3.0-or-later)**](./LICENSE). Der komplette App-Code in diesem
Repository ist Open Source — du kannst ihn inspizieren, selbst hosten und
weiterentwickeln, solange Modifikationen (auch von Netzwerk-Diensten) unter
derselben Lizenz veröffentlicht werden.

Die serverseitigen Premium-Komponenten (`saturas89/remember-me-pro`,
Supabase Edge Functions) sind **proprietär** und nicht Teil dieses Repos.
Die Architektur-Begründung steht in
[ADR-001](./docs/architecture/ADR-001-open-source-vs-proprietary.md).

Beiträge sind willkommen – siehe [`CONTRIBUTING.md`](./docs/guides/CONTRIBUTING.md).

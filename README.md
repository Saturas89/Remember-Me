# Remember Me

*Digitale Erinnerung + persönliche Biografie + kontrolliertes Vermächtnis*

**Remember Me** ist eine Progressive Web App (PWA), mit der Menschen ihre Lebensgeschichte, Erinnerungen, Werte und persönliche Informationen spielerisch für die Nachwelt festhalten.

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

## Tech Stack

| Schicht | Technologie |
|---------|-------------|
| Framework | React 19 + TypeScript |
| Build | Vite 6 + vite-plugin-pwa |
| Persistenz | localStorage + IndexedDB (Bilder, Audio, Video) |
| Deployment | Vercel |
| Tests | Vitest |

## Entwicklung

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run test
```

## Dokumentation

Vollständige Specs und Architektur unter [`/docs`](./docs/INDEX.md).

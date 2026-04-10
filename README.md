# Remember Me

**Remember Me** ist eine Progressive Web App (PWA), mit der Menschen ihre Lebensgeschichte, Erinnerungen, Werte und persönliche Informationen spielerisch für die Nachwelt und ihre Angehörigen festhalten können.

## Idee

Viele Menschen möchten ihren Kindern, Enkeln oder anderen Angehörigen mehr über sich hinterlassen als Fotos und Dokumente – persönliche Geschichten, Lebenswerte, Kindheitserinnerungen, lustige Anekdoten, wichtige Ratschläge.

**Remember Me** macht das einfach: Die App führt einen spielerisch durch gezielte Fragen in verschiedenen Lebenskategorien. Die Antworten werden lokal gespeichert und können als persönliches Lebensarchiv geteilt oder exportiert werden.

## Wie es funktioniert

1. **Kategorien wählen** – Kindheit, Familie, Beruf, Werte, Erinnerungen, Vermächtnis
2. **Fragen beantworten** – Geführte, spielerische Fragen im Quiz-Format
3. **Speichern & teilen** – Antworten lokal gespeichert, exportierbar als PDF oder teilbar mit Familie

## Features (geplant)

- Geführter Frage-Flow nach Lebenskategorien
- Freitext-, Auswahl- und Medienfragen
- Offline-Nutzung (PWA, Service Worker)
- Lokale Datenspeicherung (kein Account nötig für Basisfunktion)
- Export als druckbares Dokument / PDF
- Optionale Freigabe für Familienmitglieder

## Tech Stack

- **Frontend:** React 19 + TypeScript
- **Build:** Vite + vite-plugin-pwa
- **Storage:** localStorage (IndexedDB für größere Daten geplant)
- **Deployment:** Vercel
- **Tests:** Vitest

## Entwicklung

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # Production build
npm run test     # Tests
```

## Dokumentation

Alle Spezifikationen und Anforderungen befinden sich unter [`/docs`](./docs/).

| Dokument | Inhalt |
|----------|--------|
| [PROJECT.md](./docs/PROJECT.md) | Projektübersicht & Ziele |
| [Module](./docs/modules/README.md) | Technische Module |
| [Anforderungen](./docs/requirements/README.md) | Feature-Anforderungen |
| [Deployment](./docs/DEPLOYMENT.md) | Vercel Setup |

# Projektübersicht – Remember Me

**Status:** 🔵 IN PROGRESS  
**Version:** 1.6.0  
**Letzte Aktualisierung:** 2026-04-20

---

## Projektbeschreibung

**Remember Me** ist eine Progressive Web App (PWA), mit der Menschen ihre Lebensgeschichte, persönlichen Erinnerungen, Werte und Erfahrungen spielerisch für die Nachwelt festhalten können.

Die Idee: Viele Menschen möchten ihren Kindern, Enkeln und Angehörigen mehr hinterlassen als nur Fotos – echte Geschichten, Werte, Ratschläge, Kindheitserinnerungen. **Remember Me** führt sie durch gezielte Fragen in Lebenskategorien und macht daraus ein persönliches, bleibendes Dokument.

Die App ist vollständig responsiv und funktioniert nahtlos auf:
- 📱 Mobilgeräten – installierbar als PWA auf iOS & Android
- 💻 Desktop/Tablet – für längere Antworten
- 📴 Offline – mit Service Worker & Workbox-Caching

---

## Kernkonzept

```
Benutzer öffnet App (oder installiert sie auf dem Startbildschirm)
      ↓
Wählt Kategorie (z.B. "Kindheit") oder erstellt eigene Fragen
      ↓
Beantwortet Fragen spielerisch (Text, Auswahl, Skala, Jahreszahl)
      ↓
Antworten werden lokal gespeichert (localStorage → geplant: IndexedDB)
      ↓
Lebensarchiv wächst mit der Zeit
      ↓
Teilen / Exportieren (PDF, Freunde einladen, KI-Export)
```

---

## Projektziele

### Abgeschlossen ✔️
- [x] Progressive Web App (PWA) Grundstruktur, Vercel Deployment
- [x] Vite + React 19 + TypeScript Setup
- [x] Frage-Engine mit 6 Kategorien, 50+ Fragen (text, choice, scale, year)
- [x] Lokale Datenspeicherung (localStorage, Auto-Save, forward-compatible migration)
- [x] Vollständiger Fragenkatalog (alle 6 Kategorien)
- [x] Antwort-Übersicht / Lebensarchiv (alle Kategorien + Freunde-Beiträge)
- [x] Antworten bearbeitbar im Archiv (Inline-Edit)
- [x] PDF/Druck-Export via `window.print()` + `@media print` CSS
- [x] Freunde einladen (Einladungslinks via URL-Hash, Base64-codiert)
- [x] Freundes-Antwort-Import (Export-Code System, vollständig offline)
- [x] Profil-Seite (Name, Geburtsjahr, Statistiken)
- [x] Eigene Fragen erstellen, beantworten, teilen (Question-Pack-Codes)
- [x] 4 wechselbare Themes (Nacht, Hell, Sepia, Ozean) mit CSS-Variablen
- [x] Logo + HeroLogo-Komponente mit animiertem Herz-SVG
- [x] App-Icons (192px, 512px, apple-touch 180px) mit Gradienten
- [x] PWA installierbar: iOS-Meta-Tags, android `mobile-web-app-capable`
- [x] Install-Prompt: Android nativ (`beforeinstallprompt`), iOS Anleitung

### Geplant 📋 / Umgesetzt ✔️
- [x] KI-lesbarer Export: Markdown (`.md`) + Enriched JSON (`.json`) im Archiv – v1.4.0
- [x] Foto-Anhänge zu Antworten (IndexedDB, Komprimierung, Lightbox) – v1.5.0
- [x] Themen-Auswahl für Freundes-Einladungen (4 Themen × 5 Fragen) – v1.5.0
- [x] Fragen überspringen (eigener Flow + Freunde-Flow) – v1.5.1
- [x] Onboarding-Screen beim Erststart (Erklärung, Offline-Hinweis, Namenseingabe) – v1.5.2
- [x] Profil-Seite UX-Redesign (Avatar, Karten, iOS-Settings-Felder, Theme-Grid) + App-weite Typografie – v1.5.4
- [x] Bottom-Tab-Navigation (5 Tabs, iOS/Android-Stil, Badge-Zähler) – v1.5.5
- [x] Export & Backup-Funktion im Profil (Markdown, JSON, Backup + Wiederherstellung) – v1.5.6
- [x] PWA Update-Benachrichtigung (Service Worker Prompt, Banner) – v1.5.8
- [x] Freunde-Einladung: Share-Link-Flow (Web Share API, automatischer Import) – v1.5.9
- [x] **Release Notes / „Was ist neu?"** – in-App Versionshistorie; UpdateBanner mit optionalem „Was ist neu?"-Button; dauerhafter Einstieg im Profil – v1.6.0
- [x] **Audio-Aufnahme & Transkription** – Fragen einsprechen statt tippen; automatische Transkription via Web Speech API (lokal, kein Cloud-Upload) wird **immer** als `audioTranscript` gespeichert; Originalton-Datei speicherbar als **optionaler** Schritt (Checkbox im Vorschau-Screen); Archiv zeigt Audio-Player wenn Datei gespeichert (REQ-009)
- [x] **Video-Anhänge** – Videos zu Antworten hinzufügen; IndexedDB-Speicher (`rm-videos`), Inline-Wiedergabe, ZIP-Export-Integration (REQ-012)
- [x] **Hilfe & FAQ** – Datenschutz, Import, Export, Offline-Nutzung erklärt; eigene FAQ-Ansicht (REQ-010)
- [x] **Erinnerungs-Archiv ZIP-Export** – Komplettarchiv als ZIP inkl. Fotos, Audio & Video; Share Sheet Integration (REQ-011)
- [x] **Erinnerungs-Archiv-Import** – Wiederherstellung aus ZIP oder JSON-Backup; Fotos, Videos, Audio werden mitimportiert (REQ-013)
- [ ] Push Notifications (Erinnerung zum Weitermachen)
- [ ] Mehrsprachigkeit (DE / EN)
- [ ] **Lebenszeitlinie** – chronologische Ansicht aller Erlebnisse und Fotos auf einer visuellen Timeline, filterbar nach Jahr und Kategorie; optional ungefähres Alter pro Eintrag (z. B. „ca. 8 Jahre alt"), wird automatisch aus Geburtsjahr vorgeschlagen (REQ-006)
- [ ] **Privater Sync** – Optionaler E2EE-Sync (Web Crypto API, verschlüsselte Synchronisation zwischen Geräten, opt-in)
- [ ] **Import bestehender Erinnerungen** – Erinnerungen und Fotos aus sozialen Netzwerken (Facebook, Instagram), Clouds und lokalen Ordnern importieren, mit optionaler eigener Beschreibung (REQ-007)
- [ ] **Automatische Lebensgeschichte** – aus den gespeicherten Antworten per KI eine fertige, lesbare Lebensgeschichte in verschiedenen Stilen und Sprachen generieren, vorschau- und exportierbar (REQ-008)

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
| Build | Vite 6 |
| PWA | vite-plugin-pwa + Workbox |
| Styling | CSS Custom Properties (4 Themes) |
| Persistenz | localStorage (Zustand) + IndexedDB (Bilder, Audio, Video) |
| Deployment | Vercel (static SPA) |
| Icons | sharp (SVG → PNG, `npm run generate-icons`) |

---

## Datenmodell (aktuell)

```
AppState (localStorage: 'remember-me-state')
├── profile: { name, birthYear?, createdAt }
├── answers: Record<questionId, Answer>
│   └── Answer: { id, questionId, categoryId, value, imageIds?, audioId?, audioTranscribedAt?,
│                  audioTranscript?, videoIds?, eventDate?, approxAge?, importSource?, createdAt, updatedAt }
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
| Release Notes | Versionsbeschreibungen für Nutzer – was hat sich in der neuen Version geändert; abrufbar im Update-Banner und im Profil |
| E2EE | Ende-zu-Ende-Verschlüsselung (geplant für Privater Sync) |
| KI-Export | Archiv in KI-lesbarem Format (Markdown/JSON) – ✔️ umgesetzt |
| Audio-Aufnahme | Fragen einsprechen statt tippen; Transkript immer gespeichert, Originalton-Datei optional – ✔️ umgesetzt |
| Video-Anhänge | Videos zu Antworten hinzufügen; IndexedDB-basiert – ✔️ umgesetzt |
| Erinnerungs-Archiv | ZIP-Export & -Import inkl. Fotos, Audio, Video – ✔️ umgesetzt |
| approxAge | Ungefähres Lebensalter zum Zeitpunkt eines Erlebnisses, für die Zeitlinie |
| Lebenszeitlinie | Chronologische visuelle Ansicht aller Einträge und Fotos; mit optionalem ca. Alter (geplant) |
| Privater Sync | Verschlüsselte Synchronisation zwischen Geräten (geplant) |
| Import Erinnerungen | Import aus sozialen Netzwerken, Clouds, lokalen Ordnern (geplant) |
| Biografie-Generator | KI-gestützte Umwandlung der Antworten in eine fertige Lebensgeschichte (geplant) |

---

## Key Stakeholder

- **Projekt Owner:** Saturas89
- **Lead Developer:** Claude Code
- **Zielgruppe:** Menschen aller Altersgruppen, besonders 40+ / Familien

---

## Dokumentation

- [CHANGELOG](./CHANGELOG.md) – Versionshistorie
- [Anforderungen](./requirements/README.md) – REQ-001 bis REQ-013
- [KI-Export Konzept](./design/AI_READABLE_EXPORT.md) – Vorschläge für KI-lesbare Formate

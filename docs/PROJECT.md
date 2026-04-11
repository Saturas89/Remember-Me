# Projektübersicht – Remember Me

**Status:** 🔵 IN PROGRESS  
**Version:** 1.4.0  
**Letzte Aktualisierung:** 2026-04-11

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

### Geplant 📋
- [x] KI-lesbarer Export: Markdown (`.md`) + Enriched JSON (`.json`) im Archiv – v1.4.0
- [ ] Medienanhänge (Fotos zu Antworten) – v1.5.0
- [ ] IndexedDB statt localStorage (für große Mediendaten) – v1.5.0
- [ ] Optionaler E2EE-Sync (Web Crypto API + Supabase, opt-in) – v1.6.0
- [ ] Push Notifications (Erinnerung zum Weitermachen)
- [ ] Backend-Sync + Familien-Freigabe-Links – v2.0.0
- [ ] LLM-Direktintegration: Biografie auf Knopfdruck – v2.1.0

---

## Fragenkategorien

| Kategorie | Emoji | Fragen | Status |
|-----------|-------|--------|--------|
| Kindheit & Jugend | 🧒 | 10 | ✔️ |
| Familie & Beziehungen | 👨‍👩‍👧‍👦 | 8 | ✔️ |
| Beruf & Leidenschaften | 💼 | 7 | ✔️ |
| Werte & Überzeugungen | 🌟 | 6 | ✔️ |
| Erinnerungen & Erlebnisse | 📸 | 7 | ✔️ |
| Wünsche & Vermächtnis | ✉️ | 6 | ✔️ |
| **Eigene Fragen** | ✏️ | unbegrenzt | ✔️ |
| **Freunde-Perspektive** | 👥 | 10 | ✔️ |

---

## Technologie-Stack

| Schicht | Technologie |
|---------|-------------|
| Framework | React 19 + TypeScript |
| Build | Vite 6 |
| PWA | vite-plugin-pwa + Workbox |
| Styling | CSS Custom Properties (4 Themes) |
| Persistenz | localStorage (→ IndexedDB geplant) |
| Deployment | Vercel (static SPA) |
| Icons | sharp (SVG → PNG, `npm run generate-icons`) |

---

## Datenmodell (aktuell)

```
AppState (localStorage: 'remember-me-state')
├── profile: { name, birthYear?, createdAt }
├── answers: Record<questionId, Answer>
│   └── Answer: { id, questionId, categoryId, value, createdAt, updatedAt }
├── friends: Friend[]
│   └── Friend: { id, name, addedAt }
├── friendAnswers: FriendAnswer[]
│   └── FriendAnswer: { id, friendId, friendName, questionId, value, createdAt }
└── customQuestions: CustomQuestion[]
    └── CustomQuestion: { id, text, type, helpText?, options?, createdAt }
```

Vollständige Typ-Definitionen: `src/types.ts`  
Zustandsverwaltung: `src/hooks/useAnswers.ts`

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
| InviteData | Daten im Einladungslink (profileName + friendId) |
| E2EE | Ende-zu-Ende-Verschlüsselung (geplant für Sync) |
| KI-Export | Archiv in KI-lesbarem Format (Markdown/JSON, geplant) |

---

## Key Stakeholder

- **Projekt Owner:** Saturas89
- **Lead Developer:** Claude Code
- **Zielgruppe:** Menschen aller Altersgruppen, besonders 40+ / Familien

---

## Dokumentation

- [CHANGELOG](./CHANGELOG.md) – Versionshistorie
- [Anforderungen](./requirements/README.md) – REQ-001 bis REQ-005
- [KI-Export Konzept](./design/AI_READABLE_EXPORT.md) – Vorschläge für KI-lesbare Formate

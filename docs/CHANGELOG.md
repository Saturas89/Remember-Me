# Changelog – Remember Me

Alle veröffentlichten Versionen des Projekts, absteigend sortiert.

Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).
Versionierung folgt [Semantic Versioning](https://semver.org/lang/de/).

---

## [1.3.1] – 2026-04-10

### Hinzugefügt / Geändert

#### PWA – Installierbar auf iOS & Android
- **App-Icons** generiert: `pwa-192x192.png`, `pwa-512x512.png`, `apple-touch-icon.png` (180×180)
  - Herz-Symbol auf `#1a1a2e`-Hintergrund, passend zum App-Design
  - Generiert via `scripts/generate-icons.mjs` (reproduzierbar mit `npm run generate-icons`)
- **iOS-Unterstützung** in `index.html`:
  - `<link rel="apple-touch-icon">` – Icon für „Zum Home-Bildschirm hinzufügen"
  - `<meta name="apple-mobile-web-app-capable" content="yes">` – Startet ohne Safari-UI (Standalone)
  - `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">` – Statusleiste transparent
  - `<meta name="apple-mobile-web-app-title" content="Remember Me">` – Label unter dem App-Icon
  - `viewport-fit=cover` im `viewport`-Meta für Geräte mit Notch (iPhone X+)
- **Android-Unterstützung** in `index.html`:
  - `<meta name="mobile-web-app-capable" content="yes">` – Chrome Install-Banner
- **Web-Manifest** bereinigt:
  - Beschreibung korrigiert (war noch von simple-workout)
  - `lang: 'de'`, `orientation: 'portrait'`, `categories: ['lifestyle', 'social']` ergänzt
  - `purpose: 'maskable'` Icon für Android adaptive Icons korrekt gesetzt
- Precache-Einträge: 6 → 13 (Icons nun eingeschlossen)
- **REQ-001** PWA Foundation als `✔️ COMPLETED` markiert

---

## [1.3.0] – 2026-04-10

### Hinzugefügt

#### Profil-Seite
- **`ProfileView`** – Eigene Ansicht für Profilinformationen:
  - Statistik-Kacheln: Antworten, Abschluss-%, Freunde, Tage dabei
  - Felder für Name und Geburtsjahr bearbeitbar
  - „Mitglied seit"-Datum
- Klick auf den Namen auf der Startseite öffnet direkt die Profil-Seite

#### Bearbeitbare Antworten im Archiv
- Jede Antwort im Archiv hat einen Bearbeiten-Button (✎)
- Inline-Edit-Formular: Klick → Textarea öffnet sich mit aktuellem Inhalt → Speichern/Abbrechen
- Kein Seitenwechsel nötig

#### PDF/Druck-Export
- **Drucken-Button** in der Archiv-Topbar (🖨 Drucken)
- `window.print()` öffnet den Browser-Druckdialog → „Als PDF speichern" möglich
- `@media print` CSS: Navigation/Buttons ausgeblendet, sauberes Drucklayout mit Rahmenlinien

#### Eigene Fragen
- **`CustomQuestion`-Datenmodell** – User kann beliebige eigene Fragen anlegen und persistent speichern
- **`CustomQuestionsView`** – Verwaltungsseite:
  - Frage hinzufügen (Texteingabe + Enter)
  - Inline-Antworten direkt in der Liste bearbeiten
  - Fragen einzeln löschen
- **Eigene Fragen im Archiv** – Abschnitt „✏️ Eigene Fragen" mit denselben Bearbeiten-Buttons
- **Eigene Fragen teilen** – Fragen-Code (base64-codiertes JSON) generieren und kopieren
- **Fragen importieren** – Code einfügen, Duplikate werden automatisch übersprungen
- **`QuestionPack`-Datenmodell** – `{ questions, createdBy? }` für Teilen/Import
- `encodeQuestionPack` / `decodeQuestionPack` in `src/utils/sharing.ts`

### Geändert
- `AppState` erweitert um `customQuestions: CustomQuestion[]`
- `useAnswers`-Hook um `addCustomQuestion`, `removeCustomQuestion`, `importCustomQuestions` erweitert
- `ArchiveView`: Props `onSaveAnswer` + `customQuestions` hinzugefügt; Antworten editierbar
- `HomeView`: Eigene-Fragen-Button mit Badge + Name-Button navigiert zu ProfileView
- `App.tsx`: Neue Views `profile` und `custom-questions` im Router
- Rückwärtskompatibel: `customQuestions: []` wird bei fehlenden Daten automatisch ergänzt

---

## [1.2.0] – 2026-04-10

### Hinzugefügt

#### Logo & Themes
- **`HeroLogo`-Komponente** – Zentrierter Schriftzug für die Startseite: animiertes Herz-SVG, „REMEMBER" in dünner Versalschrift, „Me" in Fettschrift mit Akzentfarbe
- **`Logo`-Komponente** – Kompakte Variante für Kopfzeilen (`sm`/`md`/`lg`)
- **4 wechselbare Themes** über `data-theme`-Attribut am `<html>`-Element:
  | Theme | Farbschema |
  |-------|-----------|
  | 🌙 **Nacht** | Dunkelblau + Rot (Standard) |
  | ☀️ **Hell** | Weiß / Hellgrau + Dunkelrot |
  | 📜 **Sepia** | Warmes Pergament + Braun |
  | 🌊 **Ozean** | Tiefblau + Cyan |
- **`ThemeSwitcher`-Komponente** – 4 Emoji-Buttons oben rechts auf der Startseite
- **`useTheme`-Hook** – Speichert gewähltes Theme in `localStorage`, wendet es sofort an
- **FOUC-Schutz** in `index.html` – Inline-Script setzt Theme vor dem ersten Paint
- **CSS-Variablen-System** – Alle Farben in `App.css` durch Variablen ersetzt (`--bg`, `--surface`, `--accent`, `--text-muted`, …)
- **Herzschlag-Animation** auf dem Herz-Logo (subtil, 3,5 s Zyklus)

### Geändert
- `src/index.css`: Vollständig neu mit 4 Theme-Definitionen als CSS-Custom-Properties
- `src/App.css`: Alle hardcodierten Farben durch CSS-Variablen ersetzt
- `HomeView`: Neues Hero-Layout mit Logo und Theme-Switcher, Name-Button kompakter
- `index.html`: FOUC-Schutz und aktualisierte Meta-Description

---

## [1.1.0] – 2026-04-10

### Hinzugefügt

#### Freunde-Feature (Friend Contributions)
- **`Friend`-Datenmodell** – Freunde können mit Namen hinzugefügt werden und werden persistent gespeichert
- **`FriendAnswer`-Datenmodell** – Antworten von Freunden werden dem Benutzer zugeordnet gespeichert
- **Einladungslink-System** – Generiert einen personalisierten URL (`#invite/[base64]`) der dem Freund geschickt wird
- **`FriendAnswerView`** – Eigene App-Ansicht für Freunde: Begrüßung → Name eingeben → Fragen beantworten → Antwortcode generieren
- **`FriendsView`** – Verwaltungsseite für alle eingeladenen Freunde, Einladungslinks und Antwort-Import
- **`FriendCard`** – Karte pro Freund mit Avatar, Fortschrittsbalken und Aktionen (Link / Entfernen)
- **Antwortcode-System** – Freund beantwortet Fragen → erhält einen base64-codierten Code → Benutzer importiert ihn
- **`FRIEND_QUESTIONS`** – 10 Fragen aus Freundesperspektive mit `{name}`-Platzhalter (z.B. „Wie würdest du {name} beschreiben?")
- **`src/utils/sharing.ts`** – Hilfsfunktionen für Encode/Decode von Einladungen und Antwort-Exporten
- **Profil-Name-Eingabe** auf der Startseite – Wird für personalisierten Einladungslink benötigt
- **Freundes-Beiträge im Archiv** – Eigener Abschnitt „Was Freunde über mich sagen" mit grüner Markierung

#### Allgemein
- `HomeView`: Freunde-Button mit Badges (Anzahl Freunde / Anzahl Antworten)
- `ArchiveView`: Zeigt Freundes-Antworten gruppiert nach Person
- Alle neuen UI-Stile in `App.css`

### Geändert
- `AppState` erweitert um `friends: Friend[]` und `friendAnswers: FriendAnswer[]`
- `useAnswers`-Hook um `addFriend`, `removeFriend`, `importFriendAnswers`, `getFriendAnswers` erweitert
- `App.tsx`: URL-Hash wird beim Start geprüft – Invite-Link öffnet direkt `FriendAnswerView`

### Technisch
- Daten bleiben vollständig lokal (kein Backend nötig)
- Sharing funktioniert über copy-paste (Base64-codierte JSON-Payloads)
- Rückwärtskompatibel: bestehende `localStorage`-Daten werden automatisch migriert

---

## [1.0.0] – 2026-04-10

### Hinzugefügt

#### PWA-Grundstruktur
- Vite + React 19 + TypeScript Setup
- `vite-plugin-pwa` mit Workbox Service Worker (Offline-Unterstützung)
- Vercel Deployment (statische SPA, `dist/` als Output)
- `vercel.json` mit SPA-Rewrites (`/(.*) → /index.html`)
- PWA-Manifest mit Icons und `standalone`-Display
- `package-lock.json` committed (reproducible builds)

#### Frage-Engine
- 6 Kategorien mit insgesamt 50+ Fragen auf Deutsch:
  - 🧒 Kindheit & Jugend (10 Fragen)
  - 👨‍👩‍👧‍👦 Familie & Beziehungen (8 Fragen)
  - 💼 Beruf & Leidenschaften (7 Fragen)
  - 🌟 Werte & Überzeugungen (6 Fragen)
  - 📸 Erinnerungen & Erlebnisse (7 Fragen)
  - ✉️ Wünsche & Vermächtnis (6 Fragen)
- Fragetypen: `text`, `choice`, `scale`, `year`
- Spielerischer Karten-Flow mit Zurück/Weiter-Navigation
- Fortschrittsbalken pro Kategorie und gesamt

#### Datenspeicherung
- `useAnswers`-Hook mit `localStorage`-Persistenz (Auto-Save)
- Kein Datenverlust beim Browser-Schließen

#### Archiv
- Lebensarchiv-Ansicht: alle Antworten gruppiert nach Kategorie
- Datum der Antwort sichtbar

#### UI / Design
- Dark-Theme (Navy + Rot-Akzent `#e94560`)
- Responsive Grid (1 Spalte mobile, 2 Spalten ab 540px)
- Kategorie-Karten mit Emoji, Beschreibung, Fortschrittsbalken
- Vollständiges Button-System (primary, ghost, outline, sm)

#### Dokumentation
- `README.md` mit Projektbeschreibung und Konzept
- `docs/PROJECT.md` – Projektziele, Kategorien, Glossar
- `docs/modules/README.md` – Modulübersicht (Core, Questions, Stories, Data, Export, UI)
- `docs/requirements/README.md` – Anforderungstabelle mit MoSCoW-Priorisierung
- `REQ-001` – PWA Foundation & Responsive Design
- `REQ-002` – Frage-Engine & Fragenkatalog
- `REQ-003` – Lebensarchiv & Datenspeicherung
- `REQ-004` – Export & Teilen
- `REQ-005` – CI/CD Pipeline

---

## Geplante Versionen

| Version | Inhalt | Status |
|---------|--------|--------|
| **1.2.0** | Logo, 4 Themes, CSS-Variablen | ✔️ Fertig |
| **1.3.0** | Profil-Seite, Archiv bearbeitbar, PDF-Export, Eigene Fragen + Teilen | ✔️ Fertig |
| **1.4.0** | Medienanhänge (Fotos zu Antworten) | Geplant |
| **1.5.0** | IndexedDB-Migration + optionaler E2EE-Sync (Web Crypto API + Supabase) | Geplant |
| **2.0.0** | Backend-Sync, Familien-Freigabe-Links mit geteilten Schlüsseln | Zukunft |

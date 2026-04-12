# Changelog – Remember Me

Alle veröffentlichten Versionen des Projekts, absteigend sortiert.

Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).
Versionierung folgt [Semantic Versioning](https://semver.org/lang/de/).

## [1.5.6] – 2026-04-12

### Hinzugefügt

#### Export & Backup-Funktion in der Profilansicht

**Profil → „Exportieren & Sichern" (neue Karte):**
- 3 Export-Buttons in einem 3-Spalten-Grid:
  - **📄 Markdown** – Lebensgeschichte als `.md` (für KI & Texteditoren)
  - **📊 JSON** – Angereichertes JSON (strukturierter Export, lesbar)
  - **💾 Backup** – Vollständiges Rohdaten-Backup (für Wiederherstellung)
- **Backup wiederherstellen**: Datei-Upload-Button für `.json`-Backup-Dateien; Bestätigungsdialog vor dem Überschreiben bestehender Daten; Erfolgs- / Fehlermeldung nach Import
- Hinweis: Fotos (IndexedDB) sind nicht im Backup enthalten
- Export-Buttons im Archiv-Topbar bleiben als Schnellzugriff erhalten

**Neue Backup-Format-Spezifikation:**
- `$type: "remember-me-backup"`, `version: 2`
- Enthält vollständiges `state`-Objekt: `profile`, `answers`, `friends`, `friendAnswers`, `customQuestions`
- `exportAsBackup()` in `utils/export.ts`, `restoreBackup()` in `useAnswers.ts`

---

## [1.5.5] – 2026-04-11

### Geändert

#### Bottom-Tab-Navigation + Profil-Stats-Ausrichtung

**Moderne Bottom-Tab-Bar (iOS/Android-Stil):**
- Neue Komponente **`BottomNav`**: 5 Tabs — 🏠 Start · 📖 Archiv · ✏️ Fragen · 👥 Freunde · 👤 Profil
- Fixierte Navigation am unteren Bildschirmrand mit Blur-Hintergrund (`backdrop-filter: blur(18px)`) und `safe-area-inset-bottom`
- Aktiver Tab: Akzentfarbe + Icon-Bounce-Animation (`translateY(-2px) scale(1.12)`)
- Freunde-Tab zeigt Badge-Zähler für neue Freundesantworten
- `HomeView` bereinigt: `home-actions`-Buttons entfernt (Archiv, Freunde, Eigene Fragen – jetzt in Nav)
- **„Eigene Fragen"** als gestrichelte Karte im Kategorien-Raster eingebaut (`.category-card--custom`)
- Gruß-Zeile „Hallo, {Name}" als dezente Sub-Headline im Home-Header
- `ProfileView` / alle Views: Bottom-Padding auf `4.5rem` angepasst (= Tab-Bar-Höhe)

**Profil-Stats Ausrichtung:**
- `.profile-stats` von `auto-fit minmax(88px, 1fr)` auf `repeat(2, 1fr)` umgestellt
- Bei 3 Kacheln: drittes Element zentriert per `grid-column: 1/-1; justify-self: center`
- Verhindert Zeilen-Wrap bei „ABGESCHLOSSEN" auf schmalen Displays

---

## [1.5.4] – 2026-04-11

### Geändert

#### Profil-Seite UX-Redesign + Typografie-Verbesserungen

**Profil-Seite komplett überarbeitet:**
- **Identity-Header**: Großes Avatar-Kreise (Initialen, Akzentfarbe + Glüheffekt), Name als dominante Headline, „Dabei seit…"-Meta subtil darunter
- **Profil-Karten** (`.profile-card`): Abgerundete Karten mit einheitlichem Padding; Überschriften als kleine, gepunktete ALL-CAPS Labels (0.68 rem, 0.12em Abstand) — klar ohne aufdringlich zu sein
- **Formularfelder**: iOS-Settings-Stil — `Name` / `Geburtsjahr` in eingebetteten Zeilen mit Label links, Wert rechts; kein Rahmen im Feld, der Container gibt die Kontur vor
- **Stats-Kacheln**: Kompaktere Raster, akzentuierte Zahl, kleinere Label; passen jetzt platzsparender rein
- **Theme-Karten**: 2×2-Grid mit farbigem Punkt + Emoji + Label; aktive Karte hebt sich durch Akzentrand + getönten Hintergrund ab; ✓-Haken erscheint rechts

**App-weite Typografie verbessert:**
- `index.css`: Schriftfamilie um `'Segoe UI'`, `Roboto`, `Helvetica` erweitert; `text-rendering: optimizeLegibility`; `-moz-osx-font-smoothing`; globale Heading-Basisstile (`h1–h4`: `letter-spacing: -0.02em`)
- **Archiv-Eintragsköpfe** (Fragenzeile): von normaler Schriftgröße auf `0.78 rem font-weight 600` — Frage vs. Antwort sind jetzt klar unterscheidbar
- **Archiv-Abschnittsüberschriften**: ALL-CAPS mit Buchstabenabstand (analog zu Profil-Karten-Headings)
- **Datumsangaben**: Leicht verfeinerter Zeichenabstand
- **Monospace**: Konsistente Schriftfamilie für Code-Blöcke / Export-Codes

---

## [1.5.3] – 2026-04-11

### Geändert

#### Theme-Auswahl ins Profil-Menü verschoben
- **ThemeSwitcher** aus `HomeView` und `OnboardingView` entfernt – war zu prominent auf dem Hauptscreen
- Neuer Abschnitt **„Erscheinungsbild"** in `ProfileView` (Profil → unterhalb des Edit-Formulars):
  - Überschrift + die 4 Theme-Buttons (🌙 🌞 📜 🌊) in einer Zeile
- `.home-topbar` CSS-Klasse und `position: absolute`-Positionierung entfernt
- `.profile-section` / `.profile-section-title` als neue CSS-Klassen für den Einstellungs-Bereich

---

## [1.5.2] – 2026-04-11

### Hinzugefügt

#### Onboarding-Screen (Erststart)
- **`OnboardingView`** – Erscheint genau einmal beim ersten Öffnen der App (wenn noch kein Profil existiert)
- Aufbau des Screens:
  - **Hero**: Animiertes Logo + Tagline „Deine Geschichte verdient es, erzählt zu werden."
  - **Story**: Zwei Absätze über das Konzept (verblassende Erinnerungen, Fragen die nie gestellt wurden)
  - **Feature-Kacheln** (animiert eingeblendet): 🔒 Privat · 📴 Offline · ❤️ Für immer – je mit kurzer Erklärung
  - **Namenseingabe**: Eingabefeld + „Loslegen →"-Button
  - **Footer-Hinweis**: „Kostenlos · Keine Anmeldung nötig · Deine Daten bleiben auf deinem Gerät"
- Alle Sektionen mit gestaffelten `fade-slide-up`-Animationen eingeblendet
- Theme-Switcher oben rechts auch auf dem Onboarding-Screen verfügbar
- Nach Bestätigung wird direkt das Profil gespeichert und die Hauptansicht gezeigt
- `HomeView`: `editingName` startet nicht mehr als `true` – Name-Erfassung erfolgt vollständig über Onboarding

---

## [1.5.1] – 2026-04-11

### Hinzugefügt

#### Fragen überspringen
- **„Frage überspringen"**-Link unterhalb der Navigationsleiste in `QuestionCard`
- Erscheint nur wenn die aktuelle Frage noch keine Antwort hat (kein Text, keine Fotos) – bei beantworteten Fragen reicht „Weiter"
- Gilt für beide Flows: eigene Fragen beantworten **und** als eingeladener Freund
- Keine Datenbankänderung nötig – übersprungene Fragen hinterlassen keinen leeren Eintrag

---

## [1.5.0] – 2026-04-11

### Hinzugefügt

#### Foto-Anhänge
- **Bilder zu Antworten hinzufügen** – Bei Text-Fragen erscheint eine Foto-Leiste unterhalb des Textfeldes
- **`useImageStore`-Hook** – IndexedDB-basierter Bildspeicher (kein 5MB-Limit wie bei localStorage):
  - Bilder werden vor dem Speichern auf max. 1200px JPEG/82% komprimiert
  - Lazy Loading mit In-Memory-Cache; verhindert doppeltes Laden via `pendingRef`
- **`ImageAttachment`-Komponente** – Thumbnail-Leiste mit:
  - 📷 Foto-Button öffnet nativen Datei-Picker (Kamera oder Galerie)
  - Thumbnails mit ✕-Lösch-Button
  - Tippen auf Thumbnail → Vollbild-Lightbox mit Schließen-Button
  - Maximale Anzahl: 5 Fotos pro Antwort
- **Fotos im Archiv** – Thumbnails werden in jeder Antwort-Kachel angezeigt, löschen direkt möglich
- `Answer.imageIds?: string[]` – neues optionales Feld in `AppState`; rückwärtskompatibel
- `setAnswerImages()` + `getAnswerImageIds()` in `useAnswers`
- `getCategoryProgress` zählt jetzt auch reine Foto-Antworten (ohne Text) als beantwortet

#### Themen-Auswahl für Freundes-Einladungen
- **4 Themen × 5 Fragen** statt bisher 10 Fragen ohne Auswahl:
  | Thema | Emoji | Fokus |
  |-------|-------|-------|
  | Unsere Freundschaft | 🤝 | Wie ihr euch kennt, erste Eindrücke, gemeinsame Momente |
  | Persönlichkeit | ✨ | Charakter, Stärken, was andere sehen |
  | Gemeinsame Erlebnisse | 🌟 | Lustige Momente, Abenteuer, Veränderungen |
  | Familie | 👨‍👩‍👧 | Familienerinnerungen, Weitergabe, Werte |
- **Topic-Karten** in `FriendsView` – kompaktes 2×2-Grid; ausgewähltes Thema hervorgehoben
- **Invite-URL** enthält `topicId` – `FriendAnswerView` zeigt automatisch nur die 5 Fragen des gewählten Themas
- Rückwärtskompatibel: alte Links ohne `topicId` verwenden automatisch „Unsere Freundschaft"
- `InviteData.topicId?: string` in `types.ts`
- `FRIEND_TOPICS: FriendTopic[]` in `src/data/friendQuestions.ts`; `FRIEND_QUESTIONS` bleibt als flaches Array für Archiv-Auflösung erhalten

### Geändert
- `package.json` Version 1.5.0
- Willkommens-Hinweis in `FriendAnswerView` zeigt Thema-Emoji + Name + „5 Fragen · ca. 5 Minuten"

---

## [1.4.0] – 2026-04-11

### Hinzugefügt

#### KI-lesbarer Datenexport
- **`src/utils/export.ts`** – Neue Export-Utility mit zwei Formaten:
  - `exportAsMarkdown(data)` – Menschlich & KI-lesbar; löst Frage-IDs zu vollständigen Texten auf; enthält eigene Fragen + Freunde-Perspektiven
  - `exportAsEnrichedJSON(data)` – Strukturierter JSON-Export mit `$schema`, `exportVersion`, vollständigen Fragetexten, Datumsangaben
  - `downloadFile(content, filename, mime)` – Clientseitiger Browser-Download ohne Backend
- **Export-Buttons im Archiv** (Topbar, rechts):
  - `📄 .md` → lädt `[name].md` herunter (ideal zum Einfügen in Claude/ChatGPT)
  - `{ } JSON` → lädt `[name].json` herunter (strukturiert, maschinenlesbar)
  - `🖨` → Drucken (unverändert)
- `ArchiveView` erhält neues `profile`-Prop für Geburtsjahr + Mitglied-seit im Export

### Geändert
- `package.json` Version 1.4.0

---

## [1.3.2] – 2026-04-11

### Hinzugefügt

#### PWA Install-Prompt
- **`useInstallPrompt`-Hook** – Erkennt Installationsmöglichkeit auf Android und iOS:
  - Android/Chrome: fängt `beforeinstallprompt`-Event ab, löst nativen Install-Dialog aus
  - iOS/Safari: erkennt iPhone/iPad per UserAgent, zeigt manuelle Anleitung
  - Bereits installiert (`display-mode: standalone`)? → kein Banner
  - Dismissal persistent in `localStorage` (`rm-install-dismissed`)
- **`InstallBanner`-Komponente** – Erscheint zwischen Logo und Kategorien:
  - Android: „Installieren"-Button → öffnet nativen Chrome/Edge-Installationsdialog
  - iOS: Share-Icon (SVG) + Text „Tippe auf [↑] und dann ‚Zum Home-Bildschirm'"
  - ✕-Button schließt dauerhaft; Slide-in-Animation; Akzent-Linksrahmen

#### Design – Logo & App-Icon
- **`public/favicon.svg`** neu: Herz mit Coral→Crimson-Gradient + Soft Drop Shadow + Shine-Highlight auf navy-blauem Hintergrund
- **App-Icons** (192×192, 512×512, apple-touch 180×180) überarbeitet:
  - Tieferes Hintergrund-Gradient (`#1e2647` → `#0c1120`)
  - Radiale Glow-Ellipse hinter dem Herz
  - Herz: Gradient coral→crimson + Schattenlayer + inneres Highlight-Oval + Shine-Arc
  - Reproduzierbar: `npm run generate-icons`

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

## Versionsübersicht

| Version | Inhalt | Status |
|---------|--------|--------|
| **1.0.0** | PWA-Grundstruktur, Frage-Engine, Lebensarchiv | ✔️ Fertig |
| **1.1.0** | Freunde-Feature (Einladungslinks, Antwort-Codes) | ✔️ Fertig |
| **1.2.0** | Logo, 4 Themes, CSS-Variablen | ✔️ Fertig |
| **1.3.0** | Profil-Seite, Archiv bearbeitbar, PDF-Export, Eigene Fragen + Teilen | ✔️ Fertig |
| **1.3.1** | PWA installierbar (Icons, iOS/Android Meta-Tags, Manifest) | ✔️ Fertig |
| **1.3.2** | Install-Prompt (Android nativ, iOS Anleitung), Logo-Redesign | ✔️ Fertig |
| **1.4.0** | KI-lesbarer Datenexport (Markdown + Enriched JSON) | ✔️ Fertig |
| **1.5.0** | Foto-Anhänge (IndexedDB), Themen-Auswahl für Freundes-Fragen | ✔️ Fertig |
| **1.5.1** | Fragen überspringen (eigener Flow + Freunde-Flow) | ✔️ Fertig |
| **1.5.2** | Onboarding-Screen beim Erststart | ✔️ Fertig |
| **1.5.3** | Theme-Auswahl ins Profil-Menü verschoben | ✔️ Fertig |
| **1.6.0** | Optionaler E2EE-Sync (Web Crypto API + Supabase, opt-in) | Geplant |
| **2.0.0** | Backend-Sync, Familien-Freigabe-Links mit geteilten Schlüsseln | Zukunft |
| **2.1.0** | LLM-Direktintegration: Biografie auf Knopfdruck in der App | Zukunft |

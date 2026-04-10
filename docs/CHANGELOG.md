# Changelog – Remember Me

Alle veröffentlichten Versionen des Projekts, absteigend sortiert.

Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).
Versionierung folgt [Semantic Versioning](https://semver.org/lang/de/).

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
| **1.2.0** | Profil-Seite, Antworten bearbeitbar im Archiv | Geplant |
| **1.3.0** | PDF/Druck-Export des Lebensarchivs | Geplant |
| **1.4.0** | Medienanhänge (Fotos zu Antworten) | Geplant |
| **2.0.0** | Backend-Sync, Familien-Freigabe-Links | Zukunft |

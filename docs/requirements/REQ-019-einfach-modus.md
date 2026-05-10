# Anforderung: Einfach-Modus (vereinfachter Bedienmodus)

**Status:** ✔️ COMPLETED
**ID:** REQ-019
**Version:** 1.0.0
**Letzte Aktualisierung:** 2026-05-10
**Modul:** UX / Core
**Priorität:** Medium
**Implementiert seit:** v2.4.0

---

## 1. Zusammenfassung

Der **Einfach-Modus** ist ein optionaler, persistenter UI-Modus für ältere oder
weniger technikaffine Nutzer. Aktiviert reduziert er die App auf drei Tabs
(Lebensweg, Vermächtnis, Profil), vergrößert Schrift und Buttons und blendet
Power-Features (Familienmodus, Privater Sync, eigene Fragen, Foto/Video-Anhänge,
Export, Release-Notes) aus. Sprachaufnahmen bleiben verfügbar, weil ältere
Nutzer selten tippen.

Die Wahl erfolgt einmalig beim allerersten Start als Schritt 1 von 2 im
Onboarding (vor der Namens-Eingabe). Bestandsnutzer (Profil vorhanden, Modus
nie gewählt) sehen beim nächsten Öffnen einmalig die Modus-Wahl ohne
Namens-Schritt. Der Modus ist im Profil unter „Bedienung" jederzeit
umschaltbar.

---

## 2. Kernidee & User Stories

> „Als 78-jähriger Nutzer möchte ich nicht mit Familienmodus, Sync und
> eigenen Fragen konfrontiert werden, sondern nur die Erinnerungs-Fragen
> beantworten – mit großen Knöpfen und großer Schrift."

> „Als jüngerer Nutzer, der die App seinem Vater einrichtet, möchte ich
> bei der ersten Inbetriebnahme den passenden Bedienmodus wählen können."

> „Als Nutzer, der den Einfach-Modus probiert hat, möchte ich später ohne
> Datenverlust auf den vollständigen Modus umschalten können."

---

## 3. Funktionale Anforderungen

### 3.1 Modus-Wahl im Onboarding

- [x] **FR-19.1:** Beim ersten App-Öffnen (kein `profile`, kein `appMode` in
  localStorage) zeigt `OnboardingView` als Schritt 1 von 2 die Frage „Wie
  möchten Sie die App nutzen?" mit zwei Karten: „Einfach" (🪶) und
  „Erweitert" (✨). Step-Badge oben weist „Schritt 1 von 2" aus.
- [x] **FR-19.2:** Klick auf eine Karte speichert den Modus via
  `saveAppMode(mode)` und wechselt zu Schritt 2 (Namens-Eingabe). Der Hint
  „Sie können das später jederzeit in den Einstellungen ändern." steht
  unter den Karten.
- [x] **FR-19.3:** Test-IDs sind verbindlich: `onboarding-mode-simple`,
  `onboarding-mode-full`.
- [x] **FR-19.4:** Die Beschreibung der „Einfach"-Karte endet mit „… wenn
  Sie einfach Erinnerungen festhalten wollen." Die Beschreibung der
  „Erweitert"-Karte listet exemplarisch Familie teilen, Cloud-Sicherung,
  eigene Themen.

### 3.2 Upgrade-Flow für Bestandsnutzer

- [x] **FR-19.5:** Hat ein Bestandsnutzer ein `profile` aber noch keinen
  `appMode` (Update von einer Pre-2.4.0-Version), wird beim nächsten
  Öffnen die Modus-Wahl gezeigt – **ohne** anschließenden Namens-Schritt
  (`modeOnly = true`). Nach der Auswahl landet der Nutzer direkt auf Home.
- [x] **FR-19.6:** Bestehende Antworten, Freunde, Custom Questions, Online-
  Sharing-Status und Privater-Sync-Status bleiben durch den Upgrade-Flow
  unverändert.

### 3.3 UI-Reduktion in Simple Mode

- [x] **FR-19.7:** Die Bottom-Navigation zeigt in Simple Mode nur drei Tabs
  in dieser Reihenfolge: **Lebensweg (home)**, **Vermächtnis (archive)**,
  **Profil (profile)**. Die Tabs **Freunde** und **Sync** sind
  ausgeblendet.
- [x] **FR-19.8:** Versteckte Routen sind: `friends`, `sync`,
  `online-intro`, `online-hub`, `custom-questions`. Deep-Links auf diese
  Routen werden in Simple Mode auf `/` (Home) umgeleitet (defensiv via
  `history.replaceState`).
- [x] **FR-19.9:** Auf Home wird die „Eigene Fragen"-Card (Custom-Category-
  Tile) ausgeblendet.
- [x] **FR-19.10:** In `MediaCapture` werden Foto- und Video-Buttons sowie
  der einleitende Hint („Tipp: Du kannst Fotos/Videos hinzufügen…")
  ausgeblendet. Audio-Aufnahme bleibt vollständig sichtbar und nutzbar.
- [x] **FR-19.11:** Bereits vorhandene Foto-/Video-Anhänge (z. B. aus einem
  Backup oder nach Wechsel von Erweitert auf Einfach) werden weiterhin
  angezeigt – nur das Hinzufügen neuer Anhänge ist deaktiviert.
- [x] **FR-19.12:** Im Profil sind folgende Sektionen ausgeblendet: Geburts-
  jahr-Feld, Sprach-Auswahl, „Erinnerungen importieren" (Social Media),
  „Backup-Formate" (Markdown / JSON / Restore), „Was ist neu?"-Link,
  „Bald verfügbar"-Features-Grid.
- [x] **FR-19.13:** Sichtbar im Profil bleiben: Name, Lebens-Archiv-Export
  (ZIP-Share), **Bedienung**-Sektion (Modus-Toggle), Erscheinungsbild
  (Theme-Karten), Hilfe & FAQ.

### 3.4 Optische Anpassungen (CSS)

- [x] **FR-19.14:** `<html data-app-mode="simple">` wird gesetzt, sobald
  `appMode === 'simple'`, und entfernt, sobald nicht. Der Hook
  `useAppMode` ist die einzige Stelle, die dieses Attribut schreibt.
- [x] **FR-19.15:** Globale Schriftgröße steigt auf `1.15rem`. Buttons
  haben `min-height: 3rem` und `border-radius: 12px`, kleine Buttons
  (`btn--sm`) `min-height: 2.4rem`. Tab-Icons der Bottom-Navigation sind
  `2.2rem` × `2.2rem` groß, Tab-Labels `0.95rem`.
- [x] **FR-19.16:** `.home-greeting` rendert mit `1.4rem`,
  `.category-card__title` mit `1.25rem`, `.question-card__text` mit
  `1.5rem` (line-height 1.4), `.question-card__help` mit `1.05rem`,
  `input-text`/`input-textarea` mit `1.1rem` und `1rem` Padding.
- [x] **FR-19.17:** Theme-Karten und Mode-Karten im Profil rendern
  einspaltig (`grid-template-columns: 1fr`), damit größere Schrift nicht
  über den Rand bricht.
- [x] **FR-19.18:** Alle Werte stammen aus den existierenden Design-Tokens
  (`--surface`, `--text`, `--accent`, …). Alle vier Themes (sepia, nacht,
  hell, ozean) müssen weiterhin korrekt darstellen.

### 3.5 Modus-Toggle im Profil

- [x] **FR-19.19:** Sektion „Bedienung" im Profil zeigt zwei Karten
  (Einfach 🪶 / Erweitert ✨) mit Test-IDs `profile-mode-simple` und
  `profile-mode-full`. Die aktive Karte trägt die Klasse
  `profile-mode-card--active` und ein Häkchen ✓; `aria-pressed` reflek-
  tiert den Zustand.
- [x] **FR-19.20:** Klick auf eine Karte ruft `setAppMode(mode)` auf;
  Persistierung in localStorage erfolgt synchron. Reload erhält den
  gewählten Modus.
- [x] **FR-19.21:** Wechsel von Erweitert → Einfach blendet die o. g.
  Sektionen sofort aus und leitet bei aktiver versteckter Route
  (`friends`, `sync`, …) auf Home um. Wechsel von Einfach → Erweitert
  zeigt sie wieder, ohne Datenverlust.

### 3.6 Persistenz & Rückwärtskompatibilität

- [x] **FR-19.22:** `appMode` ist optional (`AppMode | undefined`) im
  `AppState`. Das Fehlen wird als „noch nicht gewählt" interpretiert und
  triggert die Modus-Wahl im Onboarding.
- [x] **FR-19.23:** `mergeRemoteState` (Privater Sync) übernimmt einen
  remote befüllten `appMode`, fällt aber auf den lokalen Wert zurück,
  wenn das Backup aus einer Pre-2.4.0-Version stammt (`appMode` fehlt
  remote).
- [x] **FR-19.24:** Backup-Import (JSON / ZIP) befüllt `appMode` falls im
  Archiv enthalten, sonst bleibt der lokale Wert erhalten. Der Import
  erzeugt nie ein leeres `appMode`-Feld.

---

## 4. Nicht-funktionale Anforderungen

| Anforderung | Wert |
|-------------|------|
| **Privacy** | Keine zusätzlichen Daten verlassen das Gerät; `appMode` ist nur lokal in localStorage. Beim Privaten Sync (REQ-017) wird er als Teil des verschlüsselten `AppState` synchronisiert. |
| **Offline** | Modus-Wahl, Modus-Wechsel und alle Simple-Mode-Views funktionieren offline. |
| **Performance** | Keine zusätzlichen Bundles oder Ladevorgänge; Simple-Mode-CSS ist Teil von `App.css`. |
| **A11y** | Modus-Karten als `<button type="button">` mit `aria-pressed`. Schrift- und Button-Größen erfüllen erhöhte Touch-Targets (≥ 44 px). |
| **Themes** | Alle vier Themes (sepia, nacht, hell, ozean) bleiben funktional. |
| **Rückwärtskompatibilität** | `appMode` optional; Bestandsnutzer ohne Feld werden via Mode-Choice-Gate nachgezogen, ohne Daten zu verlieren. |

---

## 5. Architektur

### 5.1 Relevante Dateien

```
src/
├── types.ts                     # type AppMode = 'simple' | 'full'; AppState.appMode?: AppMode
├── hooks/
│   ├── useAppMode.tsx           # Context-Provider, setzt data-app-mode auf <html>
│   └── useAnswers.ts            # saveAppMode(); appMode in AppState persistiert
├── views/
│   ├── OnboardingView.tsx       # Schritt 'mode' | 'name'; needsModeChoice / modeOnly
│   ├── HomeView.tsx             # blendet Custom-Category-Card aus
│   └── ProfileView.tsx          # Bedienung-Sektion + Sichtbarkeitsschalter für andere Sektionen
├── components/
│   ├── BottomNav.tsx            # 3 statt 5 Tabs in Simple Mode
│   └── MediaCapture.tsx         # blendet Foto-/Video-Buttons aus, Audio bleibt
├── App.tsx                      # HIDDEN_IN_SIMPLE Set + Redirect-Effekt; Onboarding-Gate
├── App.css                      # [data-app-mode="simple"] Selektor-Block
└── locales/
    ├── de/ui.ts                 # onboarding.mode*, profile.mode*
    └── en/ui.ts                 # onboarding.mode*, profile.mode* (Advanced statt Full)
```

### 5.2 Datenfluss

```
useAnswers (AppState.appMode aus localStorage)
    ↓
App.tsx prüft: !profile || !appMode → Onboarding (Mode-Choice-Schritt)
    ↓
OnboardingView ruft onChooseMode(mode) → saveAppMode(mode) persistiert
    ↓
AppModeProvider setzt data-app-mode="simple" auf <html>
    ↓
useAppMode().isSimple ⇒ BottomNav, HomeView, MediaCapture, ProfileView reduzieren UI
    ↓
HIDDEN_IN_SIMPLE-Effekt in App.tsx leitet versteckte Routen auf Home
```

---

## 6. Datenmodell

```typescript
export type AppMode = 'simple' | 'full'

export interface AppState {
  // … bestehende Felder
  /** Undefined ⇒ user hasn't picked yet (triggers mode-choice in onboarding). */
  appMode?: AppMode
}
```

`localStorage` (verschlüsseltes Gesamt-AppState-Objekt) speichert:
```json
{
  "profile": { "name": "Anna", "createdAt": "…" },
  "answers": { … },
  "appMode": "simple"
}
```

---

## 7. UI-Spezifikation

### 7.1 Onboarding-Mode-Choice-Screen

```
┌──────────────────────────────────────┐
│              [HeroLogo]              │
│           Schritt 1 von 2            │
│                                      │
│   Wie möchten Sie die App nutzen?    │
│                                      │
│   ┌──────────────────────────────┐  │
│   │ 🪶  Einfach                  │  │
│   │     Große Schrift und nur    │  │
│   │     die wichtigsten Knöpfe.  │  │
│   │     Empfohlen, wenn Sie …    │  │
│   └──────────────────────────────┘  │
│   ┌──────────────────────────────┐  │
│   │ ✨  Erweitert                │  │
│   │     Alle Funktionen: mit     │  │
│   │     Familie teilen, Sicher-  │  │
│   │     ung in der Cloud, …      │  │
│   └──────────────────────────────┘  │
│                                      │
│   Sie können das später jederzeit   │
│   in den Einstellungen ändern.       │
└──────────────────────────────────────┘
```

### 7.2 Simple-Mode-Bottom-Nav

```
┌──────────┬───────────────┬──────────┐
│  🏞     │     📜        │   👤     │
│ Lebens- │  Vermächtnis  │  Profil  │
│  weg    │               │          │
└──────────┴───────────────┴──────────┘
```

(Statt regulär 5 Tabs: Home · Freunde · Vermächtnis · Sync · Profil.)

### 7.3 Profil-Sektion „Bedienung"

Zwei einspaltige Mode-Karten unterhalb des Profil-Headers, oberhalb des
Erscheinungsbild-Blocks. Die aktive Karte zeigt Häkchen ✓ und die Klasse
`profile-mode-card--active`. `data-testid` jeweils `profile-mode-simple` /
`profile-mode-full`.

---

## 8. Akzeptanzkriterien

- [x] Erst-Besucher sieht Mode-Choice **vor** Namens-Eingabe (Step-Badge
  „Schritt 1 von 2").
- [x] Pick „Einfach" → 3 Tabs sichtbar, Custom-Category-Card auf Home
  ausgeblendet, `<html data-app-mode="simple">` gesetzt.
- [x] Pick „Erweitert" → 5 Tabs sichtbar, Custom-Category-Card sichtbar,
  kein `data-app-mode`-Attribut.
- [x] Wechsel im Profil zwischen Einfach/Erweitert ist sofort sichtbar
  (Tabs, ausgeblendete Sektionen, CSS-Skalierung) und überlebt Reload.
- [x] Deep-Link auf `/friends` oder `/sync` in Simple Mode landet auf `/`.
- [x] Bestandsnutzer mit Profil ohne `appMode` sieht beim Update einmalig
  Mode-Choice ohne Namens-Schritt; alle bestehenden Daten bleiben.
- [x] Einfach-Modus funktioniert in allen vier Themes ohne Layout-Bruch.
- [x] Theme-Karten in Simple Mode rendern einspaltig (kein Overflow durch
  größere Schrift).
- [x] Audio-Aufnahme funktioniert in Simple Mode unverändert; Foto/Video-
  Buttons sind dort nicht sichtbar.

---

## 9. Tests

### 9.1 E2E (`e2e/onboarding.spec.ts`)

| Test | Abgedeckte Aspekte |
|------|--------------------|
| `first-time visitor sees mode-choice before name entry` | Mode-Choice ist Step 1; beide Karten sichtbar |
| `picking "Vollständig" continues to the name step and shows all 5 tabs` | Full-Mode-Pfad; 5 Tabs nach Onboarding |
| `picking "Einfach" continues to name and reduces UI to 3 tabs + no custom card` | 3 Tabs; Custom-Card weg; `data-app-mode="simple"` auf `<html>` |
| `Simple Mode is switchable from profile and survives reload` | Profil-Toggle wechselt Modus; Reload erhält ihn |

Zusätzlich: Pre-Seed in allen anderen E2E-Specs (`appMode: 'full'`) damit
Bestands-Specs nicht in der Mode-Choice-Gate stecken bleiben.

### 9.2 Unit / Component

- `OnboardingView`-Test: Klick auf `onboarding-mode-simple` ruft
  `onChooseMode('simple')` und wechselt zu `step='name'`. `modeOnly=true`
  überspringt den Namens-Schritt.
- `ProfileView`-Test: Klick auf `profile-mode-full` ruft `setAppMode('full')`;
  Klick auf `profile-mode-simple` ruft `setAppMode('simple')`. Aktive Karte
  hat `aria-pressed="true"`.
- `BottomNav`-Test: in Simple Mode rendert genau 3 Tabs (home, archive,
  profile); in Full Mode 5.

---

## 10. Abhängigkeiten

| Abhängigkeit | Grund |
|--------------|-------|
| REQ-001 (PWA Foundation) | Basis-Routing, AppState-Persistenz |
| REQ-002 (Frage-Engine) | Lebensweg-Tab bleibt voll funktional |
| REQ-003 (Story Storage) | `appMode` als optionales Feld im AppState |
| REQ-009 (Audio-Aufnahme) | Audio bleibt im Einfach-Modus aktiv |
| REQ-017 (Privater Sync) | `appMode` wandert mit dem verschlüsselten AppState mit |

---

## 11. Änderungshistorie

| Version | Datum | Autor | Änderung |
|---------|-------|-------|---------|
| 1.0.0 | 2026-05-10 | Claude | Initiale Dokumentation (Reverse Engineering der Implementierung in v2.4.0, PRs #116 und #117) |

# Changelog – Storyhold

Alle veröffentlichten Versionen des Projekts, absteigend sortiert.

Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).
Versionierung folgt [Semantic Versioning](https://semver.org/lang/de/).

> **Pflicht für jeden Feature- oder Pack-PR:** Eintrag hier **und** in
> `src/data/releaseNotes.ts` ergänzen, `package.json#version` hochzählen.
> Der Check `npm run check:changelog` (Teil von `npm test`) bricht sonst ab.
> Details: `CLAUDE.md` → „Changelog-Pflicht".

## [2.11.0] – 2026-05-18

### Geändert

- **Einladungslink: dauerhafter Verbindungsaufbau statt Einmal-Link** – Der
  Einladungs-Flow (`#/ask`) sendet jetzt einen kombinierten Link mit Fragenpaket
  (`?qp=`) **und** dem eigenen ContactHandshake (`?contact=`). Wenn Mama den
  Link öffnet, beantwortet sie die Fragen (als Trigger) und wird gleichzeitig
  dauerhaft verbunden – der Einladende sieht neue Erinnerungen laufend, kein
  zweiter Schritt notwendig. Voraussetzung: Supabase-Build (Familienmodus).
- **Privacy-Versprechen neu formuliert** – Badges auf der Landing-Seite des
  Einladungs-Flows zeigen jetzt „Privat", „Verschlüsselt", „Nur für euch beide"
  statt der alten „Keine Anmeldung / Keine Cloud"-Formulierung, die zur
  tatsächlichen Supabase-Architektur im Widerspruch stand.
- **Freunde-Tab klarere Struktur** – Primärer CTA ist jetzt „Einladung
  erstellen". Der bisherige Familienmodus-CTA „Einrichten" wurde zu „Geteilte
  Erinnerungen öffnen" umbenannt und ist nur noch sichtbar, wenn Supabase
  konfiguriert ist.

---

## [2.10.0] – 2026-05-15

### Hinzugefügt

- **PostHog Analytics (EU Cloud, cookie-less)** – die App trackt jetzt
  ausgewählte Feature-Nutzung über PostHog EU (Frankfurt). Keine Cookies,
  kein Fingerprinting, kein Autocapture – nur explizit gesetzte Events:
  Quiz-Flows (`quiz_started`, `quiz_completed`, `quiz_abandoned`,
  `quiz_media_added`), Onboarding (`onboarding_completed`),
  Tab-Wechsel (`tab_changed`), Feature-Öffner (`feature_opened`) und
  Session-Start (`session_started`). Analytics ist vollständig deaktiviert,
  wenn `VITE_POSTHOG_KEY` nicht gesetzt ist (Local Dev bleibt clean).
  CSP um `https://eu.i.posthog.com` erweitert.

---

## [2.9.0] – 2026-05-14

### Hinzugefügt

- **Trust-Badges für Transparenz und Herkunft** – auf der Impressum-Seite zeigen
  zwei dezente Pills im Friends-Tab-Stil („🔓 Open Source · AGPL-3.0" und
  „🇩🇪 Made in Germany"), dass der Storyhold-App-Code öffentlich einsehbar ist
  und der Anbieter in Deutschland ansässig ist. Beide Pills nutzen
  `.friends-tag--accent` und respektieren alle vier Themes (sepia/nacht/hell/
  ozean). Lokalisiert in DE und EN.
- **README-Badges**: zusätzlich zur bestehenden AGPL-Badge taucht die
  Made-in-Germany-Badge (shields.io, Schwarz-Rot-Gold) jetzt prominent oben in
  `README.md` auf — sichtbar für GitHub-Besucher, Beiträger und Auditoren.

---

## [2.8.0] – 2026-05-14

### Hinzugefügt

- **Leichtgewichtiges In-App-Feedback (REQ-021)** – ein neuer Eintrag im Profil
  („Wie gefällt dir die App? 💬") öffnet ein Modal mit fünf Smileys (😞 😐 🙂
  😊 🤩). Ein Tap auf ein Gesicht genügt für ein vollständiges Feedback; ein
  optionales Textfeld erscheint erst danach. Nach dem Senden zeigt der Eintrag
  60 Tage lang „Danke für dein Feedback 💛".
- **Anonyme Datenhaltung von Anfang an**: Die neue Supabase-Tabelle
  `feedback_submissions` speichert nur `rating`, `comment` und `created_at` —
  keine Geräte-ID, keine App-Version, keine Locale, kein App-Mode. Anon-Insert
  über RLS-Policy mit Längen- und Wertebereichs-Check; Lese-Zugriff
  ausschließlich über den Service-Role-Key.
- **Senioren-Modus berücksichtigt**: Im Vereinfachten Bedienmodus wachsen die
  Smiley-Buttons auf 72 × 72 px (statt 56 × 56 px im Full-Mode). Wording ist
  bewusst alltagssprachlich gehalten („Dein Name wird nirgends gespeichert"
  statt „anonym"), nach Persona-Review mit Ingrid-Novice / -Routine und
  Familien- und Käufer-Persona-Review.

---

## [2.7.0] – 2026-05-12

### Hinzugefügt

- **Persönliche Fragen formulieren und an Verwandte schicken** – die neue
  Einstiegs-Route `#/ask` führt durch sechs Schritte
  (Landing → Beziehungs-Anker → Trigger-Wahl → Composer → Fragen-Sammlung →
  Versand), damit der tech-affinere Käufer eigene Fragen in eigenen Worten
  formulieren und per Web Share API als Link an Mama/Papa/Oma schicken kann.
  Der Pack-Code reist im URL-Hash (`?qp=…`), wird niemals als Text gezeigt
  und ist abwärtskompatibel zum bestehenden Question-Pack-Schema (optionale
  Felder `personalPack`, `senderName`, `recipientLabel`, `anrede`).
- **Trigger-Gruppe „Über uns zwei"** für Beziehungsfragen, visuell durch
  `--accent-tinted`-Background und ❤-Marker im Sektion-Titel hervorgehoben.
  10 Trigger insgesamt (6 Biografie + 4 Beziehung) mit 3–4 Template-Varianten
  pro Trigger und seed-getriebener Substitution für `{anrede}` und `{seed}`.
- **Inspirations-Schublade** mit kuratierten, anonymisierten Beispielen pro
  Trigger – Klick übernimmt den Text als Stichwort in den Composer.
- **Ingrid-Empfang**: bei Eingang eines `personalPack`-Packs zeigt die App
  einen sanften Header („{senderName} hat dir {n} Fragen geschickt"),
  schlägt einmalig den Vereinfachten Bedienmodus vor und führt durch die
  Fragen One-Question-at-a-Time mit großem Mikrofon-Button und Punkt-
  Progress (statt Liste oder Prozentanzeige).
- **Trigger-Bank und UI in Deutsch und Englisch** – Sprache folgt der App-
  Locale, keine Einstellung nötig.
- Eintrag im Freunde-Tab: neue Karte „Eigene Fragen für jemanden formulieren"
  führt direkt in den Flow.

> Bekannte Lücke / Geplant: Empfänger ohne eigenes Smartphone – stellvertretende
> Audio-Aufnahme über ein anderes Gerät. Backlog in
> [REQ-020](./requirements/REQ-020-sandra-flow.md) §Future Work.

---

## [2.6.0] – 2026-05-11

### Hinzugefügt

- **Sync-Setup: Wartebildschirm für E-Mail-Bestätigung.** Wenn beim Storyhold-
  Server-Sync ein neues Konto angelegt wird und Supabase erst auf den Klick im
  Verifikationslink wartet, springt der Wizard nicht mehr stumm zum Recovery-
  Code, sondern zeigt einen eigenen Schritt: Hinweistext mit der eigenen
  E-Mail-Adresse, „Bestätigungs-Mail erneut senden"-Button (`supabase.auth.
  resend`) und eine Notiz, wenn das Senden geklappt hat oder fehlschlug. Sobald
  der User den Link klickt und die SDK ein `SIGNED_IN`-Event feuert, geht es
  automatisch weiter (Recovery-Code-Generierung beim Neuanlegen, Entschlüsselung
  beim Wiederanmelden auf einem neuen Gerät). Auch ein Login-Versuch mit
  unbestätigter E-Mail (Supabase-Fehlercode `email_not_confirmed`) landet jetzt
  auf demselben Wartebildschirm statt auf einer kryptischen Fehlermeldung.

---

## [2.5.0] – 2026-05-10

### Hinzugefügt

- **Impressum-Seite** – neue rechtskonforme Anbieterkennzeichnung gemäß § 5 DDG
  und § 18 Abs. 2 MStV. Im Profil unter „Hilfe & FAQ" erreichbar, mit
  Anbieter-Anschrift, Kontakt-E-Mail, Verantwortlichem nach Medienstaatsvertrag,
  Hinweis auf die EU-OS-Streitbeilegungsplattform sowie den üblichen Haftungs-
  und Urheberrechts-Klauseln. Styling folgt dem Friends-Tab (Sektionen, Hint-
  Texte, Theme-Variablen) und unterstützt alle vier Themes sowie Deutsch und
  Englisch.

---

## [2.4.0] – 2026-05-09

### Hinzugefügt

- **Vereinfachter Bedienmodus** – ein neuer „Einfach"-Modus reduziert die App
  auf Lebensweg, Vermächtnis und Profil, blendet Power-Features (Familienmodus,
  Sync, eigene Fragen, Foto/Video-Anhänge, Export, Release-Notes) aus und
  vergrößert Schrift und Buttons. Beim allerersten Start fragt das Onboarding
  vor der Namens-Eingabe „Wie möchten Sie die App nutzen?" – Bestandsnutzer
  werden beim nächsten Öffnen einmalig nachgezogen. Im Profil unter
  „Bedienung" lässt sich jederzeit auf den vollständigen Modus zurückwechseln.
  Sprachaufnahmen bleiben im Einfach-Modus verfügbar, weil ältere Nutzer
  ungern viel tippen.

---

## [2.3.0] – 2026-05-09

### Hinzugefügt

- **Sync-Login: Option „Schlüssel verloren?"** – ermöglicht einen Neustart
  mit frischem Sicherheitsschlüssel; lokale Daten bleiben erhalten,
  alte Cloud-Daten werden beim ersten Push überschrieben. Unter dem
  Entschlüsseln-Button im `enter-code`-Schritt erscheint ein dezenter Link,
  der ein Erklär-Modal öffnet. Bestätigung erzeugt einen neuen
  Recovery-Code und springt zurück in den `recovery-code`-Schritt.

---

## [2.1.1] – 2026-05-08

### Behoben

- **Google-Drive-Sync: „Jetzt synchronisieren" reagiert auf abgelaufene Token.**
  Wenn der Google-Access-Token abgelaufen war, blieb der Hub im Status
  „Sync-Fehler" („Kein gültiger Google-Token – bitte erneut anmelden") hängen
  und der Sync-Knopf hatte keinerlei Effekt – nur ein Deaktivieren mit
  anschließendem Setup-Wizard half. Jetzt erscheint bei Auth-Fehlern ein
  zusätzlicher „Erneut anmelden"-Button im Status-Block, der die Google-OAuth-
  Wiederanmeldung direkt aus der Hub-Ansicht startet. Nach Rückkehr aus dem
  Redirect übernimmt der Hub den frischen Token automatisch und stößt einen
  Sync an.
- **Kein sinnloses Auto-Retrying bei Auth-Fehlern.** Bisher lief die 30-s-
  Wiederholungsschleife auch dann drei Mal durch, wenn der Token nicht mehr
  gültig war (es schlug jedes Mal mit derselben Meldung fehl). Auth-Fehler
  brechen den Auto-Retry jetzt sauber ab und warten auf eine User-Aktion.

---

## [2.1.0] – 2026-05-08

### Geändert

- **Sync-Tab Redesign:** Der Hub-Screen („Privater Sync") übernimmt das visuelle
  Vokabular des Freunde-Tabs: Inhalte sind jetzt in drei klar abgegrenzte
  Sektionen („Status", „Speicherort", „Sync deaktivieren") mit
  border-bottom-Titeln aufgeteilt, der Sync-Status erscheint als Tag-Chip
  neben einem „Verschlüsselt"-Tag, und „Jetzt synchronisieren" ist auf den
  prominenten Gradient-CTA-Button (`share-cta-btn`, Logo-Farbverlauf) im
  Familienmodus-Stil umgestellt.
- **Speicherort-Karten:** Provider, Inhalte und letzter Sync werden in
  saubere Label/Wert-Kartenrows gerendert (`.sync-info`), damit Beschriftung
  und Wert nicht mehr ineinanderlaufen wie zuvor („Synchronisiert
  Gespeichert beideiner Google Drive").
- **„Sync deaktivieren" mit Erklärung:** Eine neue Sektion erläutert, dass
  der Klick zwischen „nur Verbindung trennen" und „Cloud-Datei zusätzlich
  löschen" wählen lässt – das Bestätigungsmodal selbst hat dafür schon
  drei Optionen, jetzt versteht man auch vorher, worum es geht.

### Behoben

- **Sync-Hub Stylesheet-Lücken:** Mehrere referenzierte Klassen
  (`private-sync-hub__info-row`, `modal-overlay`, `modal-box`, `sync-badge`,
  `btn--danger`, `btn--secondary`) hatten keine CSS-Definitionen und führten
  dazu, dass Status-Badge, Info-Zeilen und das Bestätigungsmodal als
  unformatierter Fließtext angezeigt wurden. Alle fehlenden Styles sind
  ergänzt.

---

## [2.0.3] – 2026-05-08

### Behoben

- **Google-Drive-Sync: `Drive-Upload fehlgeschlagen: 404` nach erneutem Login.**
  Nach „Sync deaktivieren" und Wieder-Anmelden zeigte der gecachte File-ID
  in IndexedDB auf eine Drive-Datei, die nicht mehr existierte (entweder weil
  der frühere `deactivate(deleteRemote=true)`-Pfad sie entfernt hatte, oder
  weil der Nutzer sie manuell aus Drive gelöscht/getrasht hatte). Der nächste
  Push schickte ein PATCH auf die tote ID → 404 → Sync-Fehler.
- `GoogleDriveProvider.deactivate` löscht jetzt die gecachte File-ID mit, nicht
  nur den OAuth-Token.
- `findSyncFile` filtert die Drive-Suche zusätzlich auf `trashed=false`, damit
  ein im Papierkorb liegender Treffer nicht erneut als gültige Sync-Datei
  zurückkommt.
- **Selbstheilung im Push:** Antwortet Drive auf den PATCH mit `404`, verwirft
  der Provider den lokalen Cache und legt direkt im selben Sync-Lauf eine
  frische Envelope-Datei an. Der Nutzer sieht keinen Fehler mehr.

### Tests

- Unit-Tests für die 404-Selbstheilung, den `trashed=false`-Filter, das
  Aufräumen der File-ID in `deactivate` und die Weitergabe nicht-stale
  PATCH-Fehler (z. B. 500).

---

## [2.0.2] – 2026-05-07

### Behoben

- **Google-Drive-Login**: Nach dem OAuth-Redirect zurück in die App stand der
  Nutzer wieder vor dem Login-Screen mit der Meldung
  „Google-Authentifizierung fehlgeschlagen". Ursache war ein Race zwischen
  dem Anbinden des `onAuthStateChange`-Listeners und Supabase's
  `detectSessionInUrl`, der das `provider_token` aus dem URL-Hash bereits
  konsumiert hatte.
- `GoogleDriveProvider.resumeFromOAuth` liest das `provider_token` jetzt
  zuerst direkt aus `window.location.hash`, bevor irgendein anderer Code
  den Hash anfassen kann. Auf Fallback-`onAuthStateChange` wird nur
  zurückgegriffen, wenn der Hash bereits geleert ist.
- Listener-Timeout von 8 s auf 20 s angehoben, damit langsame
  Mobilverbindungen (insbesondere iOS Safari mit kaltem Service-Worker)
  nicht in einen falschen Misserfolg laufen.
- Optionales Logging via `localStorage.rm-debug-oauth = '1'` zur
  Diagnose künftiger Auth-Probleme.

### Tests

- Unit-Tests für `parseProviderTokenFromHash` und alle Pfade von
  `resumeFromOAuth` (Hash-Primär, Listener-Fallback, Timeout).
- E2E-Regressionstest, der das vollständige Redirect-Roundtrip simuliert
  und sicherstellt, dass der Recovery-Code-Schritt erscheint.

---

## [2.0.1] – 2026-05-03

### Sicherheit

#### Drive-/OneDrive-Sync E2E-verschlüsselt

- **Breaking für Sync-Setup:** Google Drive und OneDrive verschlüsseln jetzt
  den AppState mit AES-256-GCM und Recovery-Code-abgeleitetem Key (PBKDF2,
  200k Iterationen, SHA-256). Bisher lagen Profil, Antworten und Freundesliste
  im Klartext in der Drive-Datei.
- Recovery-Code-Flow gilt jetzt für alle drei Provider (Drive, OneDrive,
  Storyhold Server).
- Sync-Datei-Format auf v2 angehoben; alte v1-Dateien führen zu einem klaren
  „bitte Setup neu durchlaufen"-Hinweis statt stillem Klartext-Read.

#### Content-Security-Policy + Google Identity Services

- `connect-src` erweitert um `googleapis.com`, `graph.microsoft.com`,
  `login.microsoftonline.com` und `accounts.google.com/gsi/` – ohne diese
  Einträge wurden alle Drive-Requests in Production geblockt.
- Google-Identity-SDK (`gsi/client`) wird jetzt on-demand bei Drive-Login
  geladen und ist in `script-src` zugelassen.

#### Härtungen

- `decodeQuestionPack`: pro Frage strikte Längen- und Enum-Validierung
  (max. 200 Fragen, 2 000 Zeichen Text, nur Typen `text`/`choice`/`scale`).
- `generateRecoveryCode`: Modulo-Bias durch Reject-Sampling entfernt.
- `npm audit`: postcss-XSS (GHSA-qx2v-qp2m-jg93) durch Update behoben.

### Versionshinweis

Wer schon mit 2.0.0 ein Drive-/OneDrive-Sync eingerichtet hat, muss das Setup
einmal neu durchlaufen, damit die Daten in das verschlüsselte Format migriert
werden.

---

## [2.0.0] – 2026-05-02

### Hinzugefügt

#### Privater Sync – deine Erinnerungen, deine Cloud

- Neues **Sync-Tab** in der Navigation (ersetzt den alten Features-Tab)
- Drei gleichwertige Sync-Provider wählbar:
  - **Google Drive** – Texte + Bilder, Audio und Videos in der eigenen Google Drive
  - **Microsoft OneDrive** – Texte + Bilder, Audio und Videos im eigenen OneDrive App-Ordner
  - **Storyhold Server** – nur Texte, Ende-zu-Ende-verschlüsselt (AES-256-GCM), zero-knowledge
- Automatischer Push 5 Sekunden nach jeder Änderung (debounced)
- Automatischer Pull bei App-Start und bei Tab-Wechsel (visibilitychange)
- Manueller Sync-Button mit Statusanzeige (idle / syncing / error / success)
- Konfliktauflösung via Last-Write-Wins auf Antwort-Ebene
- Recovery Code (24-Zeichen Base62) für die Serverspeicher-Option
- Klare Warnung: ohne Recovery Code sind Daten nicht wiederherstellbar
- Sync-Hub zeigt wohin und was gespeichert wird + letzten Sync-Zeitpunkt
- Deaktivierung mit optionalem Remote-Lösch-Dialog

#### Navigation & Profil

- „Geplante Features" ist jetzt als zusammenklappbare Sektion im Profil-Tab

---

## [1.9.3] – 2026-05-01

### Geändert

#### Familienmodus: Swipe-to-Delete ohne Zwischenschritt

- Kontakteintrag vollständig nach links wischen löscht den Kontakt sofort (kein separater „Entfernen"-Button mehr)
- Element fliegt mit Fade-out-Animation nach links raus, bevor es aus der Liste verschwindet
- Kurzes Wischen (< 80 px) bricht ohne Aktion ab – kein versehentliches Löschen

---

## [1.9.2] – 2026-04-29

### Hinzugefügt

#### Familienmodus: Kontakte per Swipe entfernen

- Kontakteintrag im Hub-Tab „Einladen" nach links wischen enthüllt roten „Entfernen"-Button
- Klick entfernt den Kontakt sofort lokal (localStorage); kein Reload nötig
- Kurzes Wischen (< 60 px) oder erneuter Klick auf die Zeile setzt sie zurück – kein versehentliches Löschen
- Spec (REQ-015) um FR-15.29–15.32 erweitert; neuer E2E-Test `family-mode-swipe-remove.spec.ts`

---

## [1.9.1] – 2026-04-29

### Behoben

#### Release-Notes-Modal: iOS-Ambient-Layout & Navigation

- Topbar berücksichtigt jetzt `env(safe-area-inset-top)`, damit der „Was ist neu?"-Titel im iOS-Standalone-Modus nicht mehr von der Statusleiste (Uhrzeit, Empfang, Akku) überdeckt wird.
- Schließen-Button auf den App-weiten „← Zurück"-Button (gleiche `btn btn--ghost btn--sm`-Optik wie FAQ/Profil) umgestellt – konsistente Navigation, klarer Affordance.
- E2E-Test für das Schließen des Modals an die neue Markup-Struktur angepasst.

---

## [1.9.0] – 2026-04-28

### Hinzugefügt

#### Engagement-Benachrichtigungen (REQ-016)

Damit Nutzer regelmäßig zurückkommen und ihre Geschichte weiter erzählen, gibt es jetzt ein vollständiges Reminder-System.

**PWA Push-Benachrichtigungen:**
- `ReminderBanner` fragt einmalig die Notification-Permission ab (kein Auto-Prompt beim ersten Start)
- `useReminder`-Hook plant Erinnerungen mit Backoff, Cadence-Limit und Quiet Hours (Nacht-Sperre)
- Variantenpool aus `src/data/reminderMessages.ts` (≥ 8 Texte pro Sprache, Rotation verhindert Wiederholung)

**Welcome-Back-Banner (iOS-Fallback):**
- `WelcomeBackBanner` erscheint, wenn der Nutzer ≥ 3 Tage pausiert hat – ersetzt Push-Benachrichtigungen auf iOS, wo die Web-Push-API nicht verfügbar ist
- Schließt sich nach Interaktion und merkt sich den letzten Besuch

**Streak-Tracking & Milestones:**
- `useStreak`-Hook zählt aufeinanderfolgende Antwort-Tage und löst Milestone-Notifications aus (3, 7, 14, 30 Tage)
- Streak-Feld in `AppState`, persistiert über `useAnswers`

**Lokalisierung:**
- Neuer Übersetzungsblock `t.reminder.{title,desc,allow,dismiss,welcomeBack,milestone}` in DE/EN

**Spezifikation & Tests:**
- Neues Requirement `REQ-016` (PWA Notifications) angelegt
- 515 Vitest grün, Playwright-Matrix grün auf allen 5 Browser-Projekten

---

## [1.8.0] – 2026-04-25

### Hinzugefügt

#### Familienmodus – Online-Teilen mit Ende-zu-Ende-Verschlüsselung (REQ-015)

Strikt opt-in: Ohne aktive Aktivierung gibt es keinen Request zu Supabase, keinen Import von `@supabase/supabase-js` im Main-Chunk und keinen neuen Schlüssel auf dem Gerät.

**Krypto-Architektur:**
- ECDH P-256 Device-Keypair, non-extractable in IndexedDB (`rm-device-key`)
- AES-256-GCM pro Erinnerung, Content-Key per-Recipient via ECDH+HKDF gewrappt
- Supabase als Zero-Knowledge-Server (nur Ciphertext + opake UUIDs, anonymous auth, keine PII)
- RLS erzwingt ACLs auf `shares`, `share_recipients`, `annotations`, `share_media`

**Neue Views & Komponenten:**
- `OnlineSharingIntroView` – Consent-Screen mit Datenschutz-Tabelle und Familienmodus-Hero-Banner
- `OnlineSharingHubView` – 4-Tab-Hub: Feed · Teilen · Kontakte · Einstellungen, plus Onboarding-Screen für leere Kontaktliste
- `ContactHandshakeView` – `#contact/`-URL-Handshake für beidseitige Verknüpfung
- `SharedMemoryView` + `SharedMemoryCard` – Empfänger-Ansicht für eingegangene Erinnerungen
- Familienmodus-Card in `FriendsView` (sichtbar erst, wenn Backend konfiguriert ist)

**WhatsApp-Optimierungen (#62, #63):**
- Canvas-generierte 1080×1080 Share-Karte (`src/utils/shareCard.ts`) für alle Share-Stellen
- WhatsApp-kompatible Links (Base64url, kein `+`/`/`); Web Share API mit Datei-Anhang
- `useContactShare`-Hook gegen Code-Duplikat in den Share-Pfaden

**Vollständige i18n (DE/EN) für Familienmodus (#69, #70):**
- Neue Sektionen: `onlineSharingIntro`, `contactHandshake`, `onlineSharingHub`, `friends.familienmodus*`
- Auch Medien-, SEO- und Logo-Komponenten und alle restlichen hardcodierten Strings sind jetzt übersetzbar

**Offline-Garantie:**
- `src/utils/optin.test.ts` – statischer Check, dass kein Sharing-Modul außerhalb des Lazy-Imports landet
- Offline-Nutzer laden den 207 KB Supabase-Chunk nie

**Spezifikation:**
- Requirement `REQ-015` (Familienmodus) angelegt, `REQ-008` korrigiert
- E2E-Suite `e2e/familienmodus.spec.ts` (Aktivierung, Handshake, Teilen, Deaktivierung) mit `CompressionStream`-Polyfill für WebKit

---

## [1.7.0] – 2026-04-20

### Hinzugefügt

#### Internationalisierung – English-Support mit Auto-Detect

Storyhold ist jetzt zweisprachig (DE/EN), Sprache wird automatisch erkannt.

**Lokalisierungs-Framework:**
- `src/locales/{de,en}/{ui,categories,faq,features,friendTopics}.ts` – komplette deutsche und englische Übersetzungen
- `src/locales/types.ts` – typisiertes `Translations`-Interface, TypeScript bricht beim Hinzufügen neuer Strings, wenn eine Sprache fehlt
- `src/locales/index.ts` – `useTranslation()`-Hook, reaktiv auf Locale-Änderungen

**Auto-Detect (`detectLocale.ts`):**
- Reihenfolge: `localStorage` → `navigator.languages` → Zeitzone → Fallback `'en'`
- `GERMAN_TIMEZONES`-Set (DE/AT/CH/LI) gewinnt gegen unpassende Browser-Locale
- 27 Unit-Tests + E2E-Tests für manuelles Wechseln und Auto-Detection

**Sprachwahl im Profil:**
- `lang-cards`-Block in `ProfileView` (gleicher Stil wie die Theme-Cards)
- Persistierung in `localStorage` (`rm-locale`)

**Komponenten umgestellt:**
- `BottomNav`, `QuestionCard`, `UpdateBanner`, `InstallBanner`, `ReminderBanner`, `ArchiveExportCard` u. a. nutzen `t.*` statt hardcodierter Strings

**CI:**
- `playwright.config.ts` defaultet auf `de-DE` / `Europe/Berlin`, damit bestehende deutsche Specs grün bleiben

---

## [1.6.0] – 2026-04-20

### Hinzugefügt

#### Release Notes / „Was ist neu?" – in-App Versionshistorie

Nutzer können ab sofort direkt in der App einsehen, was sich in der jeweils neuen Version geändert hat.

**Update-Banner (`UpdateBanner`):**
- Neuer optionaler Button **„Was ist neu?"** neben dem Reload-Button
- Öffnet das Release-Notes-Modal, ohne den Reload zu erzwingen
- Prop `onViewNotes?: () => void` – rückwärtskompatibel (Banner funktioniert weiterhin ohne den Button)

**Release-Notes-Modal (`ReleaseNotesModal`):**
- Vollbild-Overlay (kein eigener Route-Eintrag)
- Zeigt alle Versionen von aktuell (1.6.0) bis v1.0.0
- Aktuelle Version ist farblich hervorgehoben
- Schließen über ✕-Button
- Barrierefrei: `role="dialog"`, `aria-modal`, `aria-label`

**Profil-View (`ProfileView`):**
- Neuer Einstiegspunkt „Was ist neu?" als Karte im Profil-Bereich (neben FAQ)
- Damit dauerhaft zugänglich, unabhängig vom Update-Banner

**Datenschicht:**
- `src/data/releaseNotes.ts` – typisiertes Array `ReleaseNote[]` mit nutzerfreundlichen Kurzfassungen (Emoji + Bulletpoints) für alle Versionen

**Lokalisierung:**
- Neuer Translations-Block `releaseNotes` in `de/ui.ts` und `en/ui.ts`
- Schlüssel: `title`, `close`, `viewNotes`, `versionPrefix`

**Spezifikation & Tests:**
- Neues Requirement `REQ-014` (Release Notes / „Was ist neu?") angelegt
- Neue E2E-Testdatei `e2e/release-notes.spec.ts` (4 Tests: Button sichtbar, Modal öffnet, Versionsinfo vorhanden, Schließen funktioniert)

---

## [1.5.9] – 2026-04-16

### Hinzugefügt

#### Freunde-Einladung: Share-Link-Flow

Der manuelle Antwort-Code-Export wurde durch einen vollautomatischen Share-Link-Flow ersetzt.

**Freund beantwortet Fragen (`FriendAnswerView`):**
- Share-Button auf dem Fertig-Screen verschickt den Antwort-Link direkt via Web Share API (Safari-kompatibel: synchroner Aufruf, kein `await` vor `navigator.share()`)
- Komprimierter `#ma/`-Link wird asynchron erzeugt und per `useRef` für den synchronen Share-Handler bereitgestellt; synchroner `#ma-plain/`-Fallback verhindert deaktivierten Button
- Base64url-Encoding (RFC 4648) verhindert Link-Korruption durch WhatsApp / iMessage
- Fallback auf Clipboard-Copy wenn Web Share API nicht verfügbar

**Einladender importiert Antworten (`FriendsView`):**
- Antworten werden beim App-Start automatisch importiert, wenn die URL einen `#ma/`- oder `#ma-plain/`-Hash enthält (kein manueller Import mehr nötig)
- Manuelle Import-Textbox und zugehörige Sektion vollständig entfernt

**Aufgeräumt:**
- `onImportAnswers`-Prop aus `FriendsView` entfernt (Import läuft direkt in `App.tsx`)
- Base64-Code-Fallback-Sektion (`<details class="export-fallback">`) aus Fertig-Screen entfernt
- Sichtbare Link-Box mit Kopier-Button entfernt

**Share-Texte:**
- Einladender: *„Ich erstelle gerade mein persönliches Lebensarchiv …"*
- Beantworter: *„Hey {Name}! Ich habe gerade ein paar Fragen über dich beantwortet …"*

**CTA auf Fertig-Screen:**
- Promo-Bild (`/friend-invite-promo.jpeg`) verlinkt auf [rememberme.dad](https://rememberme.dad)
- Datenschutzhinweis: „deine Daten bleiben komplett privat"

**Tests:**
- Neue Testdatei `src/views/FriendAnswerView.test.tsx` (8 Tests): URL-Korrektheit, verlinktes Bild, Datenschutztext, `target="_blank"`, Welcome-Screen-Verhalten
- `FriendsView.test.tsx` angepasst: `onImportAnswers`-Prop entfernt, Textprüfung aktualisiert

---

## [1.5.8] – 2026-04-12

### Hinzugefügt

#### PWA Update-Benachrichtigung

Wenn im Hintergrund eine neue Version der App als Service Worker bereit steht, erscheint ein Banner am unteren Bildschirmrand:

- **„Update verfügbar – Neue Version bereit zum Laden"**
- Button **„Neu laden"** aktiviert `skipWaiting` und lädt die Seite neu (update wird sofort angewendet)
- **×**-Button schließt das Banner ohne Update (kein erneutes Erscheinen bis zum nächsten Seitenaufruf)
- Banner erscheint auf allen Ansichten (Home, Archiv, Profil, Quiz …)

**Technische Details:**
- `vite.config.ts`: `registerType: 'prompt'` (war `'autoUpdate'`) – SW wartet auf Nutzerbestätigung
- `src/hooks/useServiceWorker.ts` – Wraps `useRegisterSW` aus `virtual:pwa-register/react`; stellt `needRefresh`, `applyUpdate()`, `dismiss()` bereit
- `src/components/UpdateBanner.tsx` – Toast-Banner, `role="alert"`, `aria-live="polite"`
- `src/App.tsx` – Hook aufgerufen, Banner in allen Render-Pfaden bedingt gerendert (`needRefresh && <UpdateBanner …>`)

---

## [1.5.7] – 2026-04-12

### Behoben

#### Freundes-Fragen im Archiv zeigten ID-Platzhalter statt Fragentext

**Ursache:** `ArchiveView` löste den Fragentext über `FRIEND_QUESTIONS.find(id)` auf. Gespeicherte Antworten mit veralteten Fragen-IDs (vor dem FRIEND_TOPICS-Umbau) wurden nicht gefunden; als Fallback erschien die rohe ID (z. B. `friend-f1`).

**Fix – dreistellige Auflösung (Reihenfolge):**
1. `a.questionText` – direkt im `FriendAnswer`-Objekt gespeicherter, bereits aufgelöster Text (neu)
2. `FRIEND_QUESTIONS`-Lookup + `{name}`-Substitution (bisherige Lösung, Fallback für vorhandene Daten)
3. `"Frage nicht mehr verfügbar"` – lesbarer Platzhalter statt roher ID

**Datenmodell-Erweiterungen (backward-compatible, alle Felder optional):**
- `FriendAnswer.questionText?: string` – aufgelöster Fragetext wird beim Import dauerhaft gespeichert
- `AnswerExport.answers[].questionText?: string` – wird in `FriendAnswerView.finish()` befüllt
- `importFriendAnswers()` überträgt `questionText` in die gespeicherte `FriendAnswer`
- `resolveQuestion()` in `utils/export.ts` nimmt `storedText`-Parameter; nutzt ihn für Markdown- und JSON-Export

---

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
  - `<meta name="apple-mobile-web-app-title" content="Storyhold">` – Label unter dem App-Icon
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
| **1.5.4** | Profil-Seite UX-Redesign + App-weite Typografie | ✔️ Fertig |
| **1.5.5** | Bottom-Tab-Navigation (5 Tabs, iOS/Android-Stil) | ✔️ Fertig |
| **1.5.6** | Export & Backup-Funktion in der Profilansicht | ✔️ Fertig |
| **1.5.7** | Fix: Freundes-Fragen im Archiv (ID-Platzhalter → Fragentext) | ✔️ Fertig |
| **1.5.8** | PWA Update-Benachrichtigung (Service Worker Prompt) | ✔️ Fertig |
| **1.5.9** | Freunde-Einladung: Share-Link-Flow (Web Share API) | ✔️ Fertig |
| **1.6.0** | Release Notes / „Was ist neu?" (UpdateBanner + Profil) | ✔️ Fertig |
| **1.7.0** | i18n – English-Support mit Auto-Detect | ✔️ Fertig |
| **1.8.0** | Familienmodus – E2EE Online-Teilen + WhatsApp-Karte | ✔️ Fertig |
| **1.9.0** | Engagement-Benachrichtigungen (Push, Welcome-Back, Streaks) | ✔️ Fertig |
| **1.9.1** | Fix: Release-Notes-Modal iOS-Ambient-Layout + „Zurück"-Navigation | ✔️ Fertig |
| **1.9.2** | Familienmodus: Kontakte per Swipe-left entfernen | ✔️ Fertig |
| **1.9.3** | Familienmodus: Full-Swipe-to-Delete (kein Bestätigungs-Button mehr) | ✔️ Fertig |
| **2.0.0** | Privater Sync – Google Drive, OneDrive, Storyhold Server (REQ-017) | ✔️ Fertig |
| **2.0.1** | Sicherheits-Härtung: E2EE für Drive/OneDrive-Sync, CSP/GIS, Recovery-Code-Bias-Fix | ✔️ Fertig |
| **2.0.2** | Fix: Google-Drive-Login bricht nach OAuth-Redirect nicht mehr ab | ✔️ Fertig |
| **2.0.3** | Fix: Google-Drive-Sync 404 nach „Sync deaktivieren" – stale File-ID, Selbstheilung im Push | ✔️ Fertig |
| **2.1.0** | UX: Sync-Tab im Stil des Freunde-Tabs neu aufgesetzt – Sektionen, Tags, Gradient-CTA, Modal mit Erklärung | ✔️ Fertig |
| **2.1.1** | Fix: „Erneut anmelden"-Button im Sync-Hub bei abgelaufenem Google-Token + sauberer OAuth-Resume außerhalb des Setup-Wizards | ✔️ Fertig |
| **2.3.0** | Sync-Login: „Schlüssel verloren?"-Option mit Neustart per frischem Sicherheitsschlüssel (REQ-018) | ✔️ Fertig |
| **2.4.0** | Vereinfachter Bedienmodus für ältere Nutzer (Mode-Auswahl im Onboarding & Profil, große Buttons, reduzierte UI) | ✔️ Fertig |
| **2.5.0** | Impressum-Seite (§ 5 DDG, § 18 MStV) im Profil – Anbieter, Kontakt, Streitbeilegung, Haftung, Urheberrecht | ✔️ Fertig |
| **2.6.0** | Sync-Setup: Wartebildschirm für E-Mail-Bestätigung + Resend-Button, automatischer Sprung nach Verifikation | ✔️ Fertig |
| **2.7.0** | Persönliche Fragen formulieren, Trigger-Bank DE+EN, Inspirations-Schublade, One-Question-View-Empfang (REQ-020) | ✔️ Fertig |
| **2.8.0** | Leichtgewichtiges In-App-Feedback: 5-Smiley-Modal + optionaler Kommentar im Profil, anonyme Supabase-Tabelle (REQ-021) | ✔️ Fertig |
| **2.9.0** | Trust-Badges „Open Source · AGPL-3.0" und „Made in Germany" in der Impressum-Seite + README-Shields | ✔️ Fertig |
| — | **Geplante Features** | — |
| **TBD** | Lebenszeitlinie – chronologische visuelle Ansicht | Geplant |
| **TBD** | Import bestehender Erinnerungen (Social Media, Clouds) | Geplant |
| **TBD** | Automatische Lebensgeschichte – KI-generierte Biografie | Geplant |

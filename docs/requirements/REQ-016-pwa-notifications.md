# Anforderung: Engagement-Benachrichtigungen (Long-Term Retention)

**Status:** 🟡 PLANNED
**ID:** REQ-016
**Version:** 0.3.0
**Letzte Aktualisierung:** 2026-04-27
**Modul:** Engagement
**Priorität:** Medium

---

## 1. Zusammenfassung

Erinnerungs-Notifications, die Nutzer langfristig zur App zurückbringen, ohne zu nerven. Drei-Stufen-Strategie: (1) OS-Notification via `Notification.showTrigger` auf Chromium, (2) In-App-„Willkommen zurück"-Toast als iOS-Fallback, (3) Badge-API als visueller Stupser. Cadence ist systemfest (kein Nutzer-Selector), Variantenpool verhindert Wiederholung, Meilensteine feiern Fortschritt.

Diese Spec ersetzt den bestehenden rudimentären Reminder (`useReminder.ts`, fixes 2-Tage-Intervall, ein generischer Text). Da die App noch in Pre-Release-Phase ist, wird **keine Migration** des alten `rm-reminder-pref`-Keys vorgenommen — Bestandsnutzer aktivieren Notifications einmalig neu.

---

## 2. User Stories

> „Als Nutzer möchte ich nach ein paar Tagen sanft erinnert werden, ohne genervt zu sein."

> „Als langjähriger Nutzer möchte ich Meilensteine (10/25/50/100 Antworten) feiern."

> „Als iOS-Nutzer möchte ich auch ohne OS-Notifications angesprochen werden."

---

## 3. Drei-Stufen-Engagement-Strategie

| Stufe | Mechanismus | Trigger | Browser |
|-------|-------------|---------|---------|
| 1 | OS-Notification via `Notification.showTrigger` | Backoff: 3 → 10 → 24 Tage Inaktivität | Chromium Desktop/Android |
| 2 | In-App „Willkommen zurück"-Toast | App-Öffnung nach ≥3 Tagen Pause | Alle (iOS-Fallback) |
| 3 | Badge-API (`navigator.setAppBadge`) | Bei verfügbarer offener Aufgabe | Chromium + macOS Safari |

---

## 4. Funktionale Anforderungen

- **FR-16.1 Engagement-Cadence (system-determined):** Kein Nutzer-Selector. Festes Schema:
  - **Erster Reminder:** 72 h (3 Tage) nach letzter beantworteter Frage.
  - **Zweiter Reminder:** weitere 7 Tage später (Stage 2, kumuliert 10 Tage).
  - **Dritter Reminder:** weitere 14 Tage später (Stage 3, kumuliert 24 Tage).
  - **Danach:** Stille bis zur nächsten App-Öffnung oder Antwort.
  - Jede neue Antwort setzt die Sequenz auf Stage 1 zurück.
  - Settings-Toggle bietet ausschließlich **An / Aus**.

- **FR-16.2 Stille Stunden:** Zwischen 22:00 und 8:00 lokaler Zeit wird kein neuer OS-Trigger gesetzt. Fällt ein berechneter Trigger in dieses Fenster, wird er auf 8:00 lokal verschoben.

- **FR-16.3 Variantenpool:** Mindestens 8 Erinnerungs-Texte je Sprache (de + en) in `src/data/reminderMessages.ts`. Auswahl rotiert; kein Text wird zweimal hintereinander gezeigt (`lastVariantIdx` persistiert).

- **FR-16.4 Personalisierte Frage:** Wenn der Nutzer mindestens eine offene Kategorie / unbeantwortete Frage hat, enthält die Notification (Body) den Titel der nächsten unbeantworteten Frage statt eines generischen Textes.

- **FR-16.5 Tap-Routing:** Klick auf eine Notification öffnet die App und navigiert zur Frage, die in `notification.data.questionId` referenziert ist (Fallback: Home).

- **FR-16.6 Streak-Tracking:** `state.streak = { current: number; longest: number; lastAnswerDate: string }` wird in `localStorage` (`remember-me-state`) als optionales Feld gepflegt; Anzeige im Profil.

- **FR-16.7 Meilenstein-Notification:** Bei Erreichen von 10 / 25 / 50 / 100 beantworteten Fragen oder bei Abschluss einer Kategorie wird eine sofortige Glückwunsch-Notification ausgelöst (kein `showTrigger`, sondern direkter `registration.showNotification`). Falls Permission fehlt, In-App-Toast.

- **FR-16.8 Welcome-Back-Banner:** Beim Öffnen der App nach ≥3 Tagen Pause erscheint oben ein Toast mit Klasse `update-banner welcome-back-banner` und `data-testid="welcome-back-banner"`. Enthält „Weitermachen"-CTA, der zur nächsten offenen Frage navigiert. Erscheint unabhängig vom Reminder-Toggle (auch ohne OS-Permission).

- **FR-16.9 Badge-API:** Bei aktiviertem Reminder + offener nächster Frage wird `navigator.setAppBadge(<offene-Fragen-Anzahl>)` aufgerufen. Beim App-Öffnen wird via `clearAppBadge()` zurückgesetzt. Fehlt die API (z. B. Firefox, iOS), still ignorieren.

- **FR-16.10 Settings-UI:** Profil-Tab enthält Karte „Erinnerungen" (`data-testid="reminder-settings"`) mit:
  - Toggle „Benachrichtigungen aktiv" (`data-testid="reminder-toggle"`, `<input type="checkbox">` mit `<label>`)
  - Erklär-Text zur automatischen Cadence („Wir erinnern dich nach 3, 10 und 24 Tagen Pause — danach Ruhe.")
  - „Stille Stunden"-Info (read-only Hinweis)
  - Streak-Stats (`current` / `longest`)
  - **Kein Cadence-Selector.**

- **FR-16.11 Permission-Flow:** Bei `Notification.permission === 'denied'` zeigt die Settings-Karte einen erklärenden Hinweis statt des Toggles („In den Browser-/OS-Einstellungen aktivierbar"). Bei `'default'` (noch nicht gefragt) öffnet das Aktivieren des Toggles den Permission-Prompt; Ablehnung schaltet den Toggle zurück.

- **FR-16.12 Re-Schedule:** Bei jedem `visibilitychange → visible`, jedem Settings-Toggle-Wechsel und jeder neuen Antwort wird der nächste OS-Trigger neu berechnet (relative zu jetzt). Existierende Trigger mit `tag: 'rm-reminder'` werden vorher per `getNotifications({ tag })` + `close()` entfernt.

- **FR-16.13 Schema-Wechsel ohne Migration:** Der alte Key `rm-reminder-pref` wird ersatzlos durch `rm-reminder-state` (siehe Datenschicht) ersetzt. Beim ersten Hook-Init wird `localStorage.removeItem('rm-reminder-pref')` aufgerufen, falls vorhanden. Bestandsnutzer müssen Notifications einmalig neu aktivieren (App ist Pre-Release).

---

## 5. Nicht-funktionale Anforderungen

| Anforderung | Wert |
|-------------|------|
| Offline | 100 % – kein Push-Server, alles client-side |
| Privacy | Keine Telemetrie über Notification-Klicks; keine personenbezogenen Daten in Notification-Inhalten außer eigener Profilname |
| Accessibility | Welcome-Back-Banner: `role="alert"`, `aria-live="polite"`. Settings-Toggle: `<input type="checkbox">` mit verbundenem `<label>` |
| Lokalisierung | Alle Texte (Settings, Banner, Notification-Bodies, Variantenpool) in `de/ui.ts` + `en/ui.ts` |
| iOS-Verhalten | OS-Notification deaktiviert + Setting-Hinweis „Auf iOS funktionieren Erinnerungen aktuell nur in der App"; Welcome-Back-Banner kompensiert |
| Permission-Erosion | Bei jedem Render der Settings-Karte Status frisch via `Notification.permission` prüfen |

---

## 6. Datenschicht

```
localStorage 'rm-reminder-state' (NEU, einziger Reminder-Key):
  {
    permission:      'none' | 'enabled' | 'dismissed'
    backoffStage:    0 | 1 | 2 | 3        // 0=initial, 1=3d, 2=10d, 3=24d, ≥3=stumm
    lastShownAt?:    number               // ms epoch
    lastVariantIdx?: number               // letzte Pool-Position
  }

localStorage 'rm-reminder-pref' (LEGACY):
  Wird beim ersten Hook-Init via removeItem() GELÖSCHT.
  Kein Migrationspfad.

AppState 'remember-me-state':
  streak?: { current: number; longest: number; lastAnswerDate: string }   (optional, neu)

src/data/reminderMessages.ts:
  REMINDER_MESSAGES: { de: string[]; en: string[] }   (≥8 Einträge je Sprache)
```

---

## 7. Komponenten- & Hook-Schicht

| Datei | Rolle |
|-------|-------|
| `src/hooks/useReminder.ts` | Erweitert: Backoff-Stage-Logik, Pool-Rotation, `data.questionId`, alter `rm-reminder-pref` wird beim Mount gelöscht |
| `src/hooks/useStreak.ts` | NEU – verwaltet `state.streak`, triggert Meilenstein-Notifications |
| `src/components/ReminderBanner.tsx` | Unverändert (Permission-Prompt) |
| `src/components/WelcomeBackBanner.tsx` | NEU – `data-testid="welcome-back-banner"`, „Weitermachen"-CTA |
| `src/views/ProfileView.tsx` (oder Äquivalent) | Neue Sektion „Erinnerungen" mit Toggle + Streak-Stats |
| `src/utils/notificationContent.ts` | NEU – wählt Variante (mit `lastVariantIdx`-Rotation), optional mit nächster Frage-Titel |
| `src/data/reminderMessages.ts` | NEU – Variantenpool de/en |
| `src/locales/{de,en}/ui.ts` + `types.ts` | Erweitert: `reminder.settings.*`, `reminder.welcomeBack.*`, `reminder.streak.*`, `reminder.milestone.*` |

---

## 7a. API-Vertrag (verbindlich für Impl + Tests)

Damit Implementation- und Test-Agent unabhängig voneinander auf identische Symbole zugreifen, fixiert dieser Abschnitt die exakten Exports und Signaturen. **Beide Agents müssen diese Verträge wörtlich umsetzen** — keine Aliase, keine Umbenennungen.

### 7a.1 `src/hooks/useStreak.ts`

```ts
export interface StreakState {
  current: number
  longest: number
  lastAnswerDate: string   // ISO 8601 (YYYY-MM-DD)
}

export interface UseStreakReturn {
  streak: StreakState
  totalAnswered: number
  /**
   * Aktualisiert Streak nach einer neuen Antwort.
   * @param answeredAt  ISO-Datum (YYYY-MM-DD), default = heute lokal
   * @param totalAnswered  neue Gesamtzahl beantworteter Fragen (für Meilenstein-Trigger)
   */
  recordAnswer: (answeredAt?: string, totalAnswered?: number) => void
  /** Setzt current=0 wenn lastAnswerDate > 1 Tag her ist */
  checkStreakReset: () => void
}

export function useStreak(): UseStreakReturn
```

`recordAnswer` ist die einzige öffentliche Mutator-Funktion. Falls intern eine zusätzliche Helper-Funktion existiert, wird sie nicht exportiert.

### 7a.2 `src/utils/notificationContent.ts`

```ts
export interface NotificationContentOptions {
  locale: 'de' | 'en'
  questionTitle?: string         // wenn vorhanden, wird im Body verwendet
  lastVariantIdx?: number        // ≥0; -1 oder undefined = "keine Vorgängervariante"
}

export interface NotificationContentResult {
  title: string
  body: string
  variantIdx: number             // gewählter Pool-Index, für Persistierung
}

/**
 * Wählt eine Variante aus REMINDER_MESSAGES[locale], rotiert deterministisch
 * vorbei an lastVariantIdx (kein Wiederholen direkt hintereinander),
 * setzt body = questionTitle wenn übergeben.
 */
export function getNotificationContent(opts: NotificationContentOptions): NotificationContentResult
```

### 7a.3 `src/components/WelcomeBackBanner.tsx`

```tsx
export interface WelcomeBackBannerProps {
  visible: boolean
  daysAway: number               // ≥3
  onContinue: () => void         // Klick auf "Weitermachen"
  onDismiss: () => void          // Klick auf ✕
}

export function WelcomeBackBanner(props: WelcomeBackBannerProps): JSX.Element | null
```

DOM-Vertrag: Wurzelelement hat Klasse `update-banner welcome-back-banner` und `data-testid="welcome-back-banner"`. CTA-Button hat `data-testid="welcome-back-continue"`.

### 7a.4 `src/hooks/useReminder.ts` (Erweiterung des bestehenden Hooks)

Der Hook hat **bestehende Konsumenten** in `src/App.tsx` und `src/components/ReminderBanner.tsx`, die nicht angepasst werden dürfen. Der Vertrag ist daher eine **Superset-Erweiterung** des Original-Returns:

```ts
export interface ReminderInternalState {
  permission: 'none' | 'enabled' | 'dismissed'
  backoffStage: 0 | 1 | 2 | 3
  lastShownAt?: number
  lastVariantIdx?: number
}

export interface UseReminderReturn {
  // === Bestehende Methoden (UNVERÄNDERT — werden von App.tsx/ReminderBanner.tsx genutzt) ===
  showPrompt: boolean              // true wenn Permission-Prompt sichtbar sein soll
  requestPermission: () => Promise<void>
  dismissPrompt: () => void
  isEnabled: boolean

  // === Neu für REQ-016 ===
  state: ReminderInternalState
  reschedule: () => Promise<void>  // bei visibilitychange / neuer Antwort aufgerufen
  disable: () => void              // explizites Off-Schalten via Settings-Toggle
}

export function useReminder(): UseReminderReturn
```

`requestPermission` ist die einzige Aktivierungs-Methode (keine zusätzliche `enable()`). Beim Mount: `localStorage.removeItem('rm-reminder-pref')` (genau einmal pro Browser-Lifetime, idempotent).

### 7a.5 ProfileView (Settings-Sektion)

ProfileView konsumiert `useStreak()` und `useReminder()` **direkt via Hook-Aufruf**, keine zusätzlichen Required-Props. Falls neue Props nötig sind, sind sie alle **optional** mit Default. Bestehende Tests (`ProfileView.test.tsx`) dürfen nicht durch Änderungen der Required-Prop-Signatur brechen.

### 7a.6 `src/data/reminderMessages.ts`

```ts
export const REMINDER_MESSAGES: {
  de: readonly string[]   // ≥8 Einträge
  en: readonly string[]   // ≥8 Einträge
}
```

### 7a.7 i18n-Schlüssel (`src/locales/types.ts`)

```ts
interface UITranslations {
  // … bestehende Felder …
  reminder: {
    settings: {
      title: string                  // "Erinnerungen" / "Reminders"
      toggleLabel: string
      cadenceExplanation: string
      quietHours: string
      streakLabel: string            // "Streak" / "Streak"
      streakCurrent: string          // "Aktuell" / "Current"
      streakLongest: string          // "Längste" / "Longest"
      iosFallbackHint: string
      permissionDeniedHint: string
    }
    welcomeBack: {
      title: string                  // "Willkommen zurück" / "Welcome back"
      bodyDays: string               // mit {days} Platzhalter
      continueCta: string            // "Weitermachen" / "Continue"
      dismiss: string                // "Schließen" / "Dismiss"
    }
    milestone: {
      bodyAnswered: string           // mit {count}
      bodyCategoryDone: string       // mit {category}
    }
  }
}
```

---

## 8. Akzeptanzkriterien

- [ ] Profil-Tab zeigt Karte mit `data-testid="reminder-settings"`
- [ ] `data-testid="reminder-toggle"` schaltet OS-Notification an/aus, Persistenz nach Reload
- [ ] Settings-Karte zeigt Erklär-Text zur Cadence (kein Selector)
- [ ] Welcome-Back-Banner (`data-testid="welcome-back-banner"`) erscheint nach simuliertem 4-Tage-Sprung (E2E: localStorage-Manipulation + Reload)
- [ ] Welcome-Back-Banner-CTA navigiert zur nächsten offenen Frage
- [ ] Streak-Anzeige zeigt mindestens `current` und `longest`
- [ ] Meilenstein-Glückwunsch erscheint nach der 10. Antwort (sofortige Notification, falls Permission gegeben — sonst In-App-Toast)
- [ ] Variantenpool: zwei aufeinanderfolgende Reminder zeigen unterschiedliche Texte
- [ ] iOS-Fallback: bei `'showTrigger' in Notification.prototype === false` ist OS-Toggle deaktiviert + Hinweistext sichtbar
- [ ] Backoff: nach Stage 3 (24 Tage Pause) wird kein weiterer OS-Trigger gesetzt, bis App geöffnet oder Antwort abgegeben wird
- [ ] `localStorage.getItem('rm-reminder-pref')` gibt nach erstem App-Start `null` zurück
- [ ] E2E-Spec `e2e/notifications.spec.ts` grün auf allen 5 Browser-Projekten

---

## 9. Out-of-Scope

- Kein Push-Server, keine `serviceWorker.pushManager.subscribe()`-Pfade
- Kein Telemetrie-Tracking von Notification-Interaktionen
- Keine E-Mail- oder Web-Mention-Benachrichtigungen
- Keine Anpassung von Notification-Tonsignalen
- Keine Migration vom alten `rm-reminder-pref`-Wert (siehe FR-16.13)

---

## 10. Abhängigkeiten

| Abhängigkeit | Grund |
|--------------|-------|
| Web Notifications API + `showTrigger` (experimental) | Stufe-1-Mechanismus |
| `navigator.setAppBadge` / `clearAppBadge` | Stufe-3-Badge |
| Service Worker (vorhanden via REQ-001) | Notification-Auslieferung |
| REQ-002 (Question Engine) | Quelle für „nächste offene Frage" |
| REQ-003 (Story Storage) | `state.streak` als optionales Feld in `remember-me-state` |

# Untersuchung: warum die Auto-Gen-Tests in PR #74 versagten

**Branch:** `claude/investigate-failing-tests`
**Setup:** Auf `main` (b3d43c1) habe ich die Auto-Gen-Commits aus PR #74
neu eingespielt — `fa0fd09` (Test-Agent) und `66d54e4` (Impl-Agent) — und
mit lokaler Playwright-Chromium die Failures reproduziert.

---

## Zusammenfassung

| Test | Failure-Typ | Root-Cause |
|------|-------------|-----------|
| `quiz.spec.ts:38` „text answers persist across reloads" | Reload zeigt OnboardingView statt HomeView | **Architektur-Bug:** `useStreak` ruft intern `useAnswers()` auf, hat damit eine zweite, unabhängige `useState`-Instanz; deren `saveStreak` schreibt veraltetes localStorage und überschreibt `profile: null` |
| `notifications.spec.ts:106` „continue button navigates to next open question" | URL bleibt `/` | `handleWelcomeBackContinue` ruft `setView` statt `goTo` — kein `history.pushState` |
| `notifications.spec.ts:135 / 187 / 230` (3× Milestone) | `getByRole('button', {name:/weiter\|next/i})` 30s-Timeout | Test navigiert auf nicht-existierende Route `/family`; HomeView zeigt keine Textbox + keinen "Weiter"-Button |
| `notifications.spec.ts:297` „dismisses banner and stays dismissed" | `getByTestId('reminder-banner')` not found | `ReminderBanner.tsx` hat kein `data-testid` |
| `notifications.spec.ts:339` „Variantenpool" | `variants.length > 1` got 0 | Test setzt `window.__originalGetNotificationContent` als Hook; der Impl `notificationContent.ts` ignoriert window-Overrides |

---

## Der Architektur-Bug im Detail

`66d54e4` (impl-agent) hat in App.tsx folgendes verdrahtet:

```ts
function handleSaveAnswer(questionId, categoryId, value) {
  saveAnswer(questionId, categoryId, value)  // aus App.tsx's useAnswers()
  recordAnswer()                              // aus useStreak() — ruft IM HOOK ein eigenes useAnswers()
  reschedule()                                // fire-and-forget
}
```

`useStreak` macht intern:

```ts
export function useStreak() {
  const { isLoaded, answers, streak: storedStreak, saveStreak } = useAnswers()
  // ...
}
```

Da `useAnswers` ein `useState`-Hook ist (kein globaler Store), entsteht
**eine zweite, unabhängige State-Instanz**. Beide Instanzen lesen beim
Mount per `loadStateAsync` aus dem gleichen `localStorage` — aber jedes
folgende `setState` ist isoliert.

**Beweis (Console-Trace im Test):**

```
AFTER ONBOARD:   profile:{name:"Quizer"}, answers:{}, …                            (kein streak)
AFTER FILL:      profile:null,             answers:{}, …, streak:{current:1,…}   ← Bug
```

Was passiert:

1. **Onboarding klickt Loslegen** → `App`-Instanz von `useAnswers` ruft
   `saveProfile` → `setState({...prev, profile})` → schreibt
   `localStorage`. ✓ Profil gespeichert.
2. **`useStreak`-Instanz von `useAnswers` ist seit Mount auf dem
   Initial-State** (`profile: null, answers: {}, …`). Loslegen-Click
   ändert daran nichts, weil React den State-Update nicht zwischen
   `useState`-Instanzen synchronisiert.
3. **Textarea.fill** → `handleSaveAnswer`:
   - `saveAnswer(...)` schreibt korrekt das Profil + neue Antwort.
   - `recordAnswer()` ruft `saveStreak`, das via
     `setState(prev => {...prev, streak})` schreibt. **`prev` ist hier
     die `useStreak`-Instanz mit dem alten, leeren State** —
     `profile: null`. `saveState` schreibt das nach `localStorage` und
     **überschreibt das Profil**.
4. Nach `page.reload()` lädt App `loadStateAsync` → `profile: null` →
   OnboardingView statt HomeView → der Test scheitert beim Klick auf
   "Werte & Überzeugungen".

Das ist der Grund, warum alle 5 Browser-Projekte in CI fehlschlugen,
selbst nach Revert der Auto-Gen-Tests — der Schaden steckt im
Wiring, nicht in den Tests.

---

## Fix-Empfehlung (für eine zukünftige Session)

### Architektur

`useAnswers` ist als Multi-Instance-Hook unsicher, sobald andere Hooks
ihn intern komponieren wollen. Optionen:

1. **Globaler Store (Zustand/Jotai/Context):** `useAnswers`-Logik in
   einen geteilten Store verschieben. Alle Konsumenten lesen denselben
   State. Kein Tearing.
2. **Hooks ohne Schreibzugriff:** `useStreak` nimmt `streak`,
   `saveStreak` und `answers` als Argumente von außen, statt intern
   `useAnswers()` aufzurufen. App orchestriert.
3. **`saveStreak` über funktionalen Updater + ohne Profile-Touch:**
   Statt `{...prev, streak}` einen Patch-Mechanismus, der nur das
   `streak`-Feld berührt (z.B. `setStreak(prev => ({...prev.streak,
   …}))`). Erfordert immer noch Sync zwischen Instanzen — Stammbug
   bleibt.

Realistisch: **Option 1** ist die saubere Lösung; Option 2 ist die
schnelle Notbremse, die `useStreak`/`useReminder` zu reinen
„Compute-Hooks" macht und den State-Schreibzugriff bei `App` belässt.

### Einzel-Fixes (klein, unabhängig)

| # | Was | Fix |
|---|-----|-----|
| 1 | `handleWelcomeBackContinue` setView → goTo | Eine-Zeilen-Änderung in App.tsx (war im PR #74 schon drin) |
| 2 | `ReminderBanner` ohne `data-testid` | `data-testid="reminder-banner"` an Root-`<div>` (war im PR #74 schon drin) |
| 3 | Milestone-Tests gegen `/family`-Route | Tests müssen den realen Quiz-Flow durchspielen (Heading-Click → Textarea-Fill → Weiter), nicht eine erfundene Route |
| 4 | Variantenpool-Mock funktioniert nicht | Test muss anders ansetzen — z.B. via `page.route` den ServiceWorker abfangen oder `lastVariantIdx` direkt im localStorage über zwei Renders verifizieren |

---

## Was auf `main` jetzt steht (PR #74 final)

- Reminder-Code ist da (Banner, Hooks, Tests, Spec)
- **Profil-Settings-Card raus** (das ursprüngliche Ziel)
- **Wiring vom impl-agent ist NICHT integriert** — `WelcomeBackBanner`
  liegt im Repo, wird aber von `App.tsx` nicht gerendert; `recordAnswer`
  wird nicht aus dem Quiz-Flow heraus aufgerufen
- Hook-Bug-Fixes (Backoff-Progression, Milestone-Dedup) bleiben drin
- `ReminderBanner.data-testid="reminder-banner"` bleibt drin
- e2e: Welcome-Back/Milestone als `test.fixme`

Das ist konsistent: solange `useStreak`-/`useAnswers`-Architektur nicht
gefixt ist, kann das App.tsx-Wiring nicht aktiviert werden, ohne andere
Tests zu brechen.

---

## Reproduktion lokal

```bash
git checkout claude/investigate-failing-tests

# Browser-Symlinks setzen (Playwright 1.59.1 sucht chromium-1217, lokal
# liegt nur 1194 — ein Symlink reicht).
ln -s /opt/pw-browsers/chromium-1194/chrome-linux \
      /opt/pw-browsers/chromium-1217/chrome-linux64

PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
  VITE_SUPABASE_URL=http://supabase.e2e.local \
  VITE_SUPABASE_ANON_KEY=e2e-anon-key \
  CI=1 \
  npx playwright test --project=chromium e2e/notifications.spec.ts e2e/quiz.spec.ts
```

Erwartet: 6 Failures in `notifications.spec.ts` + 1 in `quiz.spec.ts:38`.

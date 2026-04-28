# Testing-Konventionen

Verbindliche Test-Regeln für dieses Repo. Hintergrund: REQ-016
(Engagement-Benachrichtigungen) ging mit grünen Tests live, hat aber in der
Praxis nicht funktioniert. Drei Lücken haben das ermöglicht — diese Datei
hält fest, wie wir sie schließen.

> **Verbindlichkeit:** Regeln 1 + 2 werden in `npm test` automatisch
> geprüft (`scripts/check-test-conventions.mjs`). Regel 3 ist eine
> Review-Norm und Teil des Spec-Templates
> [`docs/requirements/_TEMPLATE.md`](./requirements/_TEMPLATE.md).

---

## Regel 1: Behavior-Hooks nicht in Component-Tests wegmocken

**Warum:** Wenn ein Component-Test die zentrale Logik (`useReminder`,
`useStreak`, …) per `vi.mock` durch ein Stub-Objekt ersetzt, prüft er nur
den Renderer gegen einen erfundenen Zustand. Der echte Vertrag zwischen
Component und Hook (welche Methode wann aufgerufen wird, welcher Zustand
zurückkommt, welche Browser-API-Pfade existieren) bleibt ungeprüft.

**Erlaubt:** Browser-API-Adapter mocken — `useImageStore`, `useAudioStore`,
`useVideoStore`, `useAudioRecorder`, `useServiceWorker`. Diese kapseln
Browser-APIs, die in JSDOM gar nicht existieren. Allowlist liegt in
`scripts/check-test-conventions.mjs`; Erweiterung im Review begründen.

**Nicht erlaubt:** Behavior-Hooks (`useReminder`, `useTheme`, `useStreak`,
`useInstallPrompt`, …) in Component-Tests stubben. Wenn die Browser-API,
auf der sie aufsetzen, in JSDOM fehlt — die **API** stubben, nicht den Hook.

```ts
//  Falsch: Hook ausgehängt, Vertrag ungetestet
vi.mock('../hooks/useReminder', () => ({
  useReminder: () => ({ isEnabled: false, requestPermission: vi.fn() }),
}))

//  Richtig: Browser-API gestubbt, Hook läuft echt
Object.defineProperty(window, 'Notification', {
  value: { permission: 'default', requestPermission: vi.fn(...) },
  configurable: true,
})
render(<ProfileView … />)
```

**Notausgang:** Inline-Kommentar `// HOOK-MOCK-OK: <Begründung>` innerhalb
von 2 Zeilen vor dem `vi.mock`-Aufruf. Wird im Review hinterfragt.

---

## Regel 2: Interaktive Tests müssen klicken

**Warum:** `expect(toggle).toBeVisible()` beweist nur, dass das Element
gerendert wird. Es beweist nicht, dass der `onClick`-Handler verdrahtet
ist, dass der Hook die richtige Methode aufruft, dass der Folgezustand
sichtbar wird. Genau diese Lücke war der zweite Sargnagel von REQ-016.

**Regel:** Eine `*.test.tsx`-Datei, die interaktive Selektoren benutzt
(`getByTestId(...)` oder `getByRole('checkbox' | 'switch')`), muss
mindestens einen `click`-Aufruf enthalten (`.click(`, `fireEvent.click`,
`userEvent.click`) **und** den Folgezustand asserten — eine Hook-Methode,
ein Storage-Eintrag, ein gerenderter Text.

**Notausgang:** Kommentar `// CLICK-CHECK-OK: <Begründung>` irgendwo in
der Datei. Beispielfall: reine Snapshot-/Visual-Tests, die bewusst nur
Render prüfen.

---

## Regel 3: Definition of Done in jeder Spec

Jede neue Spec in `docs/requirements/` enthält den Abschnitt
**„8. Akzeptanztests"** aus
[`_TEMPLATE.md`](./requirements/_TEMPLATE.md). Die Häkchen sind
PR-Merge-Voraussetzung — wer mergt, ohne die Liste zu verlinken, hat die
Spec nicht erfüllt, sondern nur den Code geschrieben.

Wichtig: Für system-nahe Features (Notifications, Service Worker, Web
Share, Camera/Mic, iOS-PWA-Install) ist der Punkt **„Manuelle
Device-Verification"** Pflicht. Unit- und e2e-Tests bilden diese Bereiche
nicht ab — Permission-Dialoge sind System-UI, iOS-WebKit-Eigenheiten
fehlen in JSDOM und Playwright-Headless.

---

## Lessons aus REQ-016 (Post-Mortem)

| Lücke | Wirkung | Fix |
|-------|---------|-----|
| Unit-Test mockte `useReminder` komplett | Component-Hook-Vertrag nie geprüft | Regel 1 + Guard-Script |
| e2e-Spec rief `toBeVisible()`, klickte nie | onClick-Handler nie ausgelöst | Regel 2 + Guard-Script |
| 4 × `test.fixme` ohne Issue-Link blieben liegen | Welcome-Back & Milestone nie getestet | Spec-Template fordert Issue + Ablaufdatum |
| `showTrigger` existiert auf iOS gar nicht | Feature halb-tot ausgeliefert | DoD-Pflicht: 5-Zeilen-Spike vor Spec |

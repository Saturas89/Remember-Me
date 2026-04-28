# Anforderung: <Titel>

**Status:** 🟢 DRAFT
**ID:** REQ-XXX
**Version:** -
**Letzte Aktualisierung:** YYYY-MM-DD
**Modul:** <Core | UX | Data | Sharing | …>
**Priorität:** <Low | Medium | High>

> Vorlage. Beim Anlegen einer neuen Spec diese Datei kopieren, nicht direkt
> editieren. Die Abschnitte „API-Vertrag" und „Akzeptanztests" sind
> verbindlich; alle anderen Abschnitte können bei Bedarf weggelassen werden.

---

## 1. Zusammenfassung

<Ein bis drei Sätze: Was wird gebaut, für wen, warum?>

---

## 2. Funktionale Anforderungen

- **FR-XXX.1:** …
- **FR-XXX.2:** …

---

## 3. Nicht-funktionale Anforderungen

- Privacy: <Welche Daten verlassen das Gerät? Wenn keine: explizit so notieren.>
- Offline: <Was funktioniert offline? Was nicht?>
- Performance: <Budget, falls relevant.>

---

## 7a. API-Vertrag (verbindlich für Impl + Tests)

> Pflicht, sobald die Spec neue Hooks, Komponenten oder Utility-Module
> einführt. Ohne expliziten Vertrag entsteht in der parallel-generation-
> Pipeline Black-Box-Drift zwischen Impl- und Test-Agent.

### Hook `useFoo`

```ts
export interface UseFooReturn {
  // …
}

export function useFoo(): UseFooReturn
```

### Komponente `<FooView>`

```ts
export interface FooViewProps {
  // …
}
```

---

## 8. Akzeptanztests (Definition of Done)

> Pflicht. Ein Feature gilt erst als „done", wenn alle Häkchen gesetzt sind
> und die Belege im PR verlinkt sind. Hintergrund:
> [docs/testing-conventions.md](../testing-conventions.md) (REQ-016 Post-Mortem).

### Unit / Component

- [ ] Component-Test rendert die Hauptansicht **mit echtem Hook**, nicht mit
      `vi.mock('…/hooks/useFoo')`. Nur Browser-API-Adapter (Storage,
      MediaRecorder, ServiceWorker) dürfen gemockt werden — auf Allowlist
      in `scripts/check-test-conventions.mjs`.
- [ ] Mindestens ein Test ruft `fireEvent.click` / `userEvent.click` auf
      jedem zentralen Interaktionselement auf **und** assertet den
      Folgezustand (Storage, gerendeter Text, Hook-State).
- [ ] Edge-Cases: Permission-denied, fehlende Browser-API-Unterstützung,
      Quota-Exceeded, etc. — falls relevant.

### End-to-End (Playwright)

- [ ] Mindestens ein Test, der den primären User-Flow **anklickt** (nicht
      nur `toBeVisible()`) und mindestens einen Folgezustand
      (URL, Storage, gerendeter Text) prüft.
- [ ] Pro `test.fixme` einen verlinkten Issue-Eintrag mit
      Ablaufdatum (max. 14 Tage). Ohne Issue-Link kein Merge.

### Manuelle Device-Verification

> Pflicht für system-nahe Features (Notifications, Service Worker,
> Web Share, Camera/Mic, iOS-PWA-Install). Sonst optional.

- [ ] Real-Device-Smoke auf iOS-Safari (PWA installiert) — Beleg im PR
      (Screenshot oder Video).
- [ ] Real-Device-Smoke auf Android-Chrome — Beleg im PR.
- [ ] 5-Zeilen-Spike vor Spec-Niederschrift: API existiert, Permission-
      Modell verstanden, iOS-Fallback definiert.

---

## 9. Offene Fragen / Risiken

- …

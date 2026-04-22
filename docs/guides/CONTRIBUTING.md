# Contributing

Generische Mitwirk-Regeln für Projekte, die auf diesem Template basieren. Projektspezifische Ergänzungen (z. B. Domain-Terme, Designsystem-Regeln) werden pro Repo unter dieser Datei ergänzt.

## Branch-Strategie

```
main                        (produktiv, geschützt)
feature/<feature-name>      (neue Features)
fix/<bug-name>              (Bugfixes)
chore/<task>                (Infra, Deps, Tooling)
```

- Nie direkt auf `main` arbeiten.
- Kein Merge ohne PR und grüne CI. Siehe [`CLAUDE.md`](../../CLAUDE.md).

## Commit-Nachrichten (Conventional Commits)

```
feat:      Neue Funktion
fix:       Bugfix
docs:      Dokumentation
chore:     Tooling, Deps, Infrastruktur
refactor:  Keine Verhaltensänderung
test:      Tests hinzufügen/anpassen
```

Optional Scope in Klammern: `feat(auth): ...`.

## Code-Standards

- **TypeScript**: strict-mode, kein `any` (wo vermeidbar).
- **Dateinamen**: Komponenten `PascalCase.tsx`, Hilfsmodule `kebab-case.ts`, Hooks `useFoo.ts`.
- **Tests**: neben der Einheit als `*.test.ts(x)`, E2E unter `e2e/*.spec.ts`.
- **Accessibility**: semantisches HTML, `aria-*`, sinnvolle `data-testid`.
- **Keine Kommentare als Doku von „Was"**: Namen klären das. Kommentare nur für nicht-offensichtliche „Warum".

## Neue Anforderungen (Specs)

Jedes nennenswerte Feature bekommt eine Spec unter `docs/requirements/REQ-0XX-<slug>.md`. Struktur orientiert sich an den Platzhaltern in [`docs/requirements/README.md`](../requirements/README.md). Ein Push einer neuen Spec auf einem Feature-Branch triggert die Parallel-Generation-Pipeline.

## Tests vor dem PR

- `npm test` lokal grün.
- Bei UI-/Verhaltensänderungen: betroffene Playwright-Specs angepasst oder ergänzt.
- Keine `--no-verify`-Commits.

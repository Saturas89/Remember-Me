# Contributing – Remember Me

---

## Branch-Strategie

```
main                        (produktiv)
feature/[feature-name]      (neue Features)
fix/[bug-name]              (Bugfixes)
```

Nie direkt auf `main` arbeiten.

## Commit-Nachrichten

```
feat: Neue Funktion
fix:  Bugfix
docs: Dokumentation
```

## Code-Standards

- TypeScript strict, kein `any`
- Komponenten: PascalCase (`UserProfile.tsx`)
- Dateien: kebab-case (`user-service.ts`)
- Tests: `*.test.tsx` / `*.test.ts`

## Anforderungen hinzufügen

Neue Feature-Spec unter `docs/requirements/REQ-0XX-*.md` anlegen.
Bestehende REQ-Dateien als Vorlage nutzen.

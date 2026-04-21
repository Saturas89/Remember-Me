Du bist der **Implementierungs-Agent** für das Remember-Me-Projekt (React 19 + TypeScript + Vite, Single-Page-PWA, Vitest + Playwright).

Deine Aufgabe: Implementiere die unten stehende Spec vollständig. Ein paralleler, von dir **isolierter** Test-Agent schreibt gleichzeitig die Tests dafür, sieht aber deinen Code nicht — und du sollst seine Tests auch nicht ansehen. Ihr verifiziert euch gegenseitig über die E2E-Matrix.

## Harte Regeln

- Du darfst nur Dateien erstellen oder ändern unter `src/`, **außer** Dateien mit `.test.` im Namen.
- Du darfst **nicht** anfassen:
  - `src/**/*.test.{ts,tsx}`
  - `e2e/**`
  - `package.json`, `package-lock.json`, `playwright.config.ts`, `vite.config.ts`, `tsconfig*.json`
  - `.github/**`, `CLAUDE.md`, `docs/**`, `vercel.json`
- Keine neuen Runtime-Dependencies.
- Keine Commits — der Runner committet nach dir.

## Stil-Hinweise (aus dem Repo)

- Nutze bestehende Patterns aus `src/views`, `src/components`, `src/hooks`, `src/utils`.
- Neue Views leben unter `src/views/*.tsx`, neue Komponenten unter `src/components/*.tsx`, neue Hooks unter `src/hooks/*.ts`.
- i18n-Strings gehören in `src/locales/{de,en}/ui.ts` (beide Sprachen) und werden via `useTranslation()` genutzt.
- Persistenz läuft über `src/hooks/useAnswers.ts`-Stil (localStorage) oder IndexedDB-Patterns aus `src/utils/archiveExport.ts`.
- Accessibility: `role`, `aria-*`, `data-testid` — testids logisch aus Spec-Wording ableiten (der Test-Agent wird dieselbe Logik nutzen).
- Typisch: CSS in `src/App.css` ergänzen.

## Output

Schreibe den Produktionscode. Beschreibe am Ende knapp, welche Dateien du erstellt/geändert hast und welche `data-testid`-Werte du gesetzt hast (für Traceability).

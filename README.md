# Projekt-Template

Dieser Branch ist ein **projekt-agnostisches Startset**: er enthält nur unsere wiederverwendbaren Arbeitsweisen (CI-Pipeline, Agenten-Prompts, Git-Workflow, Doku-Struktur) und **keinen produktspezifischen Code**. Neue Projekte werden auf Basis dieses Branches gestartet.

## Was hier drin ist

| Bereich | Datei(en) | Zweck |
|---------|-----------|-------|
| Git- & PR-Workflow | [`CLAUDE.md`](./CLAUDE.md) | Regeln für Claude-Sessions: immer PR, nie direkt auf `main`, CI-Polling-Rezept |
| CI-Pipeline | [`.github/workflows/e2e.yml`](./.github/workflows/e2e.yml) | Playwright-Matrix (5 Browser-Projekte) auf jedem PR |
| Parallel-Generation | [`.github/workflows/parallel-generation.yml`](./.github/workflows/parallel-generation.yml) | Triggert bei `docs/requirements/REQ-*.md`-Push zwei isolierte Claude-Agents (Impl + Test) parallel |
| Agenten-Prompts | [`.github/prompts/impl-agent.md`](./.github/prompts/impl-agent.md), [`.github/prompts/test-agent.md`](./.github/prompts/test-agent.md) | Black-Box-Isolation: Impl kennt Tests nicht, Test kennt Code nicht |
| Coding-Vorgaben | [`docs/guides/CONTRIBUTING.md`](./docs/guides/CONTRIBUTING.md) | Branch-Strategie, Commit-Konventionen, Code-Stil |
| Doku-Struktur | [`docs/requirements/README.md`](./docs/requirements/README.md), [`docs/modules/README.md`](./docs/modules/README.md) | Vorlagen für REQ-Specs (MoSCoW) und Architektur-Übersicht |
| Dependency-Updates | [`renovate.json`](./renovate.json) | Wöchentliche Renovate-PRs, Gruppierung nach Ökosystem |
| Node-Version | [`.nvmrc`](./.nvmrc) | Einheitliche Node-Version für alle Umgebungen |

## Was hier bewusst **nicht** drin ist

- Kein `src/`, kein `package.json`, keine Build-/Runtime-Configs — die sind projektspezifisch.
- Keine Requirements/Specs — nur die Vorlagen dafür.
- Keine Assets (Logos, Icons, Manifeste).

## Ein neues Projekt auf dieser Basis starten

1. Neues Repo auf GitHub anlegen.
2. Inhalt dieses Branches in das neue Repo kopieren (`git clone`, dann `cp -r` ohne `.git` ins neue Repo, oder `git archive` / Fork).
3. Projektgerüst initialisieren (`npm init`, Framework-Scaffolding etc.). Tooling-Configs (Vite/Playwright/Vitest/tsconfig) und `package.json` entstehen dabei neu.
4. Playwright + Vitest installieren, damit die CI-Workflows grün laufen (Pipeline erwartet `npm ci`, `npx playwright test`, `npm test`).
5. Sekrets setzen, falls der Parallel-Generation-Workflow genutzt werden soll: `CLAUDE_CODE_OAUTH_TOKEN` im Repo-Secret.
6. Erste Spec unter `docs/requirements/REQ-001-<slug>.md` ablegen und pushen — der Parallel-Generation-Workflow startet dann automatisch.
7. `CLAUDE.md`, `impl-agent.md`, `test-agent.md` bei Bedarf an den konkreten Tech-Stack anpassen (Framework-Namen, Testbefehle, Stil-Hinweise). Die **Isolations-Regeln** (Agent sieht Gegenseite nicht) sollten bleiben.

## Arbeitsablauf (TL;DR)

```
Spec schreiben  →  push  →  Parallel-Generation-Workflow
                              ├─ Impl-Agent (nur Code)
                              └─ Test-Agent (nur Tests, aus Spec)
                           →  gemeinsamer Commit auf Feature-Branch
                           →  Auto-PR gegen main
                           →  E2E-Matrix (5 Browser) entscheidet grün/rot
```

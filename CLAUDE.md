# Remember Me – Repo-Anweisungen für Claude

## Git-Workflow: immer Pull Requests, nie direkte Merges

Wenn der Nutzer dich bittet, einen Feature-Branch in `main` zu integrieren, **lege immer einen Pull Request an** statt `main` lokal zu mergen und zu pushen.

Grund: Der Workflow `.github/workflows/e2e.yml` läuft die Playwright-Matrix (Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari) auf `pull_request`-Events. Direkte Pushes auf `main` umgehen diesen Check.

**Vorgehen:**
1. Branch pushen (via `git push -u origin <branch>`).
2. PR via `mcp__github__create_pull_request` öffnen (gegen `main`).
3. Den Nutzer über den PR-Link informieren und fragen, ob nach grünem CI automatisch gemerged werden soll.
4. Nur bei ausdrücklicher Bestätigung `mcp__github__merge_pull_request` aufrufen (bevorzugt `squash`).
5. Niemals `--no-verify` oder CI-Umgehungen benutzen.

Ausnahme: Der Nutzer fordert explizit einen direkten Merge ohne PR.

## Changelog-Pflicht

Nur **funktionale Änderungen** werden veröffentlicht. Konkret: PRs, die ein **neues Feature**, ein **neues Pack** (Fragen-Pack, Themen-Pack, Locale, Modus) oder eine andere funktionale Erweiterung bringen, müssen **drei Stellen** gleichzeitig aktualisieren:

1. `package.json#version` – SemVer hochzählen (Feature → minor, Breaking → major).
2. `docs/CHANGELOG.md` – neuer `## [x.y.z] – YYYY-MM-DD`-Abschnitt am **Anfang der Liste** + Zeile in der „Versionsübersicht"-Tabelle. Keep-a-Changelog-Sektionen (`### Hinzugefügt`, `### Geändert`, `### Behoben`).
3. `src/data/releaseNotes.ts` – neuer `ReleaseNote`-Eintrag am **Anfang des Arrays** mit 1–4 nutzerfreundlichen Highlights (Emoji + Kurzsatz). Diese landen direkt im in-App „Was ist neu?"-Modal.

**Ausgenommen** (kein Versionsbump, kein Changelog-Eintrag, kein Release-Note):

- Reine **UX/UI-Anpassungen** (Styling, Layout, Mikro-Interaktionen ohne neue Funktion).
- **Bugfixes** ohne neue Funktion.
- Reine **Refactor- / Test-Only-PRs**.

Der Script `node scripts/check-changelog.mjs` (läuft als Teil von `npm test`, separat via `npm run check:changelog`) bricht ab, wenn die Version in `package.json` in einem der beiden Dokumente fehlt. Bei den ausgenommenen PRs bleibt die Version stehen und der Check ist trivial grün.

Beim Backfill (mehrere Features in einem PR) eine sinnvolle Sammelversion vergeben statt einen Eintrag pro Commit.

## Tests

- **Unit / Komponenten:** Vitest + Testing Library in `src/**/*.test.{ts,tsx}`. Lauf: `npm test`.
- **End-to-End:** Playwright in `e2e/`. Lauf: `npm run test:e2e`. Läuft in CI gegen fünf Browser-Projekte.
- Vor jeder PR-Erstellung sicherstellen, dass `npm test` lokal grün ist.

## Dual-Agent Specs: parallele Ausführung Pflicht

Pläne, die die Header `# ── IMPLEMENTATION AGENT BRIEF ──` **und** `# ── TEST AGENT BRIEF ──` enthalten (Single-Source-of-Truth-Specs für zwei Agents), MÜSSEN über zwei `Agent`-Tool-Aufrufe in **einer einzigen Message** parallel gestartet werden:

- Agent A: `subagent_type: general-purpose`, Prompt = Spec + Verweis auf Implementation-Brief-Sektionen
- Agent B: `subagent_type: general-purpose`, Prompt = Spec + Verweis auf Test-Brief-Sektionen

**Verboten:** direkte Eigenausführung im Hauptkontext, sequentielle Ausführung beider Briefs nacheinander, oder einen der beiden Briefs auslassen.

**Pre-Approval-Vertrag:** Bevor der Nutzer den Plan genehmigt, gibt Claude explizit bekannt: „Ich starte nach Approval zwei Agents parallel: Agent A (Implementation, §X–Y), Agent B (Test, §Z–W). Beide in einer Message." Damit ist der Vertrag bestätigt, und der Nutzer kann widersprechen, falls Claude es im Eifer vergessen sollte.

Ausnahme: Der Nutzer fordert explizit Eigenausführung oder serielle Reihenfolge.

## CI-Polling nach PR-Erstellung

GitHub-Webhooks erreichen die Session nicht zuverlässig. Nach jedem `mcp__github__create_pull_request` deshalb **Monitor-Heartbeat im 3,5-min-Takt** (≈ Dauer der Playwright-Matrix) starten und bei jedem Tick die Check-Runs via `mcp__github__pull_request_read` (method `get_check_runs`) abfragen. Loop beenden, sobald alle Checks `completed` sind; Ergebnis zusammenfassen.

**Setup:**
```
Monitor command: i=1; while :; do echo "tick $i $(date -u +%H:%M:%SZ)"; i=$((i+1)); [ "$i" -gt 15 ] && { echo "giving-up"; exit 0; }; sleep 210; done
persistent: true
```
Bei grüner CI Monitor per `kill <pid>` stoppen (kein `TaskStop` in dieser Harness).

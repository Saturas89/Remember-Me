# Projekt-Template – Repo-Anweisungen für Claude

> Diese Datei ist eine **generische Vorlage**. In einem neuen Projekt darfst und sollst du Projektnamen, Tech-Stack-Hinweise und Testkommandos an die Realität anpassen — die Workflow- und CI-Regeln unten gelten aber unverändert.

## Git-Workflow: immer Pull Requests, nie direkte Merges

Wenn der Nutzer dich bittet, einen Feature-Branch in `main` zu integrieren, **lege immer einen Pull Request an** statt `main` lokal zu mergen und zu pushen.

Grund: Die CI (`.github/workflows/e2e.yml`) läuft auf `pull_request`-Events. Direkte Pushes auf `main` umgehen diesen Check.

**Vorgehen:**
1. Branch pushen (via `git push -u origin <branch>`).
2. PR via `mcp__github__create_pull_request` öffnen (gegen `main`).
3. Den Nutzer über den PR-Link informieren und fragen, ob nach grünem CI automatisch gemerged werden soll.
4. Nur bei ausdrücklicher Bestätigung `mcp__github__merge_pull_request` aufrufen (bevorzugt `squash`).
5. Niemals `--no-verify` oder CI-Umgehungen benutzen.

Ausnahme: Der Nutzer fordert explizit einen direkten Merge ohne PR.

## Tests

- **Unit / Komponenten:** Standard im Template ist Vitest + Testing Library in `src/**/*.test.{ts,tsx}`. Lauf: `npm test`.
- **End-to-End:** Standard im Template ist Playwright in `e2e/`. Lauf: `npm run test:e2e`. Läuft in CI gegen eine Browser-Matrix.
- Vor jeder PR-Erstellung sicherstellen, dass `npm test` lokal grün ist.

Wenn ein konkretes Projekt andere Test-Frameworks verwendet, passe diese Kommandos an — die Regel „lokal grün vor PR" bleibt bestehen.

## CI-Polling nach PR-Erstellung

GitHub-Webhooks erreichen die Session nicht zuverlässig. Nach jedem `mcp__github__create_pull_request` deshalb **Monitor-Heartbeat im Takt der typischen CI-Dauer** starten (Richtwert: ~3,5 min für die Playwright-Matrix) und bei jedem Tick die Check-Runs via `mcp__github__pull_request_read` (method `get_check_runs`) abfragen. Loop beenden, sobald alle Checks `completed` sind; Ergebnis zusammenfassen.

**Setup:**
```
Monitor command: i=1; while :; do echo "tick $i $(date -u +%H:%M:%SZ)"; i=$((i+1)); [ "$i" -gt 15 ] && { echo "giving-up"; exit 0; }; sleep 210; done
persistent: true
```
Bei grüner CI Monitor per `kill <pid>` stoppen (kein `TaskStop` in dieser Harness).

## Parallel-Spec-Generation (Impl- + Test-Agent)

Das Repo enthält unter `.github/workflows/parallel-generation.yml` eine Pipeline, die bei jedem Push einer Spec-Datei (`docs/requirements/REQ-*.md`) zwei Claude-Code-Sessions parallel gegen dieselbe Spec startet:

- **Implementation-Agent** (`.github/prompts/impl-agent.md`) schreibt Produktionscode, ohne Tests zu sehen.
- **Test-Agent** (`.github/prompts/test-agent.md`) schreibt Tests ausschließlich aus der Spec, ohne den Produktionscode zu sehen.

Die E2E-Matrix auf dem resultierenden PR ist die gemeinsame Prüfinstanz („Black-Box-Verifikation"). Das Prompt-Paar ist bewusst generisch gehalten — passe es bei stark abweichendem Tech-Stack leicht an, aber halte die Isolations-Regeln (keine Code→Test-Leak) ein.

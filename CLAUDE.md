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

## Tests

- **Unit / Komponenten:** Vitest + Testing Library in `src/**/*.test.{ts,tsx}`. Lauf: `npm test`.
- **End-to-End:** Playwright in `e2e/`. Lauf: `npm run test:e2e`. Läuft in CI gegen fünf Browser-Projekte.
- Vor jeder PR-Erstellung sicherstellen, dass `npm test` lokal grün ist.

## CI-Polling nach PR-Erstellung

GitHub-Webhooks erreichen die Session nicht zuverlässig. Nach jedem `mcp__github__create_pull_request` deshalb **Monitor-Heartbeat im 3,5-min-Takt** (≈ Dauer der Playwright-Matrix) starten und bei jedem Tick die Check-Runs via `mcp__github__pull_request_read` (method `get_check_runs`) abfragen. Loop beenden, sobald alle Checks `completed` sind; Ergebnis zusammenfassen.

**Setup:**
```
Monitor command: i=1; while :; do echo "tick $i $(date -u +%H:%M:%SZ)"; i=$((i+1)); [ "$i" -gt 15 ] && { echo "giving-up"; exit 0; }; sleep 210; done
persistent: true
```
Bei grüner CI Monitor per `kill <pid>` stoppen (kein `TaskStop` in dieser Harness).

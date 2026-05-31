# Storyhold – Repo-Anweisungen für Claude

## Git-Workflow: immer Pull Requests, nie direkte Merges

Branches nie direkt nach `main` pushen. Immer PR anlegen – `.github/workflows/e2e.yml` läuft die volle Playwright-Matrix nur auf `pull_request`-Events.

**Ablauf:**
1. Branch pushen: `git push -u origin <branch>`
2. PR via `mcp__github__create_pull_request` öffnen (gegen `main`)
3. Sofort `mcp__github__enable_pr_auto_merge` mit `mergeMethod: "SQUASH"` aufrufen
4. Nutzer über PR-Link informieren, kurz erwähnen dass Auto-Merge aktiv ist
5. Monitor-Polling starten (→ Abschnitt „CI-Wakeup")
6. Sobald CI grün: Nutzer benachrichtigen. GitHub merged automatisch – Claude fragt nicht um Erlaubnis und ruft `merge_pull_request` nicht auf.
7. Wird ein Check rot: Fehler untersuchen, fixen, pushen – Auto-Merge feuert beim nächsten grünen Lauf.
8. Niemals `--no-verify` oder CI-Umgehungen.

**Ausnahmen (kein Auto-Merge):**
- Nutzer fordert explizit direkten Merge ohne PR
- PR als Draft angelegt (`draft: true`)
- PR ändert Dateien in `.github/workflows/` oder env-Dateien mit Secrets

---

## Issue-Abschluss nach Fix

Wenn ein PR einen GitHub-Issue behebt: Issue nach dem Merge mit `mcp__github__issue_write` schließen (`state: "closed"`, `state_reason: "completed"`). Kein separater Kommentar nötig – der Merge-Commit im PR reicht als Referenz.

---

## Changelog- und Doc-Sync-Pflicht

PRs mit neuem Feature oder neuem Pack (Fragen, Themen, Locale, Modus) müssen gleichzeitig **vier Stellen** aktualisieren:

1. `package.json#version` – SemVer: Feature → minor, Breaking → major
2. `docs/CHANGELOG.md` – neuer `## [x.y.z] – YYYY-MM-DD`-Abschnitt am **Anfang** + Zeile in der Versionsübersicht-Tabelle. Keep-a-Changelog-Sektionen (`### Hinzugefügt`, `### Geändert`, `### Behoben`).
3. `src/data/releaseNotes.ts` – neuer Eintrag am **Anfang des Arrays** mit 1–4 Highlights (Emoji + Kurzsatz)
4. `docs/README.md`:
   - Kopfzeile: `**Version:** x.y.z` und `**Letzte Aktualisierung:** YYYY-MM-DD` anpassen
   - REQ-Tabelle: Neues REQ eintragen oder Status eines bestehenden ändern
   - Feature-Liste: Eintrag in „Was die App heute kann ✔️" oder „Roadmap 📋" verschieben/ergänzen

`node scripts/check-changelog.mjs` und `node scripts/check-docs-sync.mjs` brechen ab, wenn Version oder Header-Datum nicht übereinstimmt. Beide laufen als Teil von `npm test`.

**Ausgenommen** (kein Versionsbump, keine Änderungen an den vier Stellen):
- Reine UX/UI-Anpassungen ohne neue Funktion
- Bugfixes
- Refactor- / Test-Only-PRs

Beim Backfill mehrerer Features: eine Sammelversion, kein Eintrag pro Commit.

---

## Tests

- **Unit/Komponenten:** `npm test` (Vitest + Testing Library in `src/**/*.test.{ts,tsx}`)
- **E2E:** `npm run test:e2e` (Playwright in `e2e/`)
- `npm test` muss grün sein, bevor ein Commit gepusht wird

**Nacht-Tests synchron halten:** Die Nightly-Pipeline (`.github/workflows/interaction-tests.yml`) deckt komplexe User-Flows in `e2e/supabase/` ab. Jeder PR, der einen User-Flow ändert oder neu einführt, muss die betroffene Spec im selben Commit aktualisieren. Aktuellen Stand der Dateien per `ls e2e/supabase/` ermitteln. Ausgenommen: reine Styling-PRs (→ wie in Changelog-Pflicht).

---

## Design-System: Family-Tab als Referenz

Alle neuen Views, Modals und Komponenten müssen sich am Family-Tab orientieren. Eigene Farben, Spacing-Werte oder Ad-hoc-Patterns sind verboten.

**Kanonische Referenz:**
- `src/views/OnlineSharingHubView.tsx` (der Family-Tab, Route `/friends`), `src/components/FamilyCard.tsx` (Karten-Referenz)
- `src/App.css` (Family-/`.friends-section`-Block), `src/index.css` (Theme-Variablen)

**Pflicht-Bausteine:**
- **Farben:** ausschließlich CSS-Variablen aus `:root` (`--bg`, `--surface`, `--surface-raised`, `--text`, `--text-muted`, `--text-faint`, `--accent`, `--accent-tinted`, `--success`, `--warn`, `--border`, `--border-focus`). Keine Hex-/RGB-Literals. Alle vier Themes (sepia, nacht, hell, ozean) müssen funktionieren.
- **Spacing:** `0.2 / 0.4 / 0.6 / 0.75 / 1 / 2 / 3 rem` – keine Zwischenwerte
- **Border-Radius:** 8 px Inputs · 10 px Buttons · 12 px Cards/Sections · 999 px Pills
- **Layout:** `.friends-section`, `.friends-section-title`, `.friends-list` (gap `0.75rem`), `.family-card` (flex + gap `1rem` + surface-Background; geteilte Basis-Klasse, auch von Sandra-Karten genutzt), `.friends-hint`, `.friends-hint--warn`
- **Buttons:** sekundär `.btn.btn--ghost.btn--sm`, primäre CTA im Stil `.share-cta-btn` (Logo-Gradient + Shadow + Hover-Transform)
- **Badges/Pills:** `.friends-tag`-Pattern (pill-shaped, `--surface-raised`)
- **Progress:** `.family-progress-bar` / `.family-progress-fill` (4 px Höhe, `--success`)

**Vorgehen bei neuen Features:**
1. Vor dem Stylen `src/views/OnlineSharingHubView.tsx`, `src/components/FamilyCard.tsx` und `src/App.css` lesen und prüfen, welches existierende Pattern passt.
2. Bestehende Klassen/Tokens wiederverwenden. Nur wenn nichts passt, neue Klasse mit denselben Tokens ergänzen und im PR begründen.
3. Beim Review explizit gegen Family-Tab vergleichen (Spacing, Card-Look, Button-Hierarchie, Empty-/Hint-States).

Ausnahme: Nutzer fordert für eine konkrete View bewusst ein abweichendes Design.

---

## CI-Wakeup: aktives Polling via Monitor

`mcp__github__subscribe_pr_activity` ist verboten – Webhooks wecken die Sandbox-Session nicht zuverlässig auf. Falls automatisch subscribed: sofort `mcp__github__unsubscribe_pr_activity` aufrufen, dann Polling starten. Den Nutzer nicht fragen, ob er „watchen" möchte – die Antwort ist immer Polling.

**Vorgehen nach `mcp__github__create_pull_request`:**

1. Polling-Schleife starten (persistent: true):
   ```
   i=0; while [ $i -lt 25 ]; do i=$((i+1)); echo "poll $i $(date -u +%H:%M:%SZ)"; sleep 60; done; echo "polling-window-exhausted"
   ```
   → 25 Ticks × 60 s = 25 min Fenster

2. Auf jeden Tick: `mcp__github__pull_request_read` mit `method: get_check_runs`, prüfen ob alle Jobs aus `needs: [unit, build, e2e]` `status: completed` sind

3. Sobald alle Jobs `completed`: Ergebnisse zusammenfassen (Conclusion pro Browser + Wall-Clock), Monitor stoppen (`kill <pid>`), Nutzer informieren. GitHub merged via Auto-Merge – Claude ruft `merge_pull_request` nicht auf.

4. Bei `polling-window-exhausted`: hängende Jobs diagnostizieren, zweites Fenster starten wenn nötig.

**Polling-Intervall:** 60 s Default. Bei sehr schnellen Pipelines (≤ 3 min) auf 30 s reduzieren, bei sehr langen (≥ 25 min) das Fenster verlängern.

**Wichtig:** Die Polling-Schleife muss ein einfaches Polling sein (1 MCP-Call pro Tick). Ohne MCP-Call ist der Wake teuer und folgenlos.

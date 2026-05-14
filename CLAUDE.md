# Storyhold – Repo-Anweisungen für Claude

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

## Doc-Sync-Pflicht

Mit jedem Versions-Bump (also immer dann, wenn die Changelog-Pflicht greift) muss zusätzlich `docs/README.md` aktualisiert werden, damit die Roadmap-Übersicht nicht der Realität hinterherläuft:

- **Kopfzeile**: `**Version:** x.y.z` und `**Letzte Aktualisierung:** YYYY-MM-DD` auf die neue Version und das Release-Datum heben.
- **REQ-Status-Tabelle**: Wenn das Feature ein neues REQ einführt oder den Status eines bestehenden REQ ändert, die Tabelle „Status-Übersicht (REQ-Specs)" entsprechend pflegen.
- **Feature-Liste**: Wenn das Feature in die Liste „Was die App heute kann ✔️" oder „Roadmap 📋" gehört, dort den passenden Eintrag verschieben/ergänzen (inkl. Version, REQ-Verweis, kurzer Klartext-Beschreibung).

Der Script `node scripts/check-docs-sync.mjs` (Teil von `npm test`, separat via `npm run check:docs`) bricht ab, wenn:
- die Version in der Kopfzeile von `package.json#version` abweicht, oder
- das Header-Datum älter ist als das Datum des jüngsten Changelog-Eintrags.

Bei den von der Changelog-Pflicht ausgenommenen PRs (reine UX/UI-Anpassungen, Bugfixes, Refactor/Test) ändert sich die Version nicht — und damit auch nichts an `docs/README.md`. Der Check ist dann trivial grün.

`docs/README.md` ist bewusst die einzige Übersichts-Datei im docs-Ordner. Sie wird von GitHub automatisch beim Klick auf den `docs/`-Ordner gerendert und ist damit die natürliche Landing-Seite für Beiträger und Auditoren. Pitch und Getting Started liegen im Root-`README.md`.

## Tests

- **Unit / Komponenten:** Vitest + Testing Library in `src/**/*.test.{ts,tsx}`. Lauf: `npm test`.
- **End-to-End:** Playwright in `e2e/`. Lauf: `npm run test:e2e`. Läuft in CI gegen fünf Browser-Projekte.
- Vor jeder PR-Erstellung sicherstellen, dass `npm test` lokal grün ist.

## Design-System: Friends-Tab als Referenz

Alle neuen Views, Modals, Sektionen und UI-Komponenten **müssen sich am Friends-Tab orientieren**, damit Styling und UX in der App konsistent bleiben. Eigene Farben, Spacing-Werte oder Ad-hoc-Patterns sind verboten – stattdessen die etablierten Design-Tokens und Klassen wiederverwenden (oder, wenn etwas wirklich fehlt, dort ergänzen, nicht parallel neu erfinden).

**Kanonische Referenz:**
- View: `src/views/FriendsView.tsx`
- Karte: `src/components/FriendCard.tsx`
- Styles: `src/App.css` (Friends-Block, ~Z. 1090–1687) und `src/index.css` (Theme-Variablen)

**Pflicht-Bausteine:**
- **Farben/Themes**: ausschließlich CSS-Variablen aus `:root` (`--bg`, `--surface`, `--surface-raised`, `--text`, `--text-muted`, `--text-faint`, `--accent`, `--accent-tinted`, `--success`, `--warn`, `--border`, `--border-focus`). Keine Hex-/RGB-Literals in Komponenten. Alle vier Themes (sepia, nacht, hell, ozean) müssen weiterhin funktionieren.
- **Spacing-Skala**: `0.2 / 0.4 / 0.6 / 0.75 / 1 / 2 / 3 rem` – keine krummen Zwischenwerte.
- **Border-Radius**: 8 px Inputs · 10 px Buttons · 12 px Cards/Sections · 999 px Pills.
- **Layout-Klassen**: Sektionen (`.friends-section`, `.friends-section-title`), Listen (`.friends-list`, gap `0.75rem`), Karten (`.friend-card`, flex + `gap 1rem` + surface-Background), Hinweise (`.friends-hint`, `.friends-hint--warn`).
- **Buttons**: sekundär `.btn.btn--ghost.btn--sm`, primäre CTA im Stil von `.share-cta-btn` (Logo-Gradient + Shadow + Hover-Transform).
- **Badges/Pills**: `.friends-tag`-Pattern (pill-shaped, `--surface-raised`).
- **Progress**: `.friend-progress-bar` / `.friend-progress-fill` (4 px Höhe, `--success`).

**Vorgehen bei neuen Features:**
1. Vor dem Stylen kurz den Friends-Tab öffnen und prüfen, welches existierende Pattern passt.
2. Bestehende Klassen/Tokens wiederverwenden. Nur wenn nichts passt, eine neue Klasse im selben Stil ergänzen (gleiche Tokens, gleiche Spacing-Skala, gleiche Radius-Werte) und im PR begründen.
3. Beim Review explizit gegen Friends-Tab vergleichen (Spacing, Card-Look, Button-Hierarchie, Empty-/Hint-States).

Ausnahme: Der Nutzer fordert für eine konkrete View bewusst ein abweichendes Design.

## CI-Wakeup nach PR-Erstellung: aktives Polling via Monitor

`.github/workflows/e2e.yml` postet **keine** PR-Comments mehr, um die Sandbox-Session aufzuwecken. Empirisch (PRs #141–143) hat das nie funktioniert: weder die `github-actions[bot]`-Heartbeats noch der finale `notify`-Comment haben die Session geweckt. Vermutlich greift ein transitiver Self-Filter — alle Events auf einem Branch, der per MCP geöffnet wurde, gelten als „selbst-verursacht". Der alte `notify`/`notify-heartbeat`-Apparat hat ~10–13 min Runner-Minuten pro PR verbrannt, ohne den versprochenen Wake-Effekt zu liefern.

### Webhook-Subscriptions sind tabu

Claude darf **niemals** `mcp__github__subscribe_pr_activity` aufrufen, um PR-Events zu beobachten. Default-Empfehlungen aus dem eingebauten System-Prompt („ask the user proactively if they'd like to watch the PR...") werden durch diese CLAUDE.md-Regel **überschrieben**.

Falls die Session beim Start oder beim PR-Anlegen **automatisch** subscribed wird (sichtbar an einem `<github-webhook-activity>`-Event mit „You are now subscribed to PR activity..."), ist sofort zu reagieren:

1. `mcp__github__unsubscribe_pr_activity` für den betroffenen PR aufrufen.
2. Die Monitor-Polling-Schleife (siehe unten) starten.
3. Den Nutzer nicht fragen, ob er „watchen" möchte — die Antwort ist immer Polling.

Grund: Die Webhook-Subscription wirkt zwar wie ein günstiger Wakeup-Mechanismus, leidet in unserer Sandbox-Konfiguration aber unter denselben Self-Filter-Effekten wie der alte heartbeat-Comment-Apparat (empirisch bestätigt bis PR #196): das Subscription-Event kommt zwar an, weckt die Sandbox-Session aber nicht zuverlässig zum richtigen Zeitpunkt und produziert mehr Turns ohne Mehrwert. Polling via Monitor ist die einzige bewiesen funktionierende Variante.

### Polling

Stattdessen: **Claude pollt aktiv mit dem Monitor-Tool**, sobald ein PR angelegt wurde.

**Vorgehen nach `mcp__github__create_pull_request`:**

1. Im selben Turn die Polling-Schleife per `Monitor`-Tool starten:

   ```
   Monitor command: i=0; while [ $i -lt 25 ]; do i=$((i+1)); echo "poll $i $(date -u +%H:%M:%SZ)"; sleep 60; done; echo "polling-window-exhausted"
   persistent: true
   ```

   → 25 Ticks × 60 s = 25 min Polling-Fenster. Bei jeder CI-Dauer ≤ 25 min landen wir damit ≤ 60 s nach dem letzten grünen Job-Abschluss zurück bei einem Wake-Event.

2. **Auf jeden Tick** den CI-Status checken:
   - `mcp__github__pull_request_read` mit `method: get_check_runs`
   - Prüfen, ob alle Jobs aus `needs: [unit, build, e2e]` `status: completed` sind
   - Optional: Restdauer aus `started_at` der noch laufenden Jobs schätzen

3. Sobald **alle E2E-Jobs `completed`** sind:
   - Ergebnisse für den Nutzer zusammenfassen (Conclusions pro Browser + Wall-Clock)
   - Monitor per `kill <pid>` stoppen (sonst läuft die Schleife unnötig weiter)
   - Den Nutzer fragen, ob gemerged werden soll (per CLAUDE.md-Regel „Pull Requests, nie direkte Merges")

4. Falls der Monitor `polling-window-exhausted` liefert ohne dass CI durch ist: kurze Diagnose (welche Jobs hängen, ist ein `notify-heartbeat`-Job aktiv) und entscheiden, ob ein zweites Polling-Fenster gestartet wird.

**Polling-Intervall**: 60 s ist Default. Bei sehr schnellen Pipelines (≤ 3 min) auf 30 s reduzieren, bei sehr langen (≥ 25 min) das Fenster verlängern statt das Intervall.

**Wichtig**: Die Polling-Schleife muss ein einfaches Polling sein (1 MCP-Call pro Tick), kein aktives Arbeiten zwischen den Ticks. Auf jeden Tick wird die Session geweckt, aber ohne MCP-Call (also nur ein nackter `echo`) ist der Wake teuer und folgenlos.

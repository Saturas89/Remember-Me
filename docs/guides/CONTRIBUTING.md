# Contributing – Storyhold

---

## Lizenz & Open-Core-Modell

Storyhold ist Open Source unter der
[**GNU Affero General Public License v3.0 oder später**](../../LICENSE)
(AGPL-3.0-or-later). Jeder Beitrag in dieses Repo wird automatisch unter
derselben Lizenz veröffentlicht.

Die Architektur folgt einem Open-Core-Modell, dokumentiert in
[ADR-001](../architecture/ADR-001-open-source-vs-proprietary.md):

- **Dieses Repo (`saturas89/remember-me`)** – komplette PWA: UI,
  Frage-Engine, Local-Storage, dünne Pro-Clients. AGPL-3.0-or-later.
- **`saturas89/remember-me-pro`** (privat) – proprietäre
  Premium-Backend-Komponenten (Supabase Edge Functions, Prompt-Templates,
  Subscription-Logik). Keine PRs gegen dieses Repo aus dem privaten
  Spiegel; Pro-Logik landet nie hier.

### Contributor License Agreement (CLA)

Pull Requests werden über
[CLA-Assistant](https://cla-assistant.io/) gegen ein CLA geprüft. Mit dem
Sign-Off bestätigst du, dass

1. du das Urheberrecht an deinem Beitrag hältst (oder es erlaubt
   einbringen darfst),
2. Storyhold deinen Beitrag unter AGPL-3.0-or-later veröffentlichen darf,
3. Storyhold das Recht auf **Dual-Licensing** behält (z. B. kommerzielle
   Lizenz auf Anfrage für Enterprise-Kunden, die AGPL nicht einbetten
   können).

Bei Bugfixes ohne nennenswerten kreativen Anteil reicht die
DCO-Sign-Off-Zeile (`Signed-off-by:`); für inhaltliche Beiträge muss das
CLA durchlaufen sein, bevor der PR gemergt wird.

### Dependencies

Neue npm-Dependencies müssen AGPL-kompatibel sein (MIT, Apache-2.0,
BSD-2/3-Clause, ISC, MPL-2.0, AGPL-3.0). `npm run check:licenses` fängt
GPL-inkompatible Lizenzen ab und blockt den PR. Vor dem Hinzufügen einer
Dependency mit unklarer Lizenz bitte in der PR-Beschreibung explizit
begründen.

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

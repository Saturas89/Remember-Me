# ADR-001: Open-Source-Kern, proprietäre Premium-Features serverseitig

**Status:** ✅ ACCEPTED
**Datum:** 2026-05-12
**Autor:** Storyhold-Team
**Betroffene Bereiche:** Architektur, Repo-Layout, REQ-008 (Biografie-Generator), kommende Premium-Features

---

## 1. Kontext

Storyhold ist als Open-Source-PWA aufgesetzt (Repo `saturas89/storyhold`). Einige geplante Features sollen jedoch **nicht** im offenen Quellcode liegen, weil sie

- echtes Domain-Know-how enthalten (Prompt-Engineering für die Biografie-Generierung),
- laufende Kosten verursachen, die abgerechnet werden müssen (Claude-API-Aufrufe, Cloud-Sync-Speicher),
- über Subscriptions kommerzialisiert werden sollen.

Damit stellt sich die Frage, **wie diese Features technisch vom OSS-Kern getrennt werden**, ohne den Open-Source-Charakter der App aufzuweichen.

---

## 2. Betrachtete Optionen

### Option A – Privates Submodule / privates npm-Package

Zwei Repos: das öffentliche OSS-Repo und ein privates Pro-Repo, eingebunden via Git-Submodule oder privates npm-Package. Build-Flag `VITE_INCLUDE_PRO=1` entscheidet, ob das Modul geladen wird. Im OSS-Build steht ein leerer Stub.

- ✔️ Harte Trennung, Pro-Code nie im OSS-Repo sichtbar.
- ❌ Zwei Repos, doppelte CI, koordinierte Releases.
- ❌ Geeignet für reine Client-Features, kein eingebauter Schutz gegen Reverse-Engineering.

### Option B – Single-Repo mit Build-Filter und gespiegeltem OSS-Branch

Pro-Features liegen in `src/pro/` desselben Repos, der OSS-Mirror wird per CI (`git filter-repo` o. Ä.) erzeugt und nach extern gepusht.

- ✔️ Nur ein Working-Repo, einfaches lokales Entwickeln.
- ❌ **Hohes Leak-Risiko:** Ein vergessenes Import, ein falscher CI-Step, eine versehentlich nicht ausgeschlossene Datei – und der proprietäre Code liegt in der Git-Historie des OSS-Spiegels. Nicht mehr einsammelbar.
- ❌ Schwer testbar („ist der Mirror wirklich sauber?").

### Option C – Pro-Features serverseitig (Supabase Edge Functions / RPC)

Frontend bleibt vollständig OSS, Pro-Features werden als HTTPS-Endpoints implementiert, die im privaten Repo (`saturas89/remember-me-pro`) liegen und ins eigene Supabase-Projekt deployed werden. Subscription- und Auth-Check erfolgen serverseitig.

- ✔️ Maximaler Schutz: Selfhoster eines OSS-Forks haben kein funktionierendes Premium ohne unseren Backend-Endpoint.
- ✔️ Kosten- und Abrechnungslogik sitzt direkt am Anthropic-Call.
- ✔️ Iteration ohne Versionsbump im OSS-Repo (kein Changelog-Theater, keine E2E-Matrix).
- ✔️ Supabase ist bereits Bestandteil des Stacks (vgl. `docs/SUPABASE_SETUP.md`).
- ❌ Nur sinnvoll für Features, die ohnehin Server-Roundtrip brauchen. Reine Client-Premium-Features (Themes, lizenzierte Frage-Packs) passen nicht.

---

## 3. Entscheidung

**Wir verfolgen Option C als Haupt-Schiene, mit Option A als Fallback für reine Client-Features. Option B wird nicht verfolgt.**

### Begründung

Die für Storyhold absehbaren Premium-Features (Biografie-Generierung, Cloud-Sync, KI-Frage-Empfehlungen, ggf. Voice-to-Text) brauchen ohnehin einen Server-Roundtrip – Anthropic-API-Key-Schutz, Streaming-Proxy, Abrechnung. Der Schutz vor Code-Leakage fällt als Nebenprodukt ab, ohne dass zusätzliche Repo- oder Build-Komplexität entsteht.

Option B wurde verworfen, weil ein einziges Versehen im Mirror-Workflow den proprietären Code permanent veröffentlicht. Das Risiko-Profil ist asymmetrisch und der operative Aufwand für Absicherung übersteigt die Ersparnis gegenüber Option A.

Option A bleibt als Ergänzung verfügbar, falls künftig reine Client-Premium-Features dazukommen (z. B. lizenzierte Großeltern-Frage-Packs).

---

## 4. Konsequenzen

### 4.1 Architektur

```
┌──────────────────────────────────────────────────────┐
│  OSS-Repo (saturas89/storyhold)                      │
│  • Komplette UI, Frage-Engine, Local-Storage         │
│  • Dünne Pro-Clients (z. B. useBiographyGenerator)   │
│  • Feature-Gate via VITE_PRO_ENDPOINT                │
│  • Fallback-UI bei fehlendem Endpoint                │
└──────────────────────────────────────────────────────┘
                     │ HTTPS + Supabase-JWT
                     ▼
┌──────────────────────────────────────────────────────┐
│  Privates Repo (saturas89/remember-me-pro)           │
│  • Supabase Edge Functions:                          │
│    – generate-biography                              │
│    – (später) suggest-questions, sync-archive, …     │
│  • Prompt-Templates, Modell-Routing                  │
│  • Subscription-Check (profiles.has_pro)             │
│  • Anthropic-API-Key in Supabase-Secrets             │
│  • Eigene Tests, eigener Deploy                      │
└──────────────────────────────────────────────────────┘
```

### 4.2 Regeln für das OSS-Repo

- **Keine proprietären Prompt-Templates, Modell-Heuristiken oder Subscription-Logik** im OSS-Code oder in `docs/requirements/*`.
- Pro-Clients sind „dünn": Sie senden Antworten + Konfiguration an einen Endpoint und rendern die Antwort. Sie enthalten **keine** Geschäftslogik, die nicht auch öffentlich sein soll.
- Feature-Gate-Konvention: `VITE_PRO_ENDPOINT` (optional). Fehlt die Variable, zeigt die UI einen freundlichen „Pro-Feature"-Hinweis statt eines kaputten Buttons.
- Optionaler Bring-your-own-Key-Fallback ist erlaubt, solange er ein **generisches** Prompt verwendet (kein Storyhold-Tuning).

### 4.3 Regeln für das private Pro-Repo

- Liegt unter `saturas89/remember-me-pro` (anzulegen, sobald das erste Pro-Feature umgesetzt wird).
- Enthält Supabase-Edge-Functions, Prompt-Templates, Migrations für `profiles.has_pro` etc.
- **Niemals** in das OSS-Repo committen, auch nicht in einen Branch.

### 4.4 Auswirkungen auf bestehende Dokumente

- **REQ-008 (Biografie-Generator):** wird auf Edge-Function-Architektur umgestellt; konkrete Prompt-Templates werden aus dem OSS-Dokument entfernt.
- **Künftige REQ-Specs für Premium-Features:** verweisen auf diese ADR statt eigene Architekturentscheidungen zu treffen.

### 4.5 Trade-offs, die wir akzeptieren

- **Selfhoster** des reinen OSS-Builds bekommen Premium-Features nicht in der gleichen Qualität. Sie können einen eigenen Anthropic-Key + generisches Prompt nutzen oder ganz auf Premium verzichten. Das ist die gewollte Grenze.
- **Offline-Premium ist ausgeschlossen:** Wer offline ist, sieht die Pro-UI im Hinweis-Zustand. Akzeptabel, weil Premium ohnehin externe Services aufruft.
- **Datenschutz-Pflicht steigt:** Server-seitige Verarbeitung erfordert klare Einwilligung und Dokumentation, was an Anthropic übertragen wird. Wird in den jeweiligen REQ-Specs sichergestellt.

---

## 5. Status & Folgeentscheidungen

- Diese ADR ist akzeptiert.
- Privates Repo `saturas89/remember-me-pro` wird angelegt, sobald REQ-008 in Umsetzung geht.
- Wird ein künftiges Premium-Feature reiner Client-Code (z. B. lizenzierte Frage-Packs), wird Option A für genau dieses Feature aktiviert – per Folge-ADR dokumentieren.

# Anforderungen

Alle funktionalen und nicht-funktionalen Anforderungen des Projekts. Jede Datei unter `REQ-0XX-<slug>.md` beschreibt ein abgeschlossenes Feature oder Querschnittsthema und wird von der Parallel-Generation-Pipeline (`.github/workflows/parallel-generation.yml`) aufgegriffen, sobald sie auf einem Feature-Branch gepusht wird.

---

## 📑 Übersichtstabelle (Vorlage)

Pro Projekt hier eine Tabelle aller REQs pflegen. Leer zu Beginn:

| ID | Titel | Modul | Priorität | Status |
|----|-------|-------|-----------|--------|
| _(noch keine Anforderungen)_ | | | | |

---

## 🎯 MoSCoW-Priorisierung

Neue Anforderungen werden nach MoSCoW priorisiert:

### MUST
Kern-Funktionalität ohne die das Produkt seinen Zweck nicht erfüllt.

### SHOULD
Wichtige, aber nicht blockierende Ergänzungen zum Kern.

### COULD
Nice-to-have — wenn Zeit bleibt.

### WON'T (diese Iteration)
Bewusst ausgeschlossen — begründen, damit die Entscheidung später nachvollziehbar ist.

---

## 🧾 Spec-Vorlage

Neue Specs folgen dieser Gliederung:

```md
# REQ-0XX – <Titel>

**Status:** 🟢 DRAFT · **Priorität:** MUST | SHOULD | COULD · **Modul:** <Modul>

## 1. Ziel / User Story
Worum geht es, wer profitiert, wodurch ist Erfolg messbar?

## 2. Akzeptanzkriterien
- [ ] Jedes Kriterium so formuliert, dass ein Test es direkt prüfen kann.
- [ ] Selektoren/IDs (falls UI) eindeutig aus dem Wording ableitbar.

## 3. Nicht-Ziele
Was explizit **nicht** Teil dieser Spec ist.

## 4. Datenmodell / API (falls relevant)
Felder, Typen, Versionierung, Rückwärtskompatibilität.

## 5. UI / UX (falls relevant)
Skizze der Flows, Texte, erwartetes Verhalten auf Fehlern.

## 6. Tests
Welche Testarten (Unit, Component, E2E), welche Edge-Cases.

## 7. Offene Fragen
Gezielt adressieren, bevor die Parallel-Generation startet — sonst weichen die beiden Agents bei Ambiguität auseinander.
```

---

## 🔒 Globales Prinzip: Rückwärtskompatibilität

Jedes Update persistierter Nutzerdaten muss abwärtskompatibel sein:

- Neue Felder in `localStorage` / IndexedDB / DB-Schema sind immer **optional** und haben Defaults.
- Bestehende Feldnamen und Speicherschlüssel werden **nicht umbenannt oder entfernt**.
- Backup-/Import-Formate erhalten bei strukturellen Änderungen eine neue Versionsnummer; der Import-Handler füllt fehlende Felder mit Defaults.

---

## 📊 Status-Legende

| Symbol | Status | Bedeutung |
|--------|--------|-----------|
| 🟢 | DRAFT | In Planung / Konzept |
| 🟡 | REVIEW | Zur Überprüfung bereit |
| ✅ | APPROVED | Genehmigt, noch nicht implementiert |
| 🔵 | IN PROGRESS | Teilweise implementiert |
| ✔️ | COMPLETED | Vollständig implementiert |
| 🔴 | DEPRECATED | Verworfen |

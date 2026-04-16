# Anforderungen – Remember Me

Alle funktionalen und nicht-funktionalen Anforderungen des Projekts.

---

## 📑 Anforderungen

| ID | Titel | Modul | Priorität | Status |
|----|-------|-------|-----------|--------|
| [REQ-001](./REQ-001-pwa-foundation-clean.md) | PWA Foundation & Responsive Design | Core | High | ✔️ COMPLETED |
| [REQ-002](./REQ-002-question-engine.md) | Frage-Engine & Fragenkatalog | Questions | High | ✔️ COMPLETED |
| [REQ-003](./REQ-003-story-storage.md) | Lebensarchiv & Datenspeicherung | Data | High | ✔️ COMPLETED |
| [REQ-004](./REQ-004-export-sharing.md) | Export & Teilen | Export | Medium | ✔️ COMPLETED |
| [REQ-005](./REQ-005-ci-cd-pipeline.md) | CI/CD Pipeline | DevOps | Low | ✔️ COMPLETED |
| REQ-006 | KI-lesbarer Datenexport | Export | Medium | ✔️ COMPLETED |
| REQ-007 | Medienanhänge (Fotos) | Data | Low | 🟢 DRAFT |
| REQ-008 | E2EE-Sync (opt-in) | Core | Low | 🟢 DRAFT |
| REQ-009 | Audio-Aufnahme & Transkription | Data | Medium | ✔️ COMPLETED |
| REQ-010 | Hilfe & FAQ | UX | Low | ✔️ COMPLETED |
| [REQ-011](./REQ-011-archive-export.md) | Erinnerungs-Archiv (ZIP + Share Sheet) | Export | Medium | ✔️ COMPLETED |

---

## 🎯 MoSCoW Priorisierung

### MUST – Abgeschlossen ✔️
- [x] Frage-Flow mit Kategorien und spielerischer Führung
- [x] Antworten lokal speichern (kein Datenverlust beim Schließen)
- [x] Offline-Nutzung (Service Worker, Workbox)
- [x] Lebensarchiv ansehen (alle gespeicherten Antworten)
- [x] PWA installierbar auf iOS & Android

### SHOULD – Abgeschlossen ✔️
- [x] Fortschrittsanzeige pro Kategorie und gesamt
- [x] Antworten nachträglich bearbeiten (Inline-Edit im Archiv)
- [x] Export als PDF / druckbares Dokument (`window.print()` + `@media print`)
- [x] Responsive Design (Mobile-first, 1-/2-Spalten-Grid)
- [x] Freunde einladen, Fragen beantworten und Antworten automatisch per Share-Link importieren
- [x] Eigene Fragen erstellen und teilen

### COULD – Geplant 📋
- [x] KI-lesbarer Export (Markdown + Enriched JSON) → REQ-006, v1.4.0
- [ ] Fotos zu Antworten hinzufügen → REQ-007, v1.5.0
- [x] Audio-Aufnahme & Transkription → REQ-009, v1.6.0
- [x] Hilfe & FAQ (Datenschutz, Import, Export) → REQ-010, v1.6.0
- [x] Erinnerungs-Archiv ZIP + Share Sheet (inkl. Fotos & Audio) → REQ-011, v1.7.0
- [ ] Push Notifications als Erinnerung
- [ ] Mehrsprachigkeit (DE / EN)
- [ ] Optionaler E2EE-Sync → REQ-008

### WON'T – Bewusst ausgeschlossen
- Eigenes Backend / Server in v1.x
- Social-Media-Funktionen
- Algorithmus-basierte Fragen-Empfehlungen

---

## 🔒 Globales Prinzip: Rückwärtskompatibilität

**Jedes Update muss abwärtskompatibel sein.** Benutzerdaten dürfen durch ein App-Update niemals verloren gehen oder unlesbar werden.

Dieses Prinzip gilt für alle REQs, die Daten speichern oder exportieren:

- Neue Felder in `localStorage` / IndexedDB sind immer **optional** und haben Defaults.
- Bestehende Feldnamen und Speicherschlüssel werden **nicht umbenannt oder entfernt**.
- Das Backup-Format (`$type: "remember-me-backup"`, `version: N`) erhält bei strukturellen Änderungen eine neue Versionsnummer; der Import-Handler befüllt fehlende Felder mit Defaults.
- Detaillierte Regeln und die verbotenen Änderungstypen: → **[REQ-003, Abschnitt 4a](./REQ-003-story-storage.md#4a-rückwärtskompatibilität-breaking-change-verbot)**

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

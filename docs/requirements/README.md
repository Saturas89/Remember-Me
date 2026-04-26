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
| REQ-007 | Medienanhänge (Fotos) | Data | Medium | ✔️ COMPLETED |
| [REQ-008](./REQ-008-biography-generator.md) | Biografie erzeugen | Biography | High | 🟡 PLANNED |
| [REQ-009](./REQ-009-audio-recording.md) | Audio-Aufnahme & Transkription | Data | Medium | ✔️ COMPLETED |
| [REQ-010](./REQ-010-faq.md) | Hilfe & FAQ | UX | Low | ✔️ COMPLETED |
| [REQ-011](./REQ-011-archive-export.md) | Erinnerungs-Archiv (ZIP + Share Sheet) | Export | Medium | ✔️ COMPLETED |
| [REQ-012](./REQ-012-video-attachments.md) | Video-Anhänge | Medien | Medium | ✔️ COMPLETED |
| [REQ-013](./REQ-013-archive-import.md) | Erinnerungs-Archiv-Import (ZIP + JSON) | Import | Medium | ✔️ COMPLETED |
| [REQ-014](./REQ-014-release-notes.md) | Release Notes / „Was ist neu?" | UX | Low | ✔️ COMPLETED |
| [REQ-015](./REQ-015-familienmodus.md) | Familienmodus (E2EE Online-Teilen) | Sharing | Medium | ✔️ COMPLETED |

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

### COULD – Geplant 📋 / Umgesetzt ✔️
- [x] KI-lesbarer Export (Markdown + Enriched JSON) → REQ-006, v1.4.0
- [x] Fotos zu Antworten hinzufügen → REQ-007, v1.5.0
- [x] Audio-Aufnahme & Transkription → REQ-009
- [x] Video-Anhänge → REQ-012
- [x] Hilfe & FAQ (Datenschutz, Import, Export) → REQ-010
- [x] Erinnerungs-Archiv ZIP-Export + Share Sheet (inkl. Fotos, Audio & Video) → REQ-011
- [x] Erinnerungs-Archiv-Import (ZIP + JSON) → REQ-013
- [ ] Push Notifications als Erinnerung
- [ ] Mehrsprachigkeit (DE / EN)
- [ ] Biografie erzeugen (KI-Ghostwriter aus Antworten) → REQ-008
- [x] Familienmodus: Ende-zu-Ende-verschlüsseltes Online-Teilen → REQ-015

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
| 🟡 | PLANNED | Konzept ausgearbeitet, noch nicht implementiert |
| 🟡 | REVIEW | Zur Überprüfung bereit |
| ✅ | APPROVED | Genehmigt, noch nicht implementiert |
| 🔵 | IN PROGRESS | Teilweise implementiert |
| ✔️ | COMPLETED | Vollständig implementiert |
| 🔴 | DEPRECATED | Verworfen |

# Anforderungen – Remember Me

Alle funktionalen und nicht-funktionalen Anforderungen des Projekts.

---

## 📑 Anforderungen

| ID | Titel | Modul | Priorität | Status |
|----|-------|-------|-----------|--------|
| [REQ-001](./REQ-001-pwa-foundation-clean.md) | PWA Foundation & Responsive Design | Core | High | ✔️ COMPLETED |
| [REQ-002](./REQ-002-question-engine.md) | Frage-Engine & Fragenkatalog | Questions | High | ✔️ COMPLETED |
| [REQ-003](./REQ-003-story-storage.md) | Lebensarchiv & Datenspeicherung | Data | High | ✔️ COMPLETED |
| [REQ-004](./REQ-004-export-sharing.md) | Export & Teilen | Export | Medium | 🔵 IN PROGRESS |
| [REQ-005](./REQ-005-ci-cd-pipeline.md) | CI/CD Pipeline | DevOps | Low | ✔️ COMPLETED |
| REQ-006 | KI-lesbarer Datenexport | Export | Medium | 🟢 DRAFT |
| REQ-007 | Medienanhänge (Fotos) | Data | Low | 🟢 DRAFT |
| REQ-008 | E2EE-Sync (opt-in) | Core | Low | 🟢 DRAFT |

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
- [x] Freunde einladen und Beiträge importieren
- [x] Eigene Fragen erstellen und teilen

### COULD – Geplant 📋
- [ ] KI-lesbarer Export (Markdown + Enriched JSON) → REQ-006, v1.4.0
- [ ] Fotos zu Antworten hinzufügen → REQ-007, v1.5.0
- [ ] Push Notifications als Erinnerung
- [ ] Mehrsprachigkeit (DE / EN)
- [ ] Optionaler E2EE-Sync → REQ-008, v1.6.0

### WON'T – Bewusst ausgeschlossen
- Eigenes Backend / Server in v1.x
- Social-Media-Funktionen
- Algorithmus-basierte Fragen-Empfehlungen

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

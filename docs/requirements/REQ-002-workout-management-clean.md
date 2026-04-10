# Anforderung: Workout Management & Planning

**Status:** 🟢 DRAFT  
**ID:** REQ-002  
**Version:** 1.0.0  
**Letzte Aktualisierung:** 2026-04-03  
**Modul:** Workout Management  
**Priorität:** High  

---

## 1. Zusammenfassung

Benutzer können ihre Trainingspläne erstellen, verwalten und anpassen. Ein Workout besteht aus mehreren Übungen mit jeweils Sets, Wiederholungen und Gewicht.

---

## 2. Funktionale Anforderungen

### 2.1 Workout Management (CRUD)

- [ ] **FR-1.1:** Benutzer kann einen neuen Workout erstellen
- [ ] **FR-1.2:** Benutzer kann einen Workout bearbeiten
- [ ] **FR-1.3:** Benutzer kann einen Workout löschen
- [ ] **FR-1.4:** Benutzer kann einen Workout duplizieren
- [ ] **FR-1.5:** Workouts haben Name, Beschreibung und Datum

### 2.2 Übungs-Management

- [ ] **FR-2.1:** Benutzer kann Übungen zu Workout hinzufügen
- [ ] **FR-2.2:** Übung hat: Name, Sets, Reps, Gewicht, Ruhezeit, Notizen
- [ ] **FR-2.3:** Benutzer kann Übung bearbeiten
- [ ] **FR-2.4:** Benutzer kann Übung löschen
- [ ] **FR-2.5:** Benutzer kann Übungs-Reihenfolge ändern

### 2.3 Workout Vorlagen (Templates)

- [ ] **FR-3.1:** App hat vordefinierte Workout-Templates (z.B. Push/Pull/Legs)
- [ ] **FR-3.2:** Benutzer kann Template als Basis für neuen Workout nutzen
- [ ] **FR-3.3:** Benutzer kann eigene Templates speichern
- [ ] **FR-3.4:** Templates können nach Kategorien sortiert werden

### 2.4 Listen & Anzeige

- [ ] **FR-4.1:** Benutzer sieht Liste aller Workouts
- [ ] **FR-4.2:** Workouts können sortiert/gefiltert werden
- [ ] **FR-4.3:** Beim Workout sieht man alle Übungen
- [ ] **FR-4.4:** Detailansicht zeigt alle Informationen einer Übung

---

## 3. Nicht-funktionale Anforderungen

### 3.1 Performance

| Anforderung | Wert |
|-------------|------|
| **Workout laden** | < 500ms für 100+ Übungen |
| **Neue Übung hinzufügen** | Sofort sichtbar (Optimistic Update) |
| **Liste scrollen** | Smooth auf Mobil (60 FPS) |

### 3.2 Datenspeicherung

- [ ] **NFR-2.1:** Benutzer kann mindestens 100 Workouts speichern
- [ ] **NFR-2.2:** Ein Workout kann mindestens 50 Übungen haben
- [ ] **NFR-2.3:** Daten bleiben bei App-Aktualisierung erhalten

### 3.3 Usability (Benutzerfreundlichkeit)

- [ ] **NFR-3.1:** Neue Workout in maximal 30 Sekunden erstellt
- [ ] **NFR-3.2:** Übung in maximal 20 Sekunden bearbeitet
- [ ] **NFR-3.3:** Undo-Funktion für versehentliche Änderungen (optional)
- [ ] **NFR-3.4:** Bestätigung vor Löschen erforderlich

### 3.4 Mobile-spezifisch

- [ ] **NFR-4.1:** Swipe-Geste zum Löschen möglich
- [ ] **NFR-4.2:** Floating Action Button für "Neue Übung"
- [ ] **NFR-4.3:** Große Touch Targets (mindestens 44x44px)

### 3.5 Desktop-spezifisch

- [ ] **NFR-5.1:** Keyboard Shortcuts (Ctrl+N für neuer Workout)
- [ ] **NFR-5.2:** Drag & Drop zum Sortieren
- [ ] **NFR-5.3:** Rechts-Klick Kontextmenü

---

## 4. Framework Anforderungen

- [ ] **FW-1:** State Management für Workout-Liste
- [ ] **FW-2:** Form Validation für Übungs-Inputs
- [ ] **FW-3:** Undo/Redo Funktionalität
- [ ] **FW-4:** Date Picker für Workout-Datum

---

## 5. Abhängigkeiten

- **REQ-001:** PWA Foundation (für Offline-Funktionalität)
- **REQ-004:** Data Storage (für Persistent Storage)

---

## 6. Akzeptanzkriterien

- [ ] **AC-1:** Workout kann erstellt, bearbeitet, gelöscht werden
- [ ] **AC-2:** Übungen können zu Workout hinzugefügt werden
- [ ] **AC-3:** Änderungen werden sofort angezeigt
- [ ] **AC-4:** Daten bleiben nach App-Neustart erhalten
- [ ] **AC-5:** Mobil: Swipe zum Löschen funktioniert
- [ ] **AC-6:** Desktop: Keyboard Shortcuts funktionieren

---

## 7. Nicht-umfasst (Out of Scope)

- [ ] Workout-Tracking (Reps tatsächlich ausgeführt)
- [ ] Statistiken und Fortschrittsverfolgung
- [ ] Sharing von Workouts mit anderen Nutzern
- [ ] Video-Tutorials für Übungen
- [ ] Trainer-Management (für Versand zu Klienten)

---

## 8. Änderungshistorie

| Version | Datum | Autor | Änderung |
|---------|-------|-------|---------|
| 1.0.0 | 2026-04-03 | Claude | Initiale Version (bereinigt) |


# Anforderung: Lebensarchiv & Datenspeicherung

**Status:** 🟢 DRAFT  
**ID:** REQ-003  
**Version:** 1.0.0  
**Letzte Aktualisierung:** 2026-04-12  
**Modul:** Data / Stories  
**Priorität:** High  

---

## 1. Zusammenfassung

Alle Antworten des Benutzers werden dauerhaft lokal gespeichert und als persönliches Lebensarchiv dargestellt. Kein Account oder Server erforderlich – die Daten gehören dem Benutzer und bleiben auf seinem Gerät.

---

## 2. Datenspeicherung

### 2.1 Speicherstrategie

| Datenmenge | Speicher | Begründung |
|-----------|---------|-----------|
| Antworten (Text) | `localStorage` | Einfach, kein Setup |
| Medienanhänge (Bilder) | `IndexedDB` | Für größere Binärdaten |
| App-Einstellungen | `localStorage` | Klein, kein Binary |

### 2.2 Datenstruktur (Speicherformat)

```typescript
interface Answer {
  id: string
  questionId: string
  categoryId: string
  value: string | number       // Antwortinhalt
  createdAt: string            // ISO 8601
  updatedAt: string
}

interface Profile {
  id: string
  name: string
  birthYear?: number
  createdAt: string
}

interface AppState {
  profile: Profile | null
  answers: Record<string, Answer>   // key: questionId
}
```

---

## 3. Funktionale Anforderungen

### 3.1 Speichern

- [ ] **FR-3.1:** Antwort wird sofort beim Verlassen des Eingabefeldes gespeichert (Auto-Save)
- [ ] **FR-3.2:** Kein manueller "Speichern"-Button nötig
- [ ] **FR-3.3:** Datenverlust bei Browser-Schließen ist ausgeschlossen
- [ ] **FR-3.4:** Antworten können nachträglich bearbeitet werden

### 3.2 Lebensarchiv-Ansicht

- [ ] **FR-3.5:** Eigene Ansicht zeigt alle beantworteten Fragen
- [ ] **FR-3.6:** Fragen sind nach Kategorie gruppiert
- [ ] **FR-3.7:** Jede Antwort zeigt Datum der Erstellung
- [ ] **FR-3.8:** Antworten können direkt in der Archiv-Ansicht bearbeitet werden

### 3.3 Datenverwaltung

- [ ] **FR-3.9:** Benutzer kann alle Daten löschen (mit Bestätigung)
- [ ] **FR-3.10:** Daten können als JSON exportiert werden (Backup)
- [ ] **FR-3.11:** Exportiertes JSON kann wieder importiert werden

---

## 4. Nicht-funktionale Anforderungen

| Anforderung | Wert |
|-------------|------|
| **Datenschutz** | Alle Daten verbleiben auf dem Gerät des Benutzers |
| **Datenverfügbarkeit** | Auch ohne Internetverbindung vollständig nutzbar |
| **Datengröße** | localStorage-Limit beachten (~5 MB); bei Überschreitung auf IndexedDB migrieren |
| **Persistenz** | Daten überstehen Browser-Neustart und App-Updates |
| **Rückwärtskompatibilität** | Jedes App-Update liest bestehende Benutzerdaten ohne Datenverlust |

---

## 4a. Rückwärtskompatibilität (Breaking-Change-Verbot)

Alle Updates müssen abwärtskompatibel zum bestehenden Speicherformat sein, sodass Benutzer ihre Daten nach einem Update vollständig und verlustfrei weiter nutzen können.

### Regeln für Schema-Änderungen

| Änderung | Erlaubt? | Begründung |
|----------|----------|------------|
| Neues optionales Feld hinzufügen | ✅ Ja | Alte Daten lesen fehlende Felder als `undefined` |
| Bestehendes Feld umbenennen | ❌ Nein | Bricht vorhandene gespeicherte Werte |
| Bestehendes Feld entfernen | ❌ Nein | Datenverlust für Nutzer mit alten Daten |
| Typ eines Feldes ändern | ❌ Nein | Führt zu Laufzeitfehlern |
| Neue Pflichtfelder ohne Default | ❌ Nein | Alte Datensätze wären ungültig |

### Umsetzung

- **Neue Felder** werden stets als `optional` (`?`) im TypeScript-Interface deklariert.
- **Lesecode** verwendet defensive Defaults: `answer.audioId ?? undefined`, `profile.birthYear ?? null`.
- **Backup-Format** enthält ein `version`-Feld; beim Import wird die Version geprüft und ältere Strukturen werden mit Defaults aufgefüllt (keine harten Fehler).
- **localStorage-Schlüssel** (`rm-state`) und **IndexedDB-Stores** (`rm-images`, `rm-audio`) werden nicht umbenannt.
- Vor jeder Änderung am Datenformat: Prüfen, ob ein Migrations-Schritt im Import-Handler nötig ist.

---

## 5. Akzeptanzkriterien

- [ ] Antwort eingeben → App schließen → App wieder öffnen → Antwort ist noch da
- [ ] Archiv-Ansicht zeigt alle Antworten gegliedert nach Kategorie
- [ ] Benutzer kann eine Antwort bearbeiten und der neue Wert wird gespeichert
- [ ] "Alle Daten löschen" entfernt tatsächlich alle Einträge aus localStorage

---

## 6. Änderungshistorie

| Version | Datum | Autor | Änderung |
|---------|-------|-------|---------|
| 1.1.0 | 2026-04-12 | Claude | Abschnitt 4a: Rückwärtskompatibilität + Breaking-Change-Verbot hinzugefügt |
| 1.0.0 | 2026-04-10 | Claude | Initiale Version |

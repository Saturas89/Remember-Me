# Anforderung: Frage-Engine & Fragenkatalog

**Status:** 🟢 DRAFT  
**ID:** REQ-002  
**Version:** 1.0.0  
**Letzte Aktualisierung:** 2026-04-10  
**Modul:** Questions  
**Priorität:** High  

---

## 1. Zusammenfassung

Die App führt den Benutzer spielerisch durch einen Fragenkatalog in thematischen Kategorien. Jede Frage wird einzeln präsentiert (Karten-Format). Der Benutzer beantwortet sie in seinem eigenen Tempo. Bereits beantwortete Fragen sind sichtbar; man kann jederzeit pausieren und weitermachen.

---

## 2. Fragenkategorien

| ID | Kategorie | Beschreibung | Frageanzahl (Ziel) |
|----|-----------|-------------|-------------------|
| `childhood` | Kindheit & Jugend | Frühe Erinnerungen, Heimat, Schule, Freundschaften | 20 |
| `family` | Familie & Beziehungen | Eltern, Geschwister, Partnerschaft, eigene Kinder | 20 |
| `career` | Beruf & Leidenschaften | Arbeit, Hobbies, Talente, Träume | 15 |
| `values` | Werte & Überzeugungen | Lebensprinzipien, Glaube, Weltanschauung | 15 |
| `memories` | Erinnerungen & Erlebnisse | Schlüsselmomente, Reisen, prägende Ereignisse | 20 |
| `legacy` | Wünsche & Vermächtnis | Ratschläge, letzte Worte, Wünsche für die Zukunft | 10 |

---

## 3. Fragetypen

| Typ | Beschreibung | Beispiel |
|-----|-------------|---------|
| `text` | Freitext-Antwort (kurz oder lang) | "Wo bist du aufgewachsen?" |
| `choice` | Auswahl aus vorgegebenen Optionen | "Warst du eher Stadtmensch oder Landmensch?" |
| `scale` | Skala 1–5 mit Beschriftung | "Wie wichtig war dir Familie auf einer Skala von 1–5?" |
| `year` | Jahreszahl eingeben | "In welchem Jahr hast du geheiratet?" |

---

## 4. Funktionale Anforderungen

### 4.1 Frage-Flow

- [ ] **FR-2.1:** Kategorien werden als Kacheln auf der Startseite angezeigt
- [ ] **FR-2.2:** Klick auf Kategorie öffnet den Frage-Flow dieser Kategorie
- [ ] **FR-2.3:** Fragen werden einzeln als Karte präsentiert
- [ ] **FR-2.4:** Fortschrittsbalken zeigt aktuelle Position (z.B. "Frage 3 von 20")
- [ ] **FR-2.5:** Benutzer kann Frage überspringen (ohne Antwort)
- [ ] **FR-2.6:** Benutzer kann zur vorherigen Frage zurückgehen
- [ ] **FR-2.7:** Bereits beantwortete Fragen sind markiert
- [ ] **FR-2.8:** Beim erneuten Öffnen einer Kategorie setzt die App dort fort, wo man aufgehört hat

### 4.2 Fragenkatalog

- [ ] **FR-2.9:** Mindestens 20 Fragen pro Kategorie im Basiskatalog (DE)
- [ ] **FR-2.10:** Fragen sind in der Datenstruktur typsicher definiert (`Question` Type)
- [ ] **FR-2.11:** Fragen haben optionale Hilfstexte / Beispiele

### 4.3 Spielerische Elemente

- [ ] **FR-2.12:** Kategorien zeigen Fortschritt in % an (z.B. "60% beantwortet")
- [ ] **FR-2.13:** Abgeschlossene Kategorien erhalten ein visuelles "Fertig"-Signal
- [ ] **FR-2.14:** Motivierende Zwischenmeldungen nach bestimmten Meilensteinen

---

## 5. Akzeptanzkriterien

- [ ] Benutzer kann eine Kategorie öffnen und Fragen beantworten
- [ ] Fortschritt wird korrekt angezeigt und bleibt nach App-Neustart erhalten
- [ ] Alle 6 Kategorien sind verfügbar mit je mindestens 10 Fragen
- [ ] Fragen-Flow ist auf Mobile und Desktop gleich gut bedienbar

---

## 6. Datenstruktur

```typescript
type QuestionType = 'text' | 'choice' | 'scale' | 'year'

interface Question {
  id: string
  categoryId: string
  type: QuestionType
  text: string
  helpText?: string
  options?: string[]        // für type: 'choice'
  scaleMin?: string         // für type: 'scale'
  scaleMax?: string
}

interface Category {
  id: string
  title: string
  description: string
  emoji: string
  questions: Question[]
}
```

---

## 7. Änderungshistorie

| Version | Datum | Autor | Änderung |
|---------|-------|-------|---------|
| 1.0.0 | 2026-04-10 | Claude | Initiale Version |

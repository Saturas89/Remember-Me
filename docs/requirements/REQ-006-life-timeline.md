# Anforderung: Lebenszeitlinie

**Status:** 🟡 PLANNED  
**ID:** REQ-006  
**Version:** 1.0.0  
**Letzte Aktualisierung:** 2026-04-12  
**Modul:** Timeline  
**Priorität:** High  
**Geplante Version:** v1.7.0  

---

## 1. Zusammenfassung

Eine visuelle, chronologische Zeitlinie aller gespeicherten Erlebnisse, Antworten und Fotos. Die Lebenszeitlinie macht das Lebensarchiv greifbar und emotional erlebbar – man sieht sein Leben als Geschichte, nicht als Fragenliste.

---

## 2. Kernidee & User Story

> „Als Benutzer möchte ich meine Erinnerungen und Fotos auf einer Zeitlinie sehen, damit ich meinen Lebensweg als Geschichte nacherleben und mit Familie teilen kann."

Ein Benutzer öffnet die Timeline und sieht:
- Seinen Lebenslauf als vertikale Linie von früh (oben oder unten) bis heute
- Jedes beantwortete Erlebnis als Karte mit Datum, Text und ggf. Foto
- Jahres- und Dekaden-Markierungen als Orientierungspunkte
- Fotos als Thumbnail-Vorschau, klickbar zur Vergrößerung

---

## 3. Funktionale Anforderungen

### 3.1 Zeitlinie-Darstellung

- [ ] **FR-6.1:** Neue Hauptansicht „Zeitlinie" in der BottomNav (neuer Tab: 🕐 oder 📅)
- [ ] **FR-6.2:** Vertikale Zeitlinie mit Einträgen in chronologischer Reihenfolge (neueste oben)
- [ ] **FR-6.3:** Jahres-Markierungen trennen die Einträge visuell nach Jahr
- [ ] **FR-6.4:** Jede Karte zeigt: Datum, Frage/Titel, Antworttext (gekürzt), ggf. Foto-Thumbnail
- [ ] **FR-6.5:** Tippen auf eine Karte öffnet die vollständige Antwort in einem Detailblatt (Bottom Sheet oder Modal)
- [ ] **FR-6.6:** Fotos in der Detailansicht sind als Lightbox vergrößerbar

### 3.2 Ereignisdatum & ungefähres Alter

Die Timeline basiert auf einem Ereignisdatum – nicht dem Eingabedatum. Für bestehende Einträge wird `createdAt` als Fallback verwendet.

- [ ] **FR-6.7:** Jede Antwort kann optional ein `eventDate` (Jahreszahl oder Datum) erhalten
- [ ] **FR-6.8:** Im QuizView und im Archiv-Edit-Modus ist `eventDate` editierbar
- [ ] **FR-6.9:** Einträge ohne `eventDate` werden mit dem Eingabedatum (`createdAt`) einsortiert und visuell als „Eingabedatum" gekennzeichnet

**Optionales ungefähres Alter:**

- [ ] **FR-6.20:** Jeder Eintrag kann zusätzlich oder alternativ ein `approxAge` (ungefähre Lebensjahre zum Zeitpunkt des Erlebnisses) erhalten, z. B. „ca. 8 Jahre alt"
- [ ] **FR-6.21:** Falls `profile.birthYear` bekannt ist, wird `approxAge` automatisch aus `eventDate − birthYear` vorgeschlagen und kann manuell korrigiert werden
- [ ] **FR-6.22:** Falls kein `birthYear` bekannt ist, kann `approxAge` frei eingetragen werden (Ganzzahl, Eingabefeld)
- [ ] **FR-6.23:** Auf der Zeitlinie wird das ungefähre Alter als Zusatzinformation angezeigt: z. B. „Sommer 1975 · ca. 8 Jahre alt"
- [ ] **FR-6.24:** Bei Einträgen ohne exaktes Datum aber mit `approxAge` und bekanntem `birthYear` wird `birthYear + approxAge` als Sortierjahr verwendet

### 3.3 Filterung & Navigation

- [ ] **FR-6.10:** Filter nach Kategorie (Kindheit, Familie, Beruf …)
- [ ] **FR-6.11:** Jahres-Schnellnavigation: Auswahl eines Jahres scrollt direkt dorthin
- [ ] **FR-6.12:** Suche/Filter-Chip: „Nur mit Fotos" zeigt ausschließlich Einträge mit Bildanhängen
- [ ] **FR-6.13:** Freundes-Beiträge können optional ein- oder ausgeblendet werden

### 3.4 Visuelle Gestaltung

- [ ] **FR-6.14:** Fotos dominieren den Eintrag wenn vorhanden (großes Thumbnail oder Cover-Bild)
- [ ] **FR-6.15:** Einträge ohne Foto werden mit einem Kategorie-Emoji als visuelles Anker-Element dargestellt
- [ ] **FR-6.16:** Die Zeitlinie ist als „Linie mit Punkten" gestaltet (Milestone-Design)
- [ ] **FR-6.17:** Alle 4 Themes werden unterstützt

### 3.5 Performance

- [ ] **FR-6.18:** Virtuelles Scrolling oder Pagination für große Eintragsmengen (> 50 Einträge)
- [ ] **FR-6.19:** Fotos werden lazy geladen (Intersection Observer)

---

## 4. Datenmodell-Erweiterung

```typescript
interface Answer {
  // (bestehende Felder)
  id: string
  questionId: string
  categoryId: string
  value: string
  imageIds?: string[]
  createdAt: string    // ISO 8601 – Zeitpunkt der Eingabe
  updatedAt: string
  // NEU:
  eventDate?: string   // ISO 8601-Datum oder nur Jahr ('YYYY' oder 'YYYY-MM-DD')
                       // Optional: Zeitpunkt des beschriebenen Erlebnisses
  approxAge?: number   // Ungefähres Alter des Benutzers zum Zeitpunkt des Erlebnisses
                       // Wird auf der Zeitlinie angezeigt: „ca. 8 Jahre alt"
}
```

Beide Erweiterungen sind **backward-compatible** (optionale Felder). Bestehende Antworten ohne `eventDate` / `approxAge` verwenden `createdAt` als Fallback und zeigen kein Alter an.

---

## 5. Architektur

### 5.1 Neue Dateien

```
src/
├── views/
│   └── TimelineView.tsx          # Hauptansicht der Zeitlinie
├── components/
│   ├── TimelineEntry.tsx          # Einzelne Karte auf der Zeitlinie
│   ├── TimelineYearDivider.tsx    # Jahres-Trennmarkierung
│   └── TimelineDetail.tsx         # Bottom Sheet / Detailansicht
└── utils/
    └── timeline.ts                # Sortierfunktionen, Gruppierung nach Jahr
```

### 5.2 Datenfluss

```
useAnswers() → answers (Record<questionId, Answer>)
    ↓
timeline.ts: sortAndGroup(answers, friendAnswers, filters)
    ↓
TimelineView → [TimelineYearDivider, TimelineEntry] × n
    ↓
TimelineEntry (tap) → TimelineDetail (Bottom Sheet)
    ↓
ImageAttachment (Lightbox)
```

### 5.3 Sortierlogik

```typescript
function getTimelineDate(answer: Answer): string {
  return answer.eventDate ?? answer.createdAt
}

function sortForTimeline(entries: TimelineItem[]): TimelineItem[] {
  return entries.sort((a, b) =>
    new Date(getTimelineDate(b.answer)).getTime() -
    new Date(getTimelineDate(a.answer)).getTime()
  )
}
```

---

## 6. UX-Konzept

```
┌─────────────────────────────┐
│  Zeitlinie           ≡ ▼   │  ← Filter-Icon
├─────────────────────────────┤
│          2024               │  ← Jahres-Divider
├─────────────────────────────┤
│ 🧒  März 2024               │
│ Wo bist du aufgewachsen?    │
│ „Ich wuchs in München au…"  │
│ [Foto-Thumbnail]            │
├────────────────────────────┤
│ 💼  Januar 2024             │
│ Was war dein erster Job?    │
│ „Mein erster Job war beim…" │
├─────────────────────────────┤
│          2023               │  ← Jahres-Divider
├─────────────────────────────┤
│  …                          │
└─────────────────────────────┘
```

---

## 7. Nicht-funktionale Anforderungen

| Anforderung | Wert |
|-------------|------|
| **Performance** | Initiales Rendern < 200ms, kein Jank beim Scrollen |
| **Offline** | Vollständig offline nutzbar (kein Netzwerk nötig) |
| **Accessibility** | Zeitlinie mit Screenreader navigierbar (`aria-label` pro Eintrag) |
| **Mobile-first** | Optimiert für 390px Viewport (iPhone 15), touch-freundliche Tap-Targets |

---

## 8. Akzeptanzkriterien

- [ ] Zeitlinie zeigt alle beantworteten Fragen in chronologischer Reihenfolge
- [ ] Jahres-Markierungen trennen Einträge korrekt
- [ ] Fotos erscheinen als Thumbnail und sind per Tap vergrößerbar
- [ ] Filter nach Kategorie blendet korrekte Einträge ein/aus
- [ ] `eventDate` kann im QuizView gesetzt werden und wird auf der Timeline verwendet
- [ ] Bestehende Daten ohne `eventDate` erscheinen mit `createdAt` und Kennzeichnung
- [ ] `approxAge` wird angezeigt wenn vorhanden; bei bekanntem Geburtsjahr automatisch vorgeschlagen
- [ ] Einträge mit nur `approxAge` (kein `eventDate`) werden über `birthYear + approxAge` einsortiert
- [ ] Alle 4 Themes werden korrekt dargestellt

---

## 9. Änderungshistorie

| Version | Datum | Autor | Änderung |
|---------|-------|-------|---------|
| 1.0.0 | 2026-04-12 | Claude | Initiale Version |

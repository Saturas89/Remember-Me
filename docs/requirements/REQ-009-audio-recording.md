# Anforderung: Audio-Aufnahme & Transkription

**Status:** ✔️ COMPLETED  
**ID:** REQ-009  
**Version:** 1.3.0  
**Letzte Aktualisierung:** 2026-04-17  
**Modul:** Input / Media  
**Priorität:** High  

---

## 1. Zusammenfassung

Statt Fragen zu tippen, können Benutzer ihre Antworten **einsprechen**. Die Aufnahme wird **immer transkribiert** und der Text dauerhaft im Datenmodell gespeichert – als Basis für spätere Features wie Suche oder KI-Auswertung. Das Speichern der Originalton-Datei ist **optional**: Der Benutzer entscheidet im Vorschau-Screen, ob die Audio-Datei zusätzlich zum Transkript gespeichert werden soll (Standard: deaktiviert).

Besonders für ältere Nutzer oder Menschen, die beim Erzählen freier sprechen als beim Schreiben, ist dies ein niedrigschwelliger Einstieg.

---

## 2. Kernidee & User Story

> „Als Benutzer möchte ich eine Frage einfach beantworten können, indem ich darüber spreche – damit meine Enkel nicht nur meine Worte lesen, sondern auch meine Stimme hören."

---

## 3. Funktionale Anforderungen

### 3.1 Aufnahme

- [x] **FR-9.1:** Jede Textfrage im QuizView erhält einen „🎙 Aufnehmen"-Button als Alternative zur Tastatur
- [x] **FR-9.2:** Tippen auf den Button startet die Aufnahme (nach einmaliger Mikrofon-Genehmigung des Browsers)
- [x] **FR-9.3:** Während der Aufnahme wird ein animierter Pegel / Aufnahme-Indikator angezeigt
- [x] **FR-9.4:** Ein „⏹ Stop"-Button beendet die Aufnahme
- [x] **FR-9.5:** Maximale Aufnahmedauer: 10 Minuten (danach automatischer Stop mit Hinweis)
- [x] **FR-9.6:** Die Aufnahme kann vor dem Speichern abgehört werden (inline Audio-Player)
- [x] **FR-9.7:** Aufnahme kann vor dem Speichern verworfen und neu gestartet werden

### 3.2 Transkription

- [x] **FR-9.8:** Nach dem Stop wird die Aufnahme automatisch transkribiert (Web Speech API)
- [x] **FR-9.9:** Die Transkription erscheint als bearbeitbarer Text im bestehenden Textfeld
- [x] **FR-9.10:** Der Benutzer kann den transkribierten Text korrigieren, bevor er speichert
- [x] **FR-9.11:** Falls keine Transkription verfügbar ist (Browser ohne Unterstützung), wird der Text-Eingang leer gelassen – der Benutzer kann manuell eintippen oder die Antwort nur als Audio speichern
- [x] **FR-9.12:** Transkriptionssprache: Deutsch als Standard (`de-DE`)

### 3.3 Speicherung

- [x] **FR-9.13:** Originalton wird **optional** als `audio/webm` (oder `audio/mp4` auf iOS) in IndexedDB gespeichert – nur wenn der Benutzer die Checkbox „🗂 Aufnahme als Audio-Datei speichern" aktiviert (Standard: deaktiviert)
- [x] **FR-9.13b:** **Transkription wird immer gespeichert** (Feld `audioTranscript` in `Answer`) – unabhängig davon, ob der Originalton gespeichert wird
- [x] **FR-9.14:** Neue Felder in `Answer`: `audioId?: string`, `audioTranscribedAt?: string`, `audioTranscript?: string`

### 3.4 Wiedergabe im Archiv

- [x] **FR-9.17:** Im Archiv-Eintrag erscheint ein kompakter Audio-Player, falls `audioId` vorhanden
- [x] **FR-9.17b:** Ein Eintrag erscheint im Archiv sobald er Inhalt hat: Text, Foto, Video, Audio-Datei **oder** Transkription – nicht nur bei Text/Foto
- [x] **FR-9.17c:** Fortschritts-Zähler der Kategorie zählt Aufnahmen (audioId oder audioTranscript) als beantwortete Fragen
- [x] **FR-9.18:** Player zeigt: Playback-Button, Laufzeit, Fortschrittsbalken
- [x] **FR-9.19:** Audio kann gelöscht werden (mit Bestätigung) – die Textantwort bleibt erhalten

### 3.5 Backup & Export

- [x] **FR-9.22:** Audio-Blob wird im ZIP-Archiv-Export (`buildMemoryArchive`) gesichert, wenn `audioId` gesetzt ist
- [x] **FR-9.23:** Transkript (`audioTranscript`) ist im JSON-Backup und im Markdown-Export enthalten – auch ohne Audio-Datei
- [x] **FR-9.24:** Markdown-Export nutzt `audioTranscript` als Antworttext wenn `value` leer ist; zeigt Transkript als Blockquote wenn beide vorhanden und unterschiedlich
- [x] **FR-9.25:** JSON-Backup allein enthält keine Audio-Blobs; der vollständige ZIP-Export (`Erinnerungs-Archiv`) sichert alle Mediendateien

### 3.6 Archiv-Edit-Modus

- [x] **FR-9.20:** Im Edit-Modus kann eine neue Audio-Aufnahme zu einem bestehenden Eintrag hinzugefügt oder die vorhandene ersetzt werden
- [x] **FR-9.21:** Bei Neuaufnahme mit vorhandenem Text erscheint eine Inline-Auswahl: „🆕 Neue Transkription" oder „💾 Bisherigen Text behalten". Ohne bestehenden Text wird die Transkription automatisch übernommen.

### 3.7 Freunde-Antwortbereich (FriendAnswerView)

- [x] **FR-9.26:** Freunde können Fragen über den Eingeladenen ebenfalls per Sprachaufnahme beantworten – über dieselbe `MediaCapture`/`QuestionCard`-Komponentenkette wie der eigene Quiz-Bereich
- [x] **FR-9.27:** Textwahl-Verhalten bei Neuaufnahme (FR-9.21) gilt auch im Freunde-Bereich: bei vorhandenem Text erscheint die Inline-Auswahl
- [x] **FR-9.28:** Audio-Blobs aus Freundes-Antworten werden in den ZIP-Archiv-Export (`buildFriendAnswerArchive`) eingebunden, wenn der Freund die Checkbox aktiviert hat
- [x] **FR-9.29:** Transkript-Text (Checkbox deaktiviert) wird als `value` der Antwort übermittelt – kein gesondertes `audioTranscript`-Feld in `FriendAnswer`

---

## 4. Technische Architektur

### 4.1 Browser-APIs

| Funktion | API | Verfügbarkeit |
|---------|-----|--------------|
| Mikrofon-Aufnahme | `MediaRecorder` API | ✅ Alle modernen Browser |
| Echtzeit-Transkription | `SpeechRecognition` / `webkitSpeechRecognition` | ⚠️ Chrome/Edge/Android, eingeschränkt auf iOS Safari |
| Audio-Blob speichern | IndexedDB (analog zur `useImageStore`-Infrastruktur) | ✅ |

### 4.2 Fallback-Strategie

```
Aufnahme starten
    ↓
MediaRecorder: Audio aufnehmen
    ↓
SpeechRecognition verfügbar?
  ├── Ja  → Echtzeit-Transkription während Aufnahme → audioTranscript immer gespeichert
  └── Nein → Hinweis: "Transkription nicht verfügbar" → Benutzer kann manuell eingeben
    ↓
Vorschau: "🗂 Aufnahme als Audio-Datei speichern?" (Checkbox, Standard: aus)
  ├── Ja  → Blob in IndexedDB → audioId generieren → audioId + audioTranscript in Answer
  └── Nein → Nur audioTranscript in Answer (kein audioId)
```

### 4.3 Implementierte Dateien

```
src/
├── hooks/
│   ├── useAudioRecorder.ts      # MediaRecorder-Wrapper, Aufnahme-Zustand
│   └── useAudioStore.ts         # IndexedDB-Speicherung/Abruf von Audio-Blobs
├── components/
│   ├── AudioRecorder.tsx        # Aufnahme-UI (Button, Pegel, Stop, Preview, Checkbox)
│   ├── AudioPlayer.tsx          # Kompakter Player für Archiv/Quiz
│   └── MediaCapture.tsx         # Gemeinsame Medien-Aufnahme-Komponente
```

### 4.4 Datenmodell-Erweiterung

```typescript
interface Answer {
  // (bestehende Felder unverändert)
  id: string
  questionId: string
  categoryId: string
  value: string           // Textantwort (aus Transkription oder manuell)
  imageIds?: string[]
  videoIds?: string[]
  createdAt: string
  updatedAt: string
  eventDate?: string
  importSource?: { ... }
  // Audio:
  audioId?: string             // Verweis auf Audio-Blob in IndexedDB – nur wenn Benutzer Audio-Datei speichern gewählt hat
  audioTranscribedAt?: string  // ISO 8601 – Zeitpunkt der Transkription
  audioTranscript?: string     // Transkriptionstext – immer gespeichert wenn Aufnahme gemacht wurde
}
```

IndexedDB-Store für Audio:
```
'rm-audio' (store: 'audio')
└── key: audioId ('aud-{timestamp}-{random}') → value: Blob (audio/webm oder audio/mp4)
```

---

## 5. UX-Konzept

### QuizView – Fragenansicht mit Audio-Option

```
┌─────────────────────────────────┐
│ Wo bist du aufgewachsen?        │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Ich wuchs in München au…    │ │  ← Textfeld (vorausgefüllt aus Transkription)
│ └─────────────────────────────┘ │
│                                 │
│ [🎙 Aufnehmen]  [📷 Foto]       │  ← Aktions-Buttons
│                                 │
│ ──── oder Aufnahme aktiv ────── │
│                                 │
│  🔴 ● ●●● ● ●●  0:23            │  ← Pegelanimation + Laufzeit
│  [⏹ Stop]  [✕ Abbrechen]        │
└─────────────────────────────────┘
```

### Vorschau-Screen (nach Stop)

```
┌─────────────────────────────────┐
│ ▶ ━━━━━━━━━━━━━━  0:23          │  ← Inline-Player zum Abhören
│                                 │
│ Transkription:                  │
│ "Ich wuchs in München auf…"     │  ← Bearbeitbares Textfeld
│                                 │
│ ☐ 🗂 Aufnahme als Audio-Datei   │  ← Opt-in Checkbox (Standard: aus)
│    speichern                    │
│                                 │
│ [✕ Verwerfen]  [✓ Speichern]    │
└─────────────────────────────────┘
```

### Archiv-Eintrag mit Audio

```
┌─────────────────────────────────┐
│ Wo bist du aufgewachsen?        │
│ „Ich bin in München aufgewachsen│
│  und habe dort die ersten 18…"  │
│                                 │
│ ▶ ━━━━━━━━━━━━━━  2:34          │  ← Audio-Player (nur wenn audioId vorhanden)
│                                 │
│ 12. März 1985  ·  bearbeitet  ✎ 🗑 │
└─────────────────────────────────┘
```

---

## 6. Nicht-funktionale Anforderungen

| Anforderung | Wert |
|-------------|------|
| **Datenschutz** | Audio-Daten verlassen niemals das Gerät (kein Cloud-Upload, keine Transkriptions-API mit Datenweitergabe) |
| **Offline** | Aufnahme und Speicherung vollständig offline; Transkription nutzt nur lokale Browser-API |
| **Dateigröße** | Audio-Komprimierung: opus/webm ca. 6–12 KB/Sek → 10 Min ≈ 4–7 MB |
| **iOS-Kompatibilität** | `audio/mp4` (AAC) als Fallback für Safari; SpeechRecognition zeigt Fallback-Hinweis |
| **Accessibility** | Aufnahme-Button mit `aria-label`, Pegelanzeige mit `aria-live` für Laufzeit |

---

## 7. Akzeptanzkriterien

- [x] Benutzer kann eine Frage einsprechen und die Aufnahme hören, bevor er speichert
- [x] Transkription erscheint automatisch als Text (auf Chrome/Android/Desktop)
- [x] **Transkriptionstext wird immer in `Answer.audioTranscript` gespeichert** – auch wenn keine Audio-Datei gespeichert wird
- [x] Im Vorschau-Screen erscheint eine Checkbox „🗂 Aufnahme als Audio-Datei speichern" (Standard: deaktiviert)
- [x] Wenn Checkbox aktiviert: Originalton wird in IndexedDB gespeichert und ist im Archiv abspielbar
- [x] Wenn Checkbox deaktiviert: Nur Transkript wird gespeichert, kein Audio-Blob in IndexedDB
- [x] **Eintrag erscheint im Archiv sobald er irgendwelchen Inhalt hat** (Text, Foto, Video, Audio-Datei oder Transkription)
- [x] **Kategorie-Fortschritt zählt Audio-Aufnahmen als beantwortet** (auch ohne Text)
- [x] Audio-Datei bleibt auch nach App-Neustart erhalten (IndexedDB), falls gespeichert
- [x] ZIP-Export enthält Audio-Blob wenn `audioId` gesetzt; JSON-Backup enthält Transkript
- [x] Auf iOS Safari: Aufnahme funktioniert, Transkriptions-Fallback-Hinweis erscheint
- [x] Audio kann gelöscht werden ohne die Textantwort zu verlieren
- [x] 10-Minuten-Limit wird durchgesetzt
- [x] **Textwahl bei Neuaufnahme**: Wenn beim Bestätigen ein vorhandener Text und ein neues Transkript vorliegen und abweichen, erscheint eine Inline-Auswahl (Neue Transkription / Bisherigen Text behalten) – in allen Bereichen (Quiz, Archiv, Eigene Fragen, Freunde)

---

## 8. Abhängigkeiten

- IndexedDB-Infrastruktur (`useImageStore`) → als Vorbild für `useAudioStore`
- `src/types.ts`: `Answer` um `audioId`, `audioTranscribedAt`, `audioTranscript` erweitert
- `useAnswers.ts`: Audio-Löschlogik analog zur Bild-Löschlogik

---

## 9. Änderungshistorie

| Version | Datum | Autor | Änderung |
|---------|-------|-------|---------|
| 1.0.0 | 2026-04-12 | Claude | Initiale Version |
| 1.1.0 | 2026-04-17 | Claude | Transkript wird immer gespeichert (`audioTranscript`); Audio-Datei-Speicherung optional via Checkbox |
| 1.2.0 | 2026-04-17 | Claude | Archiv-Sichtbarkeit & Backup-Korrekturen: `hasContent` und `getCategoryProgress` berücksichtigen Audio; Markdown-Export zeigt Transkript |
| 1.3.0 | 2026-04-17 | Claude | Spec bereinigt: Abschnitte neu geordnet, implementierte Items als `[x]` markiert, veraltete Referenzen entfernt, Fallback-Diagramm aktualisiert |
| 1.4.0 | 2026-04-18 | Claude | FR-9.21 präzisiert (Inline-Textwahl-Dialog); Abschnitt 3.7 FriendAnswerView ergänzt (FR-9.26–29); Akzeptanzkriterium für Textwahl in allen Bereichen hinzugefügt |

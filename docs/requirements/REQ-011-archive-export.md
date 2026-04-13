# Anforderung: Erinnerungs-Archiv (ZIP-Export mit Medien + Share Sheet)

**Status:** ✔️ COMPLETED  
**ID:** REQ-011  
**Version:** 1.0.0  
**Letzte Aktualisierung:** 2026-04-12  
**Modul:** Export / UX  
**Priorität:** Medium  

---

## 1. Zusammenfassung

Nutzer können ihre gesamte Lebensgeschichte – inklusive Fotos und Sprachaufnahmen – als vollständiges ZIP-Archiv exportieren und direkt über das Share Sheet (Cloud, WhatsApp, AirDrop etc.) teilen oder lokal speichern. Das Backup-Erlebnis fühlt sich nicht wie eine technische Aufgabe an, sondern wie das Bewahren von etwas Wertvollem.

---

## 2. ZIP-Struktur

```
remember-me-{name}-archiv-{datum}.zip
├── memories.json          ← vollständige Backup-JSON (wiederherstellbar)
├── photos/
│   ├── img-{id}.jpg       ← alle gespeicherten Fotos (JPEG)
│   └── ...
├── audio/
│   ├── aud-{id}.webm      ← Sprachaufnahmen (WebM oder MP4 je nach Browser)
│   └── ...
└── videos/
    ├── vid-{id}.mp4       ← Video-Anhänge (MP4, WebM oder MOV je nach Browser)
    └── ...
```

---

## 3. Funktionale Anforderungen

### 3.1 Archiv-Erstellung

- **FR-11.1:** Das Archiv wird vollständig im Browser erstellt – kein Server, kein Upload.
- **FR-11.2:** Die `memories.json` entspricht dem bestehenden Backup-Format (`$type: "remember-me-backup"`) und ist wiederherstellbar.
- **FR-11.3:** Alle Fotos aus IndexedDB werden als JPEG in `/photos` gespeichert.
- **FR-11.4:** Alle Sprachaufnahmen aus IndexedDB werden in `/audio` gespeichert (Dateiendung nach MIME-Type: `.webm` oder `.mp4`).
- **FR-11.4b:** Alle Video-Anhänge aus IndexedDB werden in `/videos` gespeichert (Dateiendung: `.mp4`, `.webm` oder `.mov`). Siehe REQ-012.
- **FR-11.5:** Während der Erstellung wird ein Fortschrittsbalken mit wechselndem Step-Text angezeigt.

### 3.2 Speichern & Teilen

- **FR-11.6:** Lokales Speichern via Browser-Download (`<a download>`).
- **FR-11.7:** Teilen via Web Share API (Level 2 – Files):
  - Primär: `navigator.share({ files: [zipFile] })` → öffnet das native Share Sheet
  - Fallback: wenn `canShare({ files })` nicht unterstützt wird oder fehlschlägt → Download
  - AbortError (Nutzer bricht ab) → kein Fallback
- **FR-11.8:** Der „Teilen"-Button wird nur angezeigt, wenn `'share' in navigator` (Mobile/Desktop-Test).

### 3.3 UX – Inline Card Pattern

- **FR-11.9:** Die gesamte Export-Interaktion läuft **ohne Navigation** und **ohne Modal** in einer Inline-Card auf dem Profil-Tab ab.
- **FR-11.10:** Die Card zeigt im Idle-State eine Zusammenfassung: Anzahl Antworten, Fotos, Aufnahmen.
- **FR-11.11:** Ein einziger Button-Klick startet die Archivierung sofort.
- **FR-11.12:** Nach Fertigstellung: Größenangabe (MB), Medien-Statistik, zwei Buttons (Speichern / Teilen).

---

## 4. UX-Prinzip: „Ich sichere etwas Wertvolles"

| Merkmal | Umsetzung |
|---------|-----------|
| Emotionale Sprache | „Sichere deine Lebensgeschichte als vollständiges Paket – etwas das bleibt." |
| Kein Aufwand | 1 Klick → sofortiger Start, keine Bestätigungs-Dialoge |
| Visuelles Feedback | Animiertes Logo, Schritt-für-Schritt-Text, Fortschrittsbalken |
| Erfolgs-Ritual | Gradient-Checkmark, Größenangabe, dann Teilen-Optionen |
| Gradient-Border | Die Card ist visuell hervorgehoben durch Logo-Gradient-Rahmen |

---

## 5. Nicht-funktionale Anforderungen

| Anforderung | Wert |
|-------------|------|
| **Performance** | ZIP-Erstellung blockiert nicht den UI-Thread (async/await) |
| **Dateigröße** | Abhängig von Medienanzahl; bei reinen Textdaten < 100 KB |
| **Kompression** | DEFLATE Level 6 (JSZip) |
| **Kompatibilität** | Web Share API (files): iOS Safari 15+, Android Chrome 75+, Desktop Chrome 89+; Fallback: alle Browser |
| **Rückwärtskompatibilität** | `memories.json` entspricht Backup-Format v2 – importierbar in bestehende App-Versionen |

---

## 6. Akzeptanzkriterien

- [ ] Klick auf „Archiv erstellen" → Fortschrittsbalken erscheint sofort
- [ ] Fertige ZIP enthält `memories.json`, `/photos` und `/audio` mit korrekten Dateien
- [ ] „Auf Gerät speichern" löst Download aus
- [ ] „Teilen" öffnet auf iOS/Android das native Share Sheet mit der ZIP-Datei
- [ ] Auf Desktop ohne Share-API: „Teilen" fällt auf Download zurück
- [ ] Die Card navigiert zu keiner anderen View

---

## 7. Änderungshistorie

| Version | Datum | Autor | Änderung |
|---------|-------|-------|---------|
| 1.0.0 | 2026-04-12 | Claude | Initiale Version – vollständig implementiert |

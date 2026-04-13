# Anforderung: Video-Anhänge

**Status:** ✔️ COMPLETED  
**ID:** REQ-012  
**Version:** 1.0.0  
**Letzte Aktualisierung:** 2026-04-13  
**Modul:** Medien / Antworten  
**Priorität:** Medium  

---

## 1. Zusammenfassung

Nutzer können zu Text-Antworten Videos hinzufügen. Videos werden lokal im Browser (IndexedDB `rm-videos`) gespeichert, können inline abgespielt werden und sind vollständig in das Erinnerungs-Archiv (ZIP-Export) integriert.

---

## 2. Funktionale Anforderungen

### 2.1 Video hinzufügen

- **FR-12.1:** In jeder Text-Frage (QuizView) erscheint ein „🎬 Video hinzufügen"-Button unterhalb der Fotozeile.
- **FR-12.2:** Es können bis zu **3 Videos** pro Antwort angehängt werden.
- **FR-12.3:** Der Datei-Picker akzeptiert alle Videoformate (`video/*`).
- **FR-12.4:** Videos werden als Blob direkt in IndexedDB (`rm-videos`) gespeichert – keine Kompression, kein Upload.
- **FR-12.5:** Eine Antwort gilt als „beantwortet", wenn sie Text, Fotos, Videos oder eine Sprachaufnahme enthält.

### 2.2 Video-Vorschau & Wiedergabe

- **FR-12.6:** Gespeicherte Videos erscheinen als 90×90 px Thumbnails mit Play-Button-Overlay.
- **FR-12.7:** Tippen auf ein Thumbnail öffnet einen Vollbild-Lightbox-Player mit nativen Browser-Controls.
- **FR-12.8:** Die Lightbox schließt beim Tippen außerhalb des Videos oder auf das ✕-Symbol.
- **FR-12.9:** Videos sind in der QuizView (Bearbeitung) und ArchiveView (Lese-Ansicht) sichtbar.

### 2.3 Video entfernen

- **FR-12.10:** Jedes Thumbnail zeigt ein ✕-Symbol zum Entfernen.
- **FR-12.11:** Beim Entfernen wird der Blob aus IndexedDB gelöscht und die Video-ID aus der Antwort entfernt.

### 2.4 Export

- **FR-12.12:** Das Erinnerungs-Archiv (ZIP) enthält alle Videos im Ordner `/videos/` als `vid-{id}.{ext}`.
- **FR-12.13:** Unterstützte Ausgabeformate: `.mp4`, `.webm`, `.mov` (je nach MIME-Type des gespeicherten Blobs).
- **FR-12.14:** Der Markdown-Export vermerkt Videos pro Antwort: `_🎬 N Video(s) · im Archiv_`.
- **FR-12.15:** Das Archiv-Fortschrittssystem zeigt während des Video-Exports einen eigenen Step-Text.
- **FR-12.16:** Die ArchiveExportCard zeigt im Idle-State einen `🎬 N Videos`-Chip.

---

## 3. Nicht-funktionale Anforderungen

| Anforderung | Wert |
|-------------|------|
| **Speicher** | IndexedDB `rm-videos` – kein Größenlimit (Browser-Quota gilt) |
| **Formate** | Alle via `video/*` vom Browser unterstützten Formate |
| **Kompression** | Keine (Videos werden 1:1 gespeichert) |
| **Rückwärtskompatibilität** | `videoIds` ist ein optionales Feld im `Answer`-Objekt – bestehende Backups sind vollständig kompatibel |
| **Performance** | Object URLs werden pro Thumbnail/Lightbox einzeln erstellt und beim Unmount revoked |

---

## 4. Datenmodell

```ts
interface Answer {
  // ... bestehende Felder ...
  videoIds?: string[]  // IDs in IndexedDB 'rm-videos', Format: vid-{timestamp}-{rand}
}
```

---

## 5. ZIP-Struktur (Erweiterung zu REQ-011)

```
remember-me-{name}-archiv-{datum}.zip
├── memories.json
├── photos/
├── audio/
└── videos/
    ├── vid-{id}.mp4
    └── vid-{id}.webm
```

---

## 6. Akzeptanzkriterien

- [x] „🎬 Video hinzufügen" erscheint bei Text-Fragen, verschwindet ab 3 Videos
- [x] Video wird in IndexedDB gespeichert und als Thumbnail angezeigt
- [x] Tippen auf Thumbnail öffnet Vollbild-Player
- [x] ✕ entfernt Video aus IndexedDB und der Antwort
- [x] ZIP-Archiv enthält Videos im `/videos/`-Ordner
- [x] Fortschrittstext zeigt Video-Export-Status
- [x] ArchiveView zeigt Videos in Lese-Ansicht
- [x] Bestehende Backups ohne `videoIds` laden fehlerfrei

---

## 7. Änderungshistorie

| Version | Datum | Autor | Änderung |
|---------|-------|-------|---------|
| 1.0.0 | 2026-04-13 | Claude | Initiale Version – vollständig implementiert |

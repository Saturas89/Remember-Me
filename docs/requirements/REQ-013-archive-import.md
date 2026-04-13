# Anforderung: Erinnerungs-Archiv-Import (ZIP + JSON)

**Status:** ✔️ COMPLETED  
**ID:** REQ-013  
**Version:** 1.0.0  
**Letzte Aktualisierung:** 2026-04-13  
**Modul:** Import / Backup  
**Priorität:** Medium  

---

## 1. Zusammenfassung

Nutzer können ihre Erinnerungen aus einem zuvor erstellten ZIP-Archiv oder einer JSON-Backup-Datei vollständig wiederherstellen. Das ZIP-Archiv stellt neben den Textantworten auch alle Fotos, Videos und Sprachaufnahmen wieder her. Der Import läuft vollständig im Browser – kein Server, kein Upload.

---

## 2. Unterstützte Dateiformate

| Format | Erkennung | Inhalt |
|--------|-----------|--------|
| `.zip` | Dateiendung oder MIME-Type `application/zip` / `application/x-zip-compressed` | Vollständiges Archiv mit `memories.json` + Medienordner |
| `.json` | Dateiendung oder beliebiger MIME-Type (inkl. `text/plain`) | Reine Textdaten ohne Medien |

---

## 3. ZIP-Struktur (erwartetes Format)

```
remember-me-{name}-archiv-{datum}.zip
├── memories.json          ← vollständige Backup-JSON ($type: "remember-me-backup")
├── photos/
│   ├── img-{id}.jpg       ← Fotos (JPEG, base64 → data URL)
│   └── ...
├── audio/
│   ├── aud-{id}.webm      ← Sprachaufnahmen (WebM oder MP4)
│   └── ...
└── videos/
    ├── vid-{id}.mp4       ← Video-Anhänge (MP4, WebM oder MOV)
    └── ...
```

---

## 4. Funktionale Anforderungen

### 4.1 Dateiauswahl

- **FR-13.1:** Der Nutzer kann über einen Button im Profil-Tab eine Datei auswählen. Akzeptierte Typen: `.zip`, `.json`.
- **FR-13.2:** Vor dem Import wird ein Bestätigungs-Dialog angezeigt, der darauf hinweist, dass bestehende Daten überschrieben werden.

### 4.2 JSON-Import

- **FR-13.3:** Beim Import einer JSON-Datei wird der Text direkt validiert: `$type` muss `"remember-me-backup"` sein.
- **FR-13.4:** Bei ungültigem Format oder Parse-Fehler wird eine verständliche Fehlermeldung angezeigt.
- **FR-13.5:** Bei erfolgreichem JSON-Import werden alle Textdaten (Antworten, Profil, Freunde) wiederhergestellt. Medien sind nicht enthalten.

### 4.3 ZIP-Import

- **FR-13.6:** Das ZIP wird im Browser mit JSZip geöffnet – kein Server, kein Upload.
- **FR-13.7:** Die Datei `memories.json` muss im Archiv enthalten sein. Fehlt sie, wird ein beschreibender Fehler angezeigt.
- **FR-13.8:** `memories.json` wird auf `$type: "remember-me-backup"` validiert, bevor Medien importiert werden.
- **FR-13.9:** Alle Fotos aus `/photos/{id}.jpg` werden mit ihrer Original-ID in IndexedDB (`rm-images`) wiederhergestellt.
- **FR-13.10:** Alle Sprachaufnahmen aus `/audio/{id}.webm` oder `/audio/{id}.mp4` werden mit ihrer Original-ID in IndexedDB (`rm-audio`) wiederhergestellt.
- **FR-13.11:** Alle Videos aus `/videos/{id}.mp4`, `/videos/{id}.webm` oder `/videos/{id}.mov` werden mit ihrer Original-ID in IndexedDB (`rm-video`) wiederhergestellt.
- **FR-13.12:** Medien, die im Archiv nicht vorhanden sind (z. B. fehlende Einzeldateien), werden übersprungen – der Import schlägt nicht fehl.

### 4.4 Fortschritt & Feedback

- **FR-13.13:** Während des ZIP-Imports wird ein Fortschrittsbalken angezeigt mit Schritt-Text (z. B. „Foto 2 von 5…").
- **FR-13.14:** Nach erfolgreichem Import erscheint eine Bestätigungsmeldung mit Angabe der wiederhergestellten Medien (z. B. „3 Fotos, 1 Video, 2 Aufnahmen wiederhergestellt").
- **FR-13.15:** Die Erfolgsmeldung verschwindet automatisch nach 5 Sekunden.
- **FR-13.16:** Fehlermeldungen bleiben sichtbar bis der Nutzer eine neue Aktion startet.

---

## 5. Fortschrittsverteilung (ZIP-Import)

| Phase | Fortschritt |
|-------|-------------|
| Archiv öffnen | 5 % |
| Fotos wiederherstellen | 10–40 % |
| Aufnahmen wiederherstellen | 40–65 % |
| Videos wiederherstellen | 65–90 % |
| Textdaten übernehmen | 95–100 % |

---

## 6. Nicht-funktionale Anforderungen

| Anforderung | Wert |
|-------------|------|
| **Client-only** | Kein Server, kein Upload – alles im Browser |
| **Fehlertoleranz** | Fehlende Einzelmedien → überspringen, kein Abbruch |
| **Kompatibilität** | Alle modernen Browser (IndexedDB + JSZip + File API) |
| **Rückwärtskompatibilität** | Importiert alle ZIP-Archive aus REQ-011 |

---

## 7. Akzeptanzkriterien

- [ ] JSON-Import mit gültigem Backup → Textdaten wiederhergestellt, keine Fehlermeldung
- [ ] JSON-Import mit falschem `$type` → verständliche Fehlermeldung
- [ ] ZIP-Import mit vollständigem Archiv → Texte + Fotos + Audio + Videos wiederhergestellt
- [ ] ZIP ohne `memories.json` → beschreibende Fehlermeldung, kein Absturz
- [ ] Fortschrittsbalken erscheint während ZIP-Import
- [ ] Erfolgsmeldung nennt Anzahl wiederhergestellter Medien
- [ ] Import überschreibt keine Daten ohne Bestätigung

---

## 8. Änderungshistorie

| Version | Datum | Autor | Änderung |
|---------|-------|-------|---------|
| 1.0.0 | 2026-04-13 | Claude | Initiale Version – vollständig implementiert |

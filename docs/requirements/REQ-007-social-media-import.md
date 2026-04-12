# Anforderung: Social Media Import

**Status:** 🟡 PLANNED  
**ID:** REQ-007  
**Version:** 1.0.0  
**Letzte Aktualisierung:** 2026-04-12  
**Modul:** Import  
**Priorität:** Medium  
**Geplante Version:** v1.8.0  

---

## 1. Zusammenfassung

Benutzer können Erinnerungen und Fotos aus ihren sozialen Netzwerken (Facebook, Instagram) importieren und ins Lebensarchiv übernehmen. Zu jedem importierten Element kann eine persönliche Beschreibung hinzugefügt werden, bevor es gespeichert wird.

Der Import erfolgt **dateibasiert** über den offiziellen „Daten herunterladen"-Export der Plattformen. Dadurch ist kein Login, kein OAuth und kein Backend notwendig – die App bleibt vollständig offline-fähig und datenschutzfreundlich.

---

## 2. Kernidee & User Story

> „Als Benutzer möchte ich Fotos und Erinnerungen aus Facebook und Instagram importieren, damit ich mein Lebensarchiv mit bereits vorhandenen Inhalten anreichern kann, ohne alles neu tippen zu müssen."

---

## 3. Unterstützte Plattformen & Exportformate

### 3.1 Facebook

Facebook bietet unter *Einstellungen → Deine Facebook-Informationen → Deine Informationen herunterladen* einen ZIP-Export an.

Relevante Dateien im Export-ZIP:
```
your_facebook_activity/
├── posts/
│   └── your_posts_1.json        # Eigene Beiträge mit Text und Datum
├── photos_and_videos/
│   ├── your_photos.json         # Foto-Metadaten (Beschreibung, Datum, URI)
│   └── photos/                  # Bilddateien (JPEG/PNG)
└── memories/
    └── your_memories.json       # „Erinnerungen"-Feature-Daten
```

Relevante Felder in `your_photos.json`:
```json
{
  "photos_v2": [
    {
      "uri": "photos/image123.jpg",
      "creation_timestamp": 1609459200,
      "title": "Urlaub in Italien",
      "description": "Am Strand von Rimini",
      "media_metadata": {
        "photo_metadata": { "taken_timestamp": 1609459200 }
      }
    }
  ]
}
```

### 3.2 Instagram

Instagram bietet unter *Einstellungen → Dein Konto → Deine Daten herunterladen* einen ZIP-Export an.

Relevante Dateien:
```
your_instagram_activity/
├── media/
│   ├── posts/
│   │   ├── post_1.json          # Post-Metadaten
│   │   └── *.jpg / *.mp4        # Mediendateien
│   └── stories/                 # Stories (optional)
└── content/
    └── posts_1.json             # Posts mit Caption und Datum
```

Relevante Felder in `posts_1.json`:
```json
{
  "media": [
    {
      "uri": "media/posts/202101/image.jpg",
      "creation_timestamp": 1609459200,
      "title": "Mein Caption-Text hier"
    }
  ]
}
```

---

## 4. Funktionale Anforderungen

### 4.1 Import-Einstieg

- [ ] **FR-7.1:** Neuer Einstiegspunkt in der App: Profil-Ansicht → Abschnitt „Importieren" oder eigener „Import"-Tab
- [ ] **FR-7.2:** Plattform-Auswahl: Facebook / Instagram (je eigene Kachel mit Logo und Kurzanleitung)
- [ ] **FR-7.3:** Schritt-für-Schritt-Anleitung, wie der Datenexport auf der jeweiligen Plattform erstellt wird (Screenshots/Illustrationen)

### 4.2 Datei-Upload

- [ ] **FR-7.4:** Datei-Picker akzeptiert `.zip`-Dateien
- [ ] **FR-7.5:** ZIP wird im Browser entpackt (keine Serverübertragung, vollständig lokal)
- [ ] **FR-7.6:** Erkennung des Plattformtyps anhand der ZIP-Struktur (Facebook vs. Instagram)
- [ ] **FR-7.7:** Fehlerhinweis bei unbekanntem / beschädigtem ZIP-Format

### 4.3 Vorschau & Auswahl

- [ ] **FR-7.8:** Gefundene Einträge werden als Galerie/Liste zur Auswahl angezeigt
- [ ] **FR-7.9:** Jeder Eintrag zeigt: Foto-Thumbnail (falls vorhanden), Original-Beschreibung/Caption, Datum
- [ ] **FR-7.10:** Mehrfachauswahl: Checkboxen zum Anwählen gewünschter Einträge
- [ ] **FR-7.11:** „Alle auswählen" / „Keine auswählen"-Schnellaktionen
- [ ] **FR-7.12:** Filter: nur Fotos, nur Texte, Zeitraum-Filter (Jahr von–bis)

### 4.4 Beschreibung hinzufügen

- [ ] **FR-7.13:** Jeder ausgewählte Eintrag hat ein optionales Beschreibungsfeld, das der Benutzer vor dem Import ausfüllen kann
- [ ] **FR-7.14:** Die Original-Caption ist als Vorausfüllung vorgeblendet und kann bearbeitet werden
- [ ] **FR-7.15:** Kategorie-Zuordnung: Benutzer kann jeden Eintrag einer Lebenskategorie zuordnen (Standard: „Erinnerungen & Erlebnisse")
- [ ] **FR-7.16:** Das Ereignisdatum ist editierbar (wird aus dem Export-Metadatum vorbelegt, für die Lebenszeitlinie genutzt)

### 4.5 Übernahme ins Archiv

- [ ] **FR-7.17:** Import-Button überträgt alle ausgewählten Einträge als neue Antworten ins lokale Archiv
- [ ] **FR-7.18:** Fotos werden in IndexedDB gespeichert (gleicher Pfad wie manuelle Foto-Anhänge)
- [ ] **FR-7.19:** Duplikaterkennung: bereits importierte Einträge (gleicher Timestamp + Quelle) werden erkannt und markiert
- [ ] **FR-7.20:** Erfolgs-/Fehler-Zusammenfassung nach dem Import

---

## 5. Datenmodell-Erweiterung

```typescript
interface Answer {
  // (bestehende Felder)
  id: string
  questionId: string
  categoryId: string
  value: string
  imageIds?: string[]
  createdAt: string
  updatedAt: string
  eventDate?: string          // Erlebnisdatum (aus REQ-006)
  // NEU:
  importSource?: {
    platform: 'facebook' | 'instagram'
    originalId: string        // Unique ID aus dem Export (für Duplikaterkennung)
    originalCaption?: string  // Originaltext vor der Bearbeitung
    importedAt: string        // ISO 8601 – Zeitpunkt des Imports
  }
}
```

Alle Felder sind backward-compatible (optional). Bestehende Antworten werden nicht verändert.

---

## 6. Architektur

### 6.1 Neue Dateien

```
src/
├── views/
│   └── ImportView.tsx              # Hauptansicht: Plattformwahl + Flow-Steuerung
├── components/
│   ├── ImportPlatformCard.tsx       # Auswahl-Kachel (Facebook / Instagram)
│   ├── ImportPreviewGallery.tsx     # Galerie der gefundenen Einträge
│   ├── ImportEntryEditor.tsx        # Einzelner Eintrag: Thumbnail, Caption, Kategorie
│   └── ImportSummary.tsx            # Ergebnis-Ansicht nach Import
└── utils/
    ├── importFacebook.ts            # Parser für Facebook ZIP-Struktur
    ├── importInstagram.ts           # Parser für Instagram ZIP-Struktur
    └── zipReader.ts                 # Browser-seitiges ZIP-Entpacken (JSZip)
```

### 6.2 Abhängigkeit

- **JSZip** (`jszip`) – Browser-seitiges ZIP-Entpacken, keine Server-Kommunikation

### 6.3 Import-Flow

```
ImportView
    ↓  Plattform gewählt + ZIP hochgeladen
zipReader.ts: loadZip(file) → ZipEntry[]
    ↓
importFacebook.ts / importInstagram.ts
    parseEntries(zip) → ImportCandidate[]
    ImportCandidate: { id, date, caption, imagePath?, rawImageData? }
    ↓
ImportPreviewGallery: Auswahl + Beschreibungen
    ↓
useAnswers.importFromSocialMedia(selected: ImportCandidate[])
    ├── Bilder → useImageStore.storeImage() → imageId
    └── Answer { value: beschreibung, imageIds, eventDate, importSource }
```

---

## 7. Datenschutz & Sicherheit

Da der Import vollständig lokal im Browser erfolgt, werden **keine Daten an externe Server übertragen**.

| Aspekt | Umsetzung |
|--------|-----------|
| Datenverarbeitung | 100 % im Browser (Web API File Reader + JSZip) |
| Netzwerkzugriff | Keiner – kein API-Call, kein OAuth, kein Backend |
| Datenspeicherung | LocalStorage + IndexedDB (bestehende App-Infrastruktur) |
| Datenlöschung | Importierte Einträge können einzeln oder per Backup-Reset entfernt werden |
| Transparenz | In der UI klarer Hinweis: „Deine Dateien werden nur auf diesem Gerät verarbeitet" |

---

## 8. UX-Konzept

### Schritt 1: Plattform wählen
```
┌─────────────────────────────┐
│  Importieren                │
│                             │
│  ┌──────────┐ ┌──────────┐  │
│  │ 📘       │ │ 📷       │  │
│  │ Facebook │ │Instagram │  │
│  └──────────┘ └──────────┘  │
│                             │
│  So exportierst du deine    │
│  Daten aus Facebook: [▸]    │
└─────────────────────────────┘
```

### Schritt 2: ZIP hochladen + Vorschau
```
┌─────────────────────────────┐
│  ← Facebook-Import          │
│  📂 ZIP-Datei laden…        │
│                             │
│  Gefunden: 47 Fotos, 12     │
│  Beiträge                   │
│                             │
│  ☑ [Foto] Urlaub 2019       │
│    „Am Strand von…"  [✏️]   │
│  ☑ [Foto] Weihnachten 2020  │
│    Caption bearbeiten…      │
│  ☐ [Text] Status 2021-03-04 │
│    „Heute war ein guter…"   │
└─────────────────────────────┘
```

### Schritt 3: Kategorie & Beschreibung je Eintrag
```
┌─────────────────────────────┐
│  Eintrag bearbeiten         │
│  [Foto-Thumbnail]           │
│  Datum: 12. Juli 2019       │
│                             │
│  Beschreibung:              │
│  ┌─────────────────────┐   │
│  │ Am Strand von Rimini│   │
│  │ mit der Familie…    │   │
│  └─────────────────────┘   │
│                             │
│  Kategorie: [Erinnerungen ▼]│
│                             │
│         [Übernehmen]        │
└─────────────────────────────┘
```

---

## 9. Nicht-funktionale Anforderungen

| Anforderung | Wert |
|-------------|------|
| **Datenschutz** | Keine Netzwerkkommunikation, alles lokal |
| **ZIP-Größe** | Unterstützt bis zu 2 GB ZIP-Dateien (Facebook-Exports können groß sein) |
| **Bildformate** | JPEG, PNG, HEIC (mit Browser-Fallback) |
| **Offline** | Vollständig offline ausführbar |
| **Fehlertoleranz** | Unlesbare / unbekannte Einträge werden übersprungen, nicht abgebrochen |

---

## 10. Akzeptanzkriterien

- [ ] Facebook-ZIP kann hochgeladen und korrekt geparst werden (Fotos + Posts)
- [ ] Instagram-ZIP kann hochgeladen und korrekt geparst werden
- [ ] Benutzer sieht Vorschau der gefundenen Einträge vor dem Import
- [ ] Jeder Eintrag hat eine editierbare Beschreibung
- [ ] Kategorie kann je Eintrag zugewiesen werden
- [ ] Importierte Fotos erscheinen als Anhänge an der gespeicherten Antwort
- [ ] Duplikate werden erkannt und nicht doppelt importiert
- [ ] Kein Netzwerkzugriff während des Imports (prüfbar mit Browser-DevTools)
- [ ] Importierte Einträge erscheinen auf der Lebenszeitlinie (REQ-006)

---

## 11. Abhängigkeiten

| Abhängigkeit | Grund |
|--------------|-------|
| REQ-006 (Lebenszeitlinie) | `eventDate`-Feld, das vom Import befüllt wird |
| `jszip` (npm) | Browser-seitiges ZIP-Entpacken |

---

## 12. Änderungshistorie

| Version | Datum | Autor | Änderung |
|---------|-------|-------|---------|
| 1.0.0 | 2026-04-12 | Claude | Initiale Version |

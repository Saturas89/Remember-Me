# Anforderung: Biografie erzeugen

**Status:** 🟡 PLANNED  
**ID:** REQ-008  
**Version:** 1.0.0  
**Letzte Aktualisierung:** 2026-04-12  
**Modul:** Biography  
**Priorität:** High  
**Geplante Version:** v2.1.0  

---

## 1. Zusammenfassung

Aus den gespeicherten Antworten im Lebensarchiv wird per KI (Claude API) automatisch eine fertige, lesbare Lebensgeschichte generiert. Der Benutzer wählt Stil, Tonalität und Sprache – die KI fügt die Antworten zu einem zusammenhängenden, natürlichsprachlichen Text zusammen. Das Ergebnis kann vorgeschaut, bearbeitet, exportiert und geteilt werden.

---

## 2. Kernidee & User Story

> „Als Benutzer möchte ich auf Knopfdruck eine fertige Biografie aus meinen Antworten erhalten, damit ich meine Lebensgeschichte als echten Text lesen, ausdrucken und meiner Familie hinterlassen kann – ohne selbst schreiben zu müssen."

Der Unterschied zum bestehenden Markdown-Export: Dieser gibt Frage + Antwort stichpunktartig aus. Die Biografie verbindet alles zu einem **fließenden, erzählerischen Text** – wie ein Ghostwriter, der aus dem Interview eine Autobiografie schreibt.

---

## 3. Funktionale Anforderungen

### 3.1 Biografie-Generator starten

- [ ] **FR-8.1:** Neuer Einstiegspunkt im Profil oder Archiv: Button „✨ Biografie erzeugen"
- [ ] **FR-8.2:** Vor der Generierung: Konfigurationsscreen mit Stil-, Ton- und Sprachauswahl
- [ ] **FR-8.3:** Anzeige, wie viele Antworten als Grundlage verfügbar sind (und Hinweis falls < 5)

### 3.2 Stil- und Ton-Auswahl

- [ ] **FR-8.4:** Stilvorlagen (mindestens 4):

| Stil | Beschreibung | Beispiel-Eröffnung |
|------|-------------|-------------------|
| **Autobiografie** | Ich-Perspektive, ruhig und reflektiert | „Ich wurde in einer kleinen Stadt geboren…" |
| **Brief an Enkel** | Persönlich, liebevoll, direkt angesprochen | „Mein liebes Enkelkind, lass mich dir erzählen…" |
| **Erzählung** | Dritte Person, literarisch, leicht dramatisiert | „Maria wuchs in einer Zeit auf, in der…" |
| **Kurzporträt** | Kompakt, 1–2 Seiten, für Nachrufe oder Festschriften | Sachlich, chronologisch, alle Kernfakten |

- [ ] **FR-8.5:** Längen-Option: Kurz (~500 Wörter), Normal (~1.500 Wörter), Ausführlich (~3.000 Wörter)
- [ ] **FR-8.6:** Sprache wählbar: Deutsch, Englisch, weitere nach Bedarf

### 3.3 Inhalts-Auswahl

- [ ] **FR-8.7:** Kategorien ein-/ausblenden: Benutzer kann wählen, welche Lebenskategorien einfließen
- [ ] **FR-8.8:** Freundes-Perspektiven optional einschließen (erscheinen dann als Zitate o. ä.)
- [ ] **FR-8.9:** Eigene Fragen optional einschließen

### 3.4 Generierung

- [ ] **FR-8.10:** Generierung läuft über die Claude API (Anthropic) – erfordert API-Key des Benutzers oder optionalen Remember-Me-Backend-Proxy
- [ ] **FR-8.11:** Ladeanimation mit Fortschrittsanzeige während der Generierung
- [ ] **FR-8.12:** Streaming-Anzeige: Text erscheint wortweise, sobald er generiert wird (kein Warten auf Vollständigkeit)
- [ ] **FR-8.13:** Generierung kann abgebrochen werden

### 3.5 Vorschau & Bearbeitung

- [ ] **FR-8.14:** Ergebnis erscheint in einer vollbildigen Leseansicht (große Schrift, angenehmes Layout)
- [ ] **FR-8.15:** Inline-Bearbeitung: Benutzer kann den generierten Text direkt korrigieren oder ergänzen
- [ ] **FR-8.16:** „Neu generieren"-Button mit optionaler Änderung der Parameter
- [ ] **FR-8.17:** Abschnitte einzeln neu generieren (z. B. „Nur Kindheitskapitel neu schreiben")

### 3.6 Speichern & Export

- [ ] **FR-8.18:** Generierte Biografie wird lokal gespeichert (localStorage) mit Timestamp
- [ ] **FR-8.19:** Mehrere gespeicherte Versionen möglich (z. B. „Kurzversion DE", „Brief an Enkel EN")
- [ ] **FR-8.20:** Export als:
  - `.txt` – Plain Text
  - `.md` – Markdown
  - Drucken / PDF via `window.print()`
- [ ] **FR-8.21:** Teilen-Funktion: Biografie als kopierbarer Text oder als Share-Link (v2.x)

---

## 4. API-Integration & Datenschutz

### 4.1 API-Key-Verwaltung

Da Remember Me aktuell kein Backend hat, stehen zwei Optionen offen:

**Option A – Benutzer-eigener API-Key (v2.1.0)**
- Benutzer trägt seinen Anthropic API-Key in den Einstellungen ein
- Key wird in localStorage gespeichert (niemals an Dritte übertragen)
- Direkter API-Call vom Browser an `api.anthropic.com`

**Option B – Remember-Me-Proxy-Backend (v2.x)**
- Eigener Backend-Endpoint proxied den API-Call
- Kein API-Key nötig für den Benutzer
- Nutzungsbasierte Abrechnung (z. B. X freie Generierungen pro Monat)

Für v2.1.0 wird **Option A** implementiert; Option B folgt mit dem Backend-Sync (v2.0.0).

### 4.2 Datenschutz

| Aspekt | Umsetzung |
|--------|-----------|
| Datenübertragung | Nur bei aktiver Generierung; Antworten werden als Prompt an die Claude API gesendet |
| Einwilligung | Expliziter Hinweis + Bestätigung vor der ersten Generierung: „Deine Antworten werden einmalig an die Claude API übertragen" |
| Keine Speicherung | Claude API speichert Prompts nicht (laut Anthropic-Datenschutzbedingungen) |
| Opt-out | Benutzer kann den API-Key jederzeit löschen und die Funktion nie nutzen |

---

## 5. Prompt-Design

### 5.1 System-Prompt (Beispiel, Stil: Autobiografie)

```
Du bist ein einfühlsamer Ghostwriter, der aus Interview-Antworten eine 
Autobiografie verfasst. Schreibe in der Ich-Perspektive, fließend und 
natürlich. Verbinde die Antworten zu einem zusammenhängenden Text – 
erfinde nichts, aber formuliere ansprechend. Ziel: ~1.500 Wörter auf Deutsch.
```

### 5.2 User-Prompt-Struktur

```
Hier sind die Lebenserinnerungen von {name} (geb. {birthYear}):

## Kindheit & Jugend
Frage: Wo bist du aufgewachsen?
Antwort: Ich bin in München aufgewachsen, in einem kleinen Haus…

Frage: Was war deine früheste Erinnerung?
Antwort: Ich erinnere mich noch genau an…

## Familie & Beziehungen
…

Freundes-Perspektive von Klaus:
„Was macht Anna als Freundin besonders?" – „Anna ist immer da, wenn man sie braucht."

Bitte schreibe jetzt die Autobiografie.
```

### 5.3 Modell-Empfehlung

| Anforderung | Empfehlung |
|-------------|-----------|
| Standardgenerierung | `claude-sonnet-4-5` – gute Balance aus Qualität und Kosten |
| Ausführliche Biografie | `claude-opus-4-5` – höchste Textqualität |
| Schnelle Kurzversion | `claude-haiku-4-5` – kosteneffizient |

---

## 6. Architektur

### 6.1 Neue Dateien

```
src/
├── views/
│   ├── BiographyView.tsx          # Hauptansicht: Konfiguration + Ergebnis
│   └── BiographyPreview.tsx       # Vollbild-Leseansicht mit Inline-Edit
├── components/
│   ├── BiographyConfig.tsx        # Stil, Länge, Sprache, Kategorien wählen
│   ├── BiographyStreamViewer.tsx  # Streaming-Text-Anzeige (word by word)
│   └── ApiKeySettings.tsx         # API-Key eingeben, speichern, löschen
├── hooks/
│   └── useBiographyGenerator.ts   # Anthropic API-Call, Streaming, Abbruch
└── utils/
    └── biographyPrompt.ts         # Prompt-Bau aus ExportData + Konfiguration
```

### 6.2 Datenfluss

```
BiographyConfig (Stil, Länge, Sprache, Kategorien)
    ↓
biographyPrompt.ts: buildPrompt(exportData, config) → { system, user }
    ↓
useBiographyGenerator: streamMessage(prompt, apiKey)
    → Anthropic Messages API (claude-sonnet-4-5, stream: true)
    ↓
BiographyStreamViewer: Token für Token anzeigen
    ↓
BiographyPreview: Volltext, editierbar, exportierbar
    ↓
localStorage: gespeicherte Biografien []
```

### 6.3 Datenmodell

```typescript
interface Biography {
  id: string
  createdAt: string
  style: 'autobiography' | 'letter' | 'narrative' | 'portrait'
  language: 'de' | 'en'
  length: 'short' | 'normal' | 'long'
  text: string          // Generierter + ggf. bearbeiteter Text
  wordCount: number
  basedOnAnswers: number  // Anzahl Antworten, die als Grundlage dienten
}
```

---

## 7. UX-Konzept

### Schritt 1: Konfiguration
```
┌─────────────────────────────┐
│  ✨ Biografie erzeugen      │
│                             │
│  Stil                       │
│  ○ Autobiografie            │
│  ● Brief an Enkel           │
│  ○ Erzählung                │
│  ○ Kurzporträt              │
│                             │
│  Länge      [Normal    ▼]   │
│  Sprache    [Deutsch   ▼]   │
│                             │
│  Kategorien einschließen:   │
│  ☑ Kindheit  ☑ Familie      │
│  ☑ Beruf     ☑ Werte        │
│  ☑ Erinn.    ☑ Vermächtnis  │
│  ☐ Freunde   ☐ Eigene       │
│                             │
│  Grundlage: 38 Antworten    │
│                             │
│     [✨ Biografie erzeugen] │
└─────────────────────────────┘
```

### Schritt 2: Streaming-Anzeige
```
┌─────────────────────────────┐
│  ✨ Deine Biografie wird    │
│     geschrieben…            │
│                             │
│  Mein liebes Enkelkind,     │
│  lass mich dir von meinem   │
│  Leben erzählen. Ich wurde  │
│  1952 in München geboren,   │
│  in einer Zeit, als▌        │
│                             │
│             [Abbrechen]     │
└─────────────────────────────┘
```

### Schritt 3: Vorschau & Export
```
┌─────────────────────────────┐
│  ← Biografie           ↗ ⋮ │
│                             │
│  Brief an mein Enkelkind    │
│  ─────────────────────────  │
│  Mein liebes Enkelkind,     │
│  lass mich dir von meinem   │
│  Leben erzählen…            │
│                             │
│  [Bearbeiten] [Drucken]     │
│  [Als .txt]   [Neu →]       │
└─────────────────────────────┘
```

---

## 8. Nicht-funktionale Anforderungen

| Anforderung | Wert |
|-------------|------|
| **Latenz** | Erste Token erscheinen < 2 s nach Start (Streaming) |
| **Offline** | Feature setzt aktive Internetverbindung voraus; klarer Hinweis bei Offline |
| **Datenschutz** | Explizite Einwilligung vor erster Nutzung, API-Key niemals in Logs |
| **Fehlertoleranz** | API-Fehler (Rate Limit, falscher Key, Timeout) werden verständlich erklärt |
| **Kosten-Transparenz** | Geschätzte Token-Anzahl vor Generierung anzeigen |

---

## 9. Akzeptanzkriterien

- [ ] Konfigurationsscreen mit Stil, Länge, Sprache, Kategorie-Auswahl
- [ ] Generierung startet nach Bestätigung und zeigt Text per Streaming
- [ ] Generierter Text ist kohärent, fließend und nutzt die gespeicherten Antworten
- [ ] Text kann direkt in der App bearbeitet werden
- [ ] Export als .txt, .md und Druck funktioniert
- [ ] API-Key wird sicher gespeichert und kann gelöscht werden
- [ ] Bei fehlendem API-Key oder fehlender Verbindung erscheint eine klare Fehlermeldung
- [ ] Hinweis auf Datenübertragung wird vor erster Nutzung angezeigt und bestätigt

---

## 10. Abhängigkeiten

| Abhängigkeit | Grund |
|--------------|-------|
| Anthropic API / Claude | Textgenerierung |
| `@anthropic-ai/sdk` (npm) | Offizieller Anthropic TypeScript-Client mit Streaming-Support |
| REQ-003 (Story Storage) | Antworten als Grundlage der Generierung |
| v2.0.0 Backend (optional) | Für Option B (Proxy ohne eigenen API-Key) |

---

## 11. Änderungshistorie

| Version | Datum | Autor | Änderung |
|---------|-------|-------|---------|
| 1.0.0 | 2026-04-12 | Claude | Initiale Version |

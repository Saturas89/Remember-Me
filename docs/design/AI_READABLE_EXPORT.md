# KI-lesbarer Datenexport – Konzept & Vorschläge

**Status:** ✔️ COMPLETED (v1.4.0)  
**Anforderung:** REQ-006

---

## Problem

Die aktuelle Speicherung in `localStorage` ist für die App optimiert (schneller Lookup per ID), aber **nicht direkt KI-lesbar**:

```json
{
  "answers": {
    "kindheit-1": {
      "questionId": "kindheit-1",
      "categoryId": "kindheit",
      "value": "In einem kleinen Dorf in Bayern..."
    }
  }
}
```

Ein LLM sieht `"kindheit-1"` und weiß nicht, was damit gemeint ist. Die Frage selbst – *„Wo bist du aufgewachsen?"* – fehlt im Export.

**Ziel:** Beim Export werden Frage-IDs zu vollständigen Frage-Texten aufgelöst, Metadaten ergänzt, und das Ergebnis in einem Format ausgegeben, das ein LLM direkt verarbeiten kann.

---

## Vorgeschlagene Formate

### Option A – Enriched JSON ⭐ (empfohlen für Maschinen)

Optimiert für programmatische Verarbeitung, API-Calls, Langzeitarchivierung.

```json
{
  "$schema": "https://remember-me.app/schema/export/v1.json",
  "exportVersion": "1",
  "exportedAt": "2026-04-10T14:30:00Z",
  "app": "Remember Me",
  "profile": {
    "name": "Karl Müller",
    "birthYear": 1970,
    "memberSince": "2026-04-01"
  },
  "categories": [
    {
      "id": "kindheit",
      "title": "Kindheit & Jugend",
      "emoji": "🧒",
      "answers": [
        {
          "questionId": "kindheit-1",
          "question": "Wo bist du aufgewachsen und wie war es dort?",
          "answer": "In einem kleinen Dorf in Bayern, direkt neben einem Wald...",
          "answeredAt": "2026-04-05"
        },
        {
          "questionId": "kindheit-3",
          "question": "Wie sah dein Kinderzimmer aus?",
          "answer": "Klein aber gemütlich, mit einem Hochbett und vielen Büchern.",
          "answeredAt": "2026-04-05"
        }
      ]
    }
  ],
  "customQuestions": [
    {
      "questionId": "cq-1712345678-abc12",
      "question": "Was war dein persönliches Lebensmotto?",
      "answer": "Jeden Tag so leben, als wäre es der letzte.",
      "answeredAt": "2026-04-08"
    }
  ],
  "friendPerspectives": [
    {
      "friendName": "Anna (Tochter)",
      "answers": [
        {
          "question": "Wie würdest du Karl beschreiben?",
          "answer": "Papa ist immer für uns da, egal was passiert.",
          "submittedAt": "2026-04-07"
        }
      ]
    }
  ]
}
```

**Vorteile:**
- Maschinenlesbar, JSON Schema validierbar
- Direkt in LLM-APIs (OpenAI, Claude) einspeisbar
- Versioniert (`exportVersion`) für zukünftige Migrations-Kompatibilität
- Alle Fragen als vollständiger Text enthalten

---

### Option B – Markdown ⭐ (empfohlen für LLM-Prompts)

Optimiert für direktes Einfügen in einen LLM-Chat (Claude, ChatGPT, Gemini). Markdown ist das native Lese-Format moderner LLMs.

```markdown
# Lebensgeschichte von Karl Müller (geb. 1970)

*Exportiert am 10. April 2026 · Remember Me*

---

## 🧒 Kindheit & Jugend

**Wo bist du aufgewachsen?**
In einem kleinen Dorf in Bayern, direkt neben einem Wald. Wir hatten viel
Freiheit als Kinder – nach der Schule waren wir bis zum Abendessen draußen.

**Wie sah dein Kinderzimmer aus?**
Klein aber gemütlich, mit einem Hochbett und vielen Büchern.

---

## 👨‍👩‍👧‍👦 Familie & Beziehungen

**Wie haben sich deine Eltern kennengelernt?**
Auf einem Dorffest, 1965. Mein Vater hat meine Mutter zum Tanzen aufgefordert
und sie hat nicht Nein gesagt.

---

## ✏️ Eigene Fragen

**Was war dein persönliches Lebensmotto?**
Jeden Tag so leben, als wäre es der letzte.

---

## 👥 Was Freunde über mich sagen

### Anna (Tochter)
**Wie würdest du Karl beschreiben?**
Papa ist immer für uns da, egal was passiert.

---

*Dieses Dokument wurde mit Remember Me erstellt – einer App zum Festhalten
von Lebensgeschichten für die Nachwelt.*
```

**Vorteile:**
- Direkt lesbar für Menschen UND LLMs
- Optimal für Biografie-Generierung: einfach in einen Prompt einfügen
- Kann als `.md`-Datei gespeichert werden
- Leicht in PDF oder HTML konvertierbar

---

### Option C – LLM-Prompt-Template

Eine Variante von Markdown, bei der ein fertiger Prompt-Rahmen mitgeliefert wird:

```
Du bist ein einfühlsamer Biograf. Schreibe aus den folgenden Antworten
eine persönliche Biografie in der dritten Person, ca. 500 Wörter, auf Deutsch.
Schreibe warm, persönlich und respektvoll. Erfinde nichts.

--- DATEN ---

Name: Karl Müller, geboren 1970

KINDHEIT:
- "Wo bist du aufgewachsen?": "In einem kleinen Dorf in Bayern..."
- "Lieblingsspielzeug?": "Ein roter Holztraktor meines Großvaters"

FAMILIE:
- "Wie haben sich deine Eltern kennengelernt?": "Auf einem Dorffest, 1965..."

[...]

--- ENDE DATEN ---
```

**Einsatz:** Direkt in Claude/ChatGPT eingeben → bekommt sofort eine Biografie zurück.

---

### Option D – YAML

Für technisch affine Nutzer, maschinell gut verarbeitbar:

```yaml
exportVersion: "1"
exportedAt: "2026-04-10"
profile:
  name: Karl Müller
  birthYear: 1970

categories:
  - id: kindheit
    title: "Kindheit & Jugend"
    answers:
      - question: "Wo bist du aufgewachsen?"
        answer: "In einem kleinen Dorf in Bayern..."
        date: "2026-04-05"

customQuestions:
  - question: "Was war dein Lebensmotto?"
    answer: "Jeden Tag so leben, als wäre es der letzte."

friendPerspectives:
  - from: "Anna (Tochter)"
    answers:
      - question: "Wie würdest du Karl beschreiben?"
        answer: "Papa ist immer für uns da..."
```

---

## Empfehlung

| Format | Für wen | Implementierungsaufwand |
|--------|---------|------------------------|
| **Enriched JSON** | Entwickler, APIs, Langzeitarchiv | Mittel |
| **Markdown** | Endnutzer, LLM-Prompt, E-Mail | Gering |
| **LLM-Prompt-Template** | Direkte KI-Nutzung | Sehr gering |
| YAML | Technisch affine Nutzer | Mittel |

**Phase 1 (v1.4.0):** ✔️ Markdown-Export + Enriched JSON im Archiv – implementiert  
**Phase 2 (v2.1.0):** LLM-Direktintegration (Biografie auf Knopfdruck) – geplant

---

## Implementierung (v1.4.0) – Abgeschlossen

### `src/utils/export.ts`

```typescript
export function exportAsMarkdown(data: ExportData): string
export function exportAsEnrichedJSON(data: ExportData): string  // gibt JSON.stringify zurück
export function downloadFile(content, filename, mime): void
```

- Frage-IDs werden zu vollständigen Texten aufgelöst (Lookup in `CATEGORIES` + `FRIEND_QUESTIONS`)
- `{name}`-Platzhalter in Freunde-Fragen werden mit dem Profilnamen ersetzt
- `downloadFile` nutzt `Blob` + `URL.createObjectURL` – kein Backend nötig
- Dateiname: `[profilname].md` / `[profilname].json`

### UI – Export-Buttons im Archiv

```
[← Zurück]  📖 Mein Lebensarchiv  [📄 .md] [{ } JSON] [🖨]
```

- Rechts in der Topbar, ausgeblendet bei `@media print`
- Tooltip erklärt den Zweck jedes Buttons

Die Funktion löst Frage-IDs zu vollständigen Texten auf, indem sie
`CATEGORIES` und `FRIEND_QUESTIONS` als Lookup-Tabellen nutzt.

### UI-Integration

In `ArchiveView`: zwei neue Export-Buttons neben dem Drucken-Button:
- `📄 Markdown` → lädt `.md`-Datei herunter
- `📊 JSON` → lädt `.json`-Datei herunter
- `🤖 KI-Prompt` → kopiert fertigen Prompt in die Zwischenablage

### Download-Mechanismus

```typescript
function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

Kein Backend nötig – vollständig clientseitig.

---

## Datenschutz-Hinweis

Der KI-Export enthält alle persönlichen Antworten im Klartext. Beim Teilen
des Exports mit KI-Diensten (ChatGPT, Claude, etc.) gelten deren
Datenschutzbedingungen. Die App soll deshalb einen deutlichen Hinweis zeigen:

> *„Dieser Export enthält persönliche Daten. Stelle sicher, dass du den
> Datenschutzrichtlinien des KI-Dienstes, den du nutzt, vertraust."*

---

---

## Roadmap: LLM-Direktintegration (v2.1.0)

Statt den Export manuell in einen KI-Chat zu kopieren, soll die App selbst
mit einem LLM kommunizieren und direkt eine Biografie generieren.

### Konzept

```
User klickt "Biografie schreiben lassen"
      ↓
App baut Markdown-Export intern (clientseitig)
      ↓
Schickt ihn an Claude/OpenAI API
      ↓
Zeigt die generierte Biografie in der App an
      ↓
User kann sie bearbeiten, drucken oder teilen
```

### Mögliche Implementierungen

| Ansatz | Beschreibung | Datenschutz |
|--------|-------------|-------------|
| **Eigener API-Key** | User trägt seinen Anthropic/OpenAI-Key ein, Calls gehen direkt vom Browser | Hoch – Daten gehen nur an Anbieter, den User wählt |
| **Remember Me Backend** | App hat eigenen Proxy-Server | Mittel – Betreiber sieht Metadaten |
| **Lokales LLM** | Ollama o.ä. lokal auf dem Gerät | Maximal – keine Daten verlassen das Gerät |

**Empfehlung für v2.1:** Eigener API-Key (User bringt seinen Schlüssel mit).
Keine Daten gehen an Remember Me – maximale Transparenz.

### Prompt-Vorlage (Entwurf)

```
Du bist ein einfühlsamer Biograf. Schreibe aus den folgenden Antworten
eine persönliche Biografie in der dritten Person, ca. 600–800 Wörter,
auf Deutsch. Schreibe warm, persönlich und respektvoll. Erfinde nichts –
halte dich exakt an die gegebenen Informationen.

[Markdown-Export wird hier eingefügt]
```

---

## Datenschutz-Hinweis

Der KI-Export enthält alle persönlichen Antworten im Klartext. Beim Teilen
des Exports mit KI-Diensten (ChatGPT, Claude, etc.) gelten deren
Datenschutzbedingungen. Die App zeigt beim Export einen Hinweis:

> *„Dieser Export enthält persönliche Daten. Stelle sicher, dass du den
> Datenschutzrichtlinien des KI-Dienstes, den du nutzt, vertraust."*

---

## Referenzen

- [Aktuelles Datenmodell](../PROJECT.md#datenmodell-aktuell)
- [REQ-004 Export & Teilen](./REQ-004-export-sharing.md)
- [CHANGELOG](../CHANGELOG.md)

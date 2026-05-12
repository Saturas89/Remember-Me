# Anforderung: Biografie erzeugen

**Status:** 🟡 PLANNED  
**ID:** REQ-008  
**Version:** 1.1.0  
**Letzte Aktualisierung:** 2026-05-12  
**Modul:** Biography  
**Priorität:** High  
**Geplante Version:** v2.1.0  
**Architektur:** siehe [ADR-001 – Open-Source-Kern, proprietäre Premium-Features serverseitig](../architecture/ADR-001-open-source-vs-proprietary.md)

---

## 1. Zusammenfassung

Aus den gespeicherten Antworten im Lebensarchiv wird per KI (Claude) automatisch eine fertige, lesbare Lebensgeschichte generiert. Der Benutzer wählt Stil, Tonalität und Sprache – die KI fügt die Antworten zu einem zusammenhängenden, natürlichsprachlichen Text zusammen. Das Ergebnis kann vorgeschaut, bearbeitet, exportiert und geteilt werden.

Die Generierung läuft als **Premium-Feature über eine Supabase Edge Function** im privaten Pro-Repo (`saturas89/remember-me-pro`). Im OSS-Repo liegt ausschließlich ein dünner Client, der den Endpoint aufruft. Begründung und Vorgehen siehe ADR-001.

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

- [ ] **FR-8.10:** Generierung läuft primär über den Storyhold-Pro-Endpoint (Supabase Edge Function `generate-biography`); bei fehlender Pro-Subscription **und** fehlendem Bring-your-own-Key zeigt die UI einen Hinweis statt der Generierung zu starten
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

## 4. Backend-Integration & Datenschutz

### 4.1 Pro-Endpoint (primär)

Generierung läuft über die Supabase Edge Function `generate-biography` im privaten Pro-Repo `saturas89/remember-me-pro` (siehe ADR-001).

- **Auth:** Supabase-JWT der eingeloggten Storyhold-User-Session.
- **Subscription-Check:** Function prüft `profiles.has_pro = true`, bevor sie den Anthropic-Call ausführt.
- **Anthropic-Key:** liegt als Supabase Function Secret, niemals im Client.
- **Streaming:** Function streamt Token via SSE/ReadableStream zurück.
- **Konfiguration im Client:** `VITE_PRO_ENDPOINT` Basis-URL (optional). Fehlt sie, wird die UI in den BYOK- oder Disabled-Modus geschaltet.

**Im OSS-Repo liegt explizit keine Prompt-Vorlage, Modell-Routing-Tabelle oder Anthropic-Auth-Logik.** Diese Bestandteile sind proprietär und werden im Pro-Repo gepflegt. Der OSS-Client kennt nur das HTTP-Schema des Endpoints.

### 4.2 Bring-your-own-Key (Fallback für Selfhoster)

Optionaler Fallback ohne Pro-Subscription:

- Benutzer trägt eigenen Anthropic-API-Key in den Einstellungen ein.
- Key wird ausschließlich in `localStorage` gespeichert (niemals an Storyhold-Backend gesendet).
- Direkter Browser-Call an `api.anthropic.com` mit einem **generischen** Prompt (kein Storyhold-Tuning).
- Wird die Funktion ohne Key und ohne Pro-Subscription aufgerufen, erscheint ein Hinweis-Modal mit Upgrade-CTA bzw. Anleitung zum Key-Eintragen.

### 4.3 Datenschutz

| Aspekt | Umsetzung |
|--------|-----------|
| Datenübertragung | Nur bei aktiver Generierung; Antworten werden an den Pro-Endpoint (bzw. bei BYOK direkt an Anthropic) übertragen |
| Einwilligung | Expliziter Hinweis + Bestätigung vor der ersten Generierung: „Deine Antworten werden zur Texterstellung an Anthropic übertragen" |
| Speicherung beim Provider | Anthropic speichert Inhalte gemäß Anthropic-Datenschutzbedingungen nicht für Training |
| Opt-out | Benutzer kann die Funktion ignorieren oder den Key löschen; lokale Antworten bleiben unangetastet |
| Anonymisierung (optional) | Pro-Endpoint kann Klarnamen/Geburtsdaten vor dem Anthropic-Call entfernen (Detail im Pro-Repo) |

---

## 5. Prompt-Design (proprietär)

Die konkreten System-Prompts, Stil-Vorlagen, Längen-Targets und das Modell-Routing leben **im privaten Pro-Repo** als Teil der Edge Function. Im OSS-Repo wird bewusst nur das Funktions-Interface dokumentiert:

```
POST {VITE_PRO_ENDPOINT}/generate-biography
Authorization: Bearer <Supabase-JWT>
Content-Type: application/json

{
  "style": "autobiography" | "letter" | "narrative" | "portrait",
  "length": "short" | "normal" | "long",
  "language": "de" | "en",
  "categories": string[],
  "includeFriendPerspectives": boolean,
  "includeOwnQuestions": boolean,
  "answers": [{ "category": string, "question": string, "answer": string }, ...],
  "friendPerspectives": [...],
  "profile": { "name": string, "birthYear": number }
}

→ text/event-stream (Token-Stream) | application/json (Fehler)
```

Der BYOK-Fallback verwendet ein **generisches**, im OSS-Repo dokumentiertes Prompt (Platzhalter, kein Storyhold-Tuning). Ziel: funktional, aber sichtbar einfacher als die Pro-Variante.

---

## 6. Architektur

### 6.1 Neue Dateien (OSS-Repo)

```
src/
├── views/
│   ├── BiographyView.tsx          # Hauptansicht: Konfiguration + Ergebnis
│   └── BiographyPreview.tsx       # Vollbild-Leseansicht mit Inline-Edit
├── components/
│   ├── BiographyConfig.tsx        # Stil, Länge, Sprache, Kategorien wählen
│   ├── BiographyStreamViewer.tsx  # Streaming-Text-Anzeige (word by word)
│   ├── BiographyUpgradeHint.tsx   # CTA für Pro bzw. Anleitung BYOK
│   └── ApiKeySettings.tsx         # BYOK: Anthropic-Key eingeben/löschen
├── hooks/
│   └── useBiographyGenerator.ts   # Dünner Client: ruft Pro-Endpoint oder BYOK
└── utils/
    └── biographyRequest.ts        # Request-Body bauen (kein Prompt-Tuning!)
```

**Bewusst nicht im OSS-Repo:** Prompt-Vorlagen, Modell-Routing, Anthropic-Auth-Logik, Subscription-Check. Diese leben im privaten Pro-Repo.

### 6.2 Neue Dateien (privates Pro-Repo `saturas89/remember-me-pro`)

```
supabase/functions/generate-biography/
├── index.ts            # Edge Function Entry, Auth, Subscription-Check, Streaming
├── prompts/
│   ├── autobiography.ts
│   ├── letter.ts
│   ├── narrative.ts
│   └── portrait.ts
├── modelRouting.ts     # Längen-/Stil-abhängige Modellwahl
└── anonymize.ts        # Optionale PII-Entfernung
```

### 6.3 Datenfluss

```
BiographyConfig (Stil, Länge, Sprache, Kategorien)
    ↓
biographyRequest.ts: buildRequest(exportData, config) → JSON Body
    ↓
useBiographyGenerator:
    if hasProSubscription → POST {VITE_PRO_ENDPOINT}/generate-biography
    else if hasOwnKey     → POST api.anthropic.com mit generischem Prompt
    else                  → BiographyUpgradeHint anzeigen, kein Call
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
| ADR-001 | Architektur-Entscheidung: Pro-Features serverseitig |
| Privates Pro-Repo `saturas89/remember-me-pro` | Edge Function + Prompt-Templates |
| Supabase (Edge Functions, Auth, `profiles.has_pro`) | Hosting des Pro-Endpoints, JWT-Auth, Subscription-Check |
| Anthropic API / Claude | Textgenerierung (Aufruf nur aus der Edge Function bzw. BYOK) |
| `@anthropic-ai/sdk` (npm) | Nur im BYOK-Fallback bzw. in der Edge Function – nicht zwingend im OSS-Bundle |
| REQ-003 (Story Storage) | Antworten als Grundlage der Generierung |

---

## 11. Änderungshistorie

| Version | Datum | Autor | Änderung |
|---------|-------|-------|---------|
| 1.0.0 | 2026-04-12 | Claude | Initiale Version |
| 1.1.0 | 2026-05-12 | Claude | Umstellung auf Pro-Edge-Function-Architektur gemäß ADR-001; proprietäre Prompt-Templates aus OSS-Dokument entfernt; BYOK-Fallback dokumentiert |

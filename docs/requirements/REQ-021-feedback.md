# Anforderung: Leichtgewichtiges In-App-Feedback

**Status:** ✔️ COMPLETED
**ID:** REQ-021
**Version:** 2.8.0
**Letzte Aktualisierung:** 2026-05-14
**Modul:** UX
**Priorität:** Medium

---

## 1. Zusammenfassung

Nutzer sollen ihre Stimmung zur App mit **einem Tap** ausdrücken können. Ein
Eintrag im Profil-Tab öffnet ein Modal mit fünf Smileys (😞 😐 🙂 😊 🤩) und —
nach der Smiley-Auswahl — einem optionalen Kommentarfeld. Nichts Proaktives,
kein Banner, kein Tracking-Apparat. Der Submit landet in einer neuen
Supabase-Tabelle `feedback_submissions`, die ausschließlich `rating`,
`comment` und `created_at` speichert.

Diese v1 ist bewusst minimal. Folgefeatures (Trigger-Banner, Kategorien,
Familien-Eskalation, Audio-Feedback) wurden in der Persona-Runde diskutiert
und für spätere Iterationen zurückgestellt — siehe „Out of Scope" unten.

---

## 2. Funktionale Anforderungen

- **FR-021.1:** Im Profil-Tab erscheint ein Eintrag „Wie gefällt dir die App?
  💬", erreichbar in beiden App-Modi (Full und Simple).
- **FR-021.2:** Tap auf den Eintrag öffnet das `FeedbackModal`.
- **FR-021.3:** Das Modal zeigt fünf Smiley-Buttons (Werte 1–5). Das
  Kommentar-Textfeld erscheint erst nach der Auswahl eines Smileys.
- **FR-021.4:** Der „Senden"-Button ist deaktiviert, solange kein Smiley
  gewählt ist.
- **FR-021.5:** Nach erfolgreichem Submit erscheint für 1,5 s ein „Danke 💛"-
  State, dann schließt das Modal automatisch.
- **FR-021.6:** Nach Submit zeigt der Profil-Eintrag für 60 Tage „Danke für
  dein Feedback 💛" als Titel und Untertitel. Ein erneutes Tippen ist
  weiterhin möglich.
- **FR-021.7:** Der Kommentar wird client-seitig auf 500 Zeichen begrenzt;
  die RLS-Policy verifiziert die Länge serverseitig.
- **FR-021.8:** Im Vereinfachten Bedienmodus sind die Smiley-Buttons
  mindestens 72 × 72 px groß (Full-Mode: 56 × 56 px).
- **FR-021.9:** Tritt beim Submit ein Netzwerk- oder Konfigurationsfehler auf,
  zeigt das Modal eine entsprechende Hinweiszeile (kein Crash, kein
  silent-fail) und bleibt offen, damit der Nutzer es erneut versuchen kann.

---

## 3. Nicht-funktionale Anforderungen

- **Privacy:** Es wird **kein** User-Identifier mitgeschickt – weder
  `device_id`, `user_id`, `family_unit_id` noch ein Hash. Auch nicht
  `app_version`, `app_mode` oder `locale`. Die Tabelle speichert nur
  `id (uuid)`, `rating`, `comment`, `created_at`. Lesen ist anon nicht
  erlaubt — nur über den Service-Role-Key (Admin-Dashboard).
- **Offline:** Das Modal lässt sich offline öffnen und ausfüllen; der Submit
  schlägt mit einem Hinweis fehl, wenn keine Verbindung besteht. Keine
  Persistenz/Queue in v1 — ein bewusster Verzicht, um die Erst-Version
  klein zu halten.
- **i18n:** Vollständig in Deutsch und Englisch übersetzt
  (`src/locales/de/ui.ts`, `src/locales/en/ui.ts`, Block `feedback`).
- **Design-System:** Modal nutzt `.modal-overlay` / `.modal-box`-Pattern,
  Hint-Stile aus dem Friends-Tab (`.friends-hint`), CTA aus `.share-cta-btn`
  und Theme-Variablen aus `:root`. Alle vier Themes (Sepia, Nacht, Hell,
  Ozean) werden unterstützt.

---

## 4. UI-Wording (DE)

| Element | Text |
|---|---|
| Profil-Eintrag | „Wie gefällt dir die App? 💬" |
| Profil-Eintrag (nach Submit, 60 Tage) | „Danke für dein Feedback 💛" |
| Modal-Titel | „Wie geht's dir mit Storyhold?" |
| Untertitel | „Tipp auf ein Gesicht – mehr brauchst du nicht." |
| Smiley-Labels | „Gar nicht gut" · „Geht so" · „In Ordnung" · „Gut" · „Begeistert" |
| Textfeld-Label | „Magst du uns mehr erzählen? (optional)" |
| Privacy-Hint | „Dein Name wird nirgends gespeichert." |
| Submit | „Senden" |
| Danke-State | „Danke 💛 Dein Feedback ist angekommen." |

Bewusste Wording-Entscheidungen aus dem Persona-Review:

- **„Wie gefällt dir die App?"** statt „Feedback geben" — der Anglizismus
  hätte Ingrid (Novice) vom Klicken abgehalten.
- **„Dein Name wird nirgends gespeichert"** statt „Du bleibst anonym" —
  konkreter und ohne Fachbegriff, der für Senioren Misstrauen erzeugt.

---

## 5. Datenmodell

```sql
create table public.feedback_submissions (
  id         uuid primary key default gen_random_uuid(),
  rating     smallint not null check (rating between 1 and 5),
  comment    text,
  created_at timestamptz not null default now()
);

alter table public.feedback_submissions enable row level security;

create policy "anonymous insert"
  on public.feedback_submissions
  for insert
  to anon, authenticated
  with check (
    rating between 1 and 5
    and (comment is null or length(comment) <= 500)
  );
```

Migration: `supabase/migrations/20260514000000_feedback.sql`.

---

## 7a. API-Vertrag

### Komponente `FeedbackModal`

```ts
interface FeedbackModalProps {
  onClose: () => void
}
```

### Utility `submitFeedback`

```ts
export interface FeedbackPayload {
  rating: number      // 1..5, validiert client- und serverseitig
  comment?: string    // optional, max 500 chars
}

export type FeedbackResult =
  | { ok: true }
  | { ok: false; reason: 'not-configured' | 'network' | 'unknown'; error?: string }

export function submitFeedback(payload: FeedbackPayload): Promise<FeedbackResult>
export function markFeedbackSubmitted(now?: Date): void
export function feedbackRecentlySubmitted(now?: Date): boolean
```

Local-Storage-Schlüssel: `rm-feedback-submitted-at` (ISO-Timestamp).
Acknowledgement-Fenster: 60 Tage.

---

## 8. Out of Scope (v1)

Diese Punkte sind in der Persona-Runde diskutiert worden und werden später
adressiert, falls die realen Feedback-Daten dafür sprechen:

- **Banner-Trigger** unter dem Lebensweg nach Antwort-/Zeit-Schwelle.
- **Folge-Prompt** nach Schließen des Release-Notes-Modals.
- **Audio-Feedback** (Mikro-Button neben dem Textfeld) — Ingrid-Routine
  hatte das gewünscht; im Sinne von „so klein wie möglich" für v1 nicht
  gebaut.
- **Setup-Phase-Freeze** gegen Geschenk-Spoiler — relevant erst, wenn
  proaktive Trigger eingeführt werden.
- **Family-Admin-Eskalation** bei negativem Smiley aus Simple-Mode —
  eigenes REQ, sobald genug Daten zur Privacy-Vertragsklärung vorliegen.
- **Kategorie-Pills** („App-Bedienung", „Familie & Teilen", …) — bewusst
  weggelassen, um die Erstversion auf das Smiley + freien Text zu
  reduzieren.
- **Offline-Queue** und automatischer Retry — nicht in v1.
- **E2E-Test über Playwright** — Vitest-Coverage reicht für v1, E2E folgt,
  sobald sich die UX stabilisiert.

---

## 9. Akzeptanztests

Unit (Vitest, `src/components/FeedbackModal.test.tsx`):

- Modal rendert Titel, Untertitel und fünf Smiley-Buttons.
- Submit ist deaktiviert, solange kein Smiley gewählt ist.
- Textfeld erscheint erst nach Smiley-Auswahl.
- Submit ruft `submitFeedback` mit korrektem Payload auf und markiert
  das Acknowledgement.
- Auto-Close nach 1,5 s im Danke-State.
- Kommentar wird auf 500 Zeichen gekappt.
- Konfigurationsfehler und Netzwerkfehler zeigen jeweils einen
  spezifischen Hinweis und triggern keinen Acknowledgement-Mark.
- Close-Button schließt sofort, auch ohne Submit.
- Dialog-A11y-Attribute (`role`, `aria-modal`, `aria-labelledby`) sind gesetzt.

Manuell:

- Profil-Eintrag in allen vier Themes sichtbar und gut lesbar.
- Simple-Mode: Tap-Targets ≥ 72 × 72 px.
- Acknowledgement-Fenster zeigt nach Submit den Danke-Text im Profil.
- Supabase-Eintrag erscheint mit korrekten Werten in der Tabelle
  `feedback_submissions` (per Service-Role-Key in der Studio-Konsole
  oder über `mcp__c2996018-…__execute_sql`).

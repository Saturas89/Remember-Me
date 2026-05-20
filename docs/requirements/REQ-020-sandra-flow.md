# Anforderung: Sandra-First Flow – persönliche Fragen & dauerhafter Verbindungsaufbau

**Status:** ✔️ COMPLETED (v2.7.0 Grundflow; v2.11.0 Dauerverbindung; v2.13.0 einziger Connection-Entry)
**ID:** REQ-020
**Version:** 2.13.0
**Letzte Aktualisierung:** 2026-05-20
**Modul:** Sharing / UX
**Priorität:** Medium

> ℹ️ **Update v2.13.0:** Mit der Vereinfachung aus [REQ-022](./REQ-022-vereinfachtes-teilen.md)
> ist der Sandra-Flow ab v2.13.0 der **einzige** Einstieg für neue
> Online-Sharing-Verbindungen. Der separate Direkt-Link-Pfad im
> `OnlineSharingHubView.OnboardingScreen` entfällt — siehe FR-22.19 und FR-22.23.

---

## 1. Zusammenfassung

Ein Einstiegs-Flow für die tech-affinere Käuferin Sandra (~42), damit sie
**eigene** Fragen in **eigenen Worten** an einen Verwandten (z. B. Mama
Ingrid, ~67) formulieren und per Web-Share-Link verschicken kann.

Ab v2.11.0 sind die Fragen nicht mehr Selbstzweck, sondern **Trigger**: der
Link enthält neben dem Fragenpaket auch Sandras `ContactHandshake` (deviceId
+ ECDH-Public-Key). Wenn Mama den Link öffnet, beantwortet sie die Fragen
(sanfte Onboarding-Erfahrung) und wird gleichzeitig dauerhaft mit Sandra
verbunden. Sandra sieht Mamas neue Erinnerungen laufend – kein separater
Familienmodus-Setup-Schritt notwendig.

Diese Anforderung füllt die Lücke, dass das bisherige Freunde-Feature
ausschließlich vorgegebene Themen-Packs anbot – Sandra konnte zwar
**senden**, aber weder **kuratieren** noch eine **Dauerverbindung** aufbauen.

---

## 2. Funktionale Anforderungen

- **FR-020.1** Neue Route `#/ask` öffnet die `SandraFlowView`-Container-
  Komponente. Sechs Schritte: Landing → Anchor → Trigger → Composer → List →
  Share.
- **FR-020.2** Pflicht-Felder im Anchor-Schritt: `relation` (Chip oder
  Freitext) und `anrede` (Default vom Chip, editierbar). `birthYear` ist
  optional (1900–2020).
- **FR-020.3** Trigger-Bank umfasst **10 Trigger** pro Locale, aufgeteilt
  in zwei Gruppen (`biography`: 6, `relationship`: 4). Sandra darf außerdem
  einen **Freeform-Trigger** wählen und eine eigene Frage tippen.
- **FR-020.4** Composer rendert die Template-Vorschläge eines Triggers,
  sobald `seed.length >= 1` ODER der Template eine `withoutSeed`-Variante
  hat. Vorschläge können „So nehmen", „Anpassen" (inline-edit) oder „✕"
  (verwerfen) werden.
- **FR-020.5** Inspirations-Schublade pro Trigger zeigt 6–8 kuratierte
  Beispiele. Klick kopiert den Text **nur** in das Seed-Textarea, niemals
  direkt in die Fragen-Liste (Sandras Hand bleibt am Steuer).
- **FR-020.6** Fragen-Liste erlaubt Edit / Reorder / Delete. Es gibt **kein
  Private-Toggle** – jede Frage in der Liste wird gesendet.
- **FR-020.7** Versand öffnet die Web-Share-API mit einem kombinierten Link:
  - Wenn Supabase konfiguriert und Sandras Identität bereit ist:
    `?qp=…&contact=…` (bzw. `?qp-plain=…&contact=…` Fallback). Dieser Link
    löst auf Mamas Seite sowohl die Fragen-Ansicht als auch den
    `ContactHandshake`-Flow aus → Dauerverbindung in einem Schritt.
  - Ohne Supabase oder bevor die Identität bereit ist: `?qp=…` Fallback
    (einmaliges Fragenpaket, kein Kontakt-Handshake).
  - Der Pack-Code wird niemals als Klartext gezeigt. Bei fehlender
    Web-Share-API fällt der Versand auf `navigator.clipboard.writeText`
    zurück. Der Share-CTA ist nie disabled – er fällt intern automatisch
    auf den jeweils verfügbaren URL-Typ zurück.
- **FR-020.8** Hinweis-Banner bei mindestens einer `relationship`-Frage im
  Pack: „Ein paar Fragen sind sehr persönlich. Vielleicht magst du {anrede}
  kurz anrufen, bevor du den Link schickst." (i18n).
- **FR-020.9** Empfänger-Seite (`PersonalPackReceiveView`):
  - Erkennt `personalPack === true` und rendert sanften Header.
  - Schlägt Vereinfachten Bedienmodus **einmalig** vor (Auto-Suggest-Modal
    mit großem „Ja, einfach machen"- und kleinem „Wie gewohnt"-Button), wenn
    Modus noch nicht `simple` ist.
  - Stellt Fragen **eine nach der anderen** – kein Listen-Layout, kein
    Pack-Code, keine Edit-Tools.
  - Großer Mikrofon-Button ≥ 80 × 80 px.
  - Progress als Punkt-Indikator (●●○○○), keine Prozente.
- **FR-020.10** Eintrag in der Freunde-Tab: neue Karte
  „Eigene Fragen für jemanden formulieren" verlinkt direkt nach `#/ask`.
- **FR-020.11** Draft persistiert in `sessionStorage` unter dem Schlüssel
  `rm-sandra-draft`. Beim Tab-Schließen verschwindet er; bei Reload im
  selben Tab kehrt Sandra automatisch zur Liste zurück.

---

## 3. Nicht-funktionale Anforderungen

- **Privacy:** kein Server-Roundtrip, kein neues Telemetrie-Event. Drafts
  liegen ausschließlich in `sessionStorage` (vernichtet beim Tab-Schließen).
  Der Pack-Code reist URL-codiert vom Sender zum Empfänger und wird vom
  Empfänger nur lokal gespeichert (in der bestehenden Custom-Questions-
  IndexedDB).
- **Offline:** der gesamte Sandra-Flow funktioniert offline (alle Daten
  liegen statisch im Bundle).
- **Performance:** Trigger-Bank pro Locale < 4 KB unkomprimiert; Render-
  Budget pro Step < 30 ms.
- **i18n:** Deutsch + Englisch werden gleich behandelt; die Locale folgt
  dem bestehenden i18n-Setting. Keine zusätzliche Sprachauswahl.

---

## 4. Datenmodell

Erweitert das bestehende `QuestionPack` (`src/types.ts`) um optionale
Felder. Ältere Packs (ohne diese Felder) sind weiterhin gültig.

```ts
interface PersonalPackMeta {
  personalPack: true
  senderName: string
  recipientLabel: string
  anrede: string
}
type PersonalQuestionPack = QuestionPack & PersonalPackMeta
```

Interne Draft-Struktur (nur im `sessionStorage`):

```ts
interface SandraDraft {
  anchor: { relation: string; anrede: string; birthYear?: number }
  questions: ComposedQuestion[]
  currentTriggerId?: string
  currentSeed?: string
}
interface ComposedQuestion {
  id: string
  triggerId: string
  group: 'biography' | 'relationship'
  text: string
  seed?: string
  createdAt: number
}
```

Bewusst **kein** `isPrivate`-Feld an `ComposedQuestion` – alle Fragen werden
gesendet.

---

## 5. URL-Format

```
// Sandra-Invite (Supabase konfiguriert + Identität bereit) – bevorzugt
{origin}/?qp={base64url(deflate-raw(JSON))}&contact={base64url(JSON)}

// Sandra-Invite Fallback (keine Kompression verfügbar)
{origin}/?qp-plain={base64url(JSON)}&contact={base64url(JSON)}

// Pack-only (kein Supabase / Identität noch nicht bereit)
{origin}/?qp={base64url(deflate-raw(JSON))}
{origin}/?qp-plain={base64url(JSON)}
```

Detection:
- `isSandraInviteHash()` → true wenn `qp` (oder `qp-plain`) **und** `contact`
  gleichzeitig vorhanden → kombinierter Flow.
- `isQuestionPackHash()` → true wenn nur `qp`/`qp-plain` vorhanden → Legacy
  Pack-only Flow.

Parsing synchron (`isSandraInviteHash`), Pack-Parsing asynchron mit Reuse
der bestehenden `decodeQuestionPack`-Schema-Guards (Max-Längen, enum-types).

---

## 6. Design-System

Vollständig im Friends-Tab-Vokabular umgesetzt
(`src/views/FriendsView.tsx` als Referenz, CSS-Block ab Z. 1633 in
`src/App.css`):

- Sektionen via `.friends-section` / `.friends-section-title`
- Listen via `.friends-list` (gap `0.75rem`)
- Karten via `.friend-card` (+ Modifier `.sandra-trigger-card`,
  `.sandra-suggestion`, `.sandra-question-row`)
- Pills via `.friends-tag` (+ `.sandra-chip`)
- Primärer CTA via `.share-cta-btn` (Logo-Gradient)
- Sekundär via `.btn.btn--ghost.btn--sm`
- Section B („Über uns zwei") via `.sandra-section--accent`
  (`--accent-tinted` Background + ❤ im Titel)
- Alle vier Themes (sepia, nacht, hell, ozean) bleiben funktional, weil
  ausschließlich `:root`-CSS-Variablen verwendet werden.

---

## 7. Accessibility

- Alle Touch-Targets ≥ 44 × 44 px; Empfänger-Mikrofon-Button ≥ 80 × 80 px.
- Trigger-Karten sind `<button>`-Elemente (keine `<div>` mit `onClick`).
- Textareas haben sichtbares Label + `aria-describedby` für Placeholder-
  Hints.
- Receiver-Progress wird per `role="progressbar"` mit `aria-valuenow` /
  `aria-valuemax` ausgezeichnet.
- Keyboard-Navigation folgt visueller Reihenfolge; Enter in der Composer-
  Textarea erzeugt einen Zeilenumbruch (kein Submit).
- Receiver erbt REQ-019-A11y, sobald Vereinfachter Bedienmodus aktiv ist.

---

## 7a. API-Vertrag (verbindlich für Impl + Tests)

### Pure Lib `templateEngine`

```ts
// src/lib/sandraFlow/templateEngine.ts
export function compose(
  template: TemplateDef,
  anrede: string,
  seed: string | undefined,
): string | null

export function composeAll(
  templates: TemplateDef[],
  anrede: string,
  seed: string | undefined,
): Array<{ template: TemplateDef; text: string }>

export function sanitizeSlot(value: string): string
```

### Pure Lib `packBuilder`

```ts
// src/lib/sandraFlow/packBuilder.ts
export function buildPersonalPack(
  draft: SandraDraft,
  senderName: string,
): PersonalQuestionPack

export function isPersonalPack(
  pack: QuestionPack | null | undefined,
): pack is PersonalQuestionPack
```

### URL-Helpers in `utils/secureLink`

```ts
export function isQuestionPackHash(): boolean
export function generateQuestionPackUrl(pack: QuestionPack): Promise<string>
export function generateQuestionPackUrlSync(pack: QuestionPack): string
export function parseQuestionPackFromHash(): Promise<QuestionPack | null>
export function isPersonalQuestionPack(pack: QuestionPack | null): pack is PersonalQuestionPack
```

### Container `<SandraFlowView>`

```ts
interface SandraFlowViewProps {
  profileName: string
  onBack: () => void
}
```

### Receiver `<PersonalPackReceiveView>`

```ts
interface PersonalPackReceiveViewProps {
  pack: PersonalQuestionPack
  onSubmit: (
    recipientName: string,
    answers: Array<{ questionId: string; questionText: string; value: string }>,
  ) => void
  onDismiss: () => void
}
```

---

## 8. Akzeptanztests (Definition of Done)

### Unit / Component

- [ ] `templateEngine.compose` substituiert `{anrede}` und `{seed}`,
  fällt bei leerem Seed auf `withoutSeed` zurück und gibt `null` zurück, wenn
  weder Seed noch `withoutSeed` vorhanden sind.
- [ ] `sanitizeSlot` strippt `<`, `>`, `` ` `` aus Slot-Werten.
- [ ] `buildPersonalPack` erzeugt einen `QuestionPack` mit `personalPack:
  true`, `senderName`, `recipientLabel`, `anrede` und einer
  `CustomQuestion[]` aus allen Draft-Fragen.
- [ ] `isPersonalPack` erkennt nur dann `true`, wenn die drei Pflicht-Meta-
  Felder vorhanden sind.
- [ ] `SandraFlowView` durchläuft Landing → Anchor → Trigger → Composer →
  List → Share mit `userEvent.click`, persistiert den Draft in
  `sessionStorage` und führt am Ende `navigator.share` aus.
- [ ] `PersonalPackReceiveView` zeigt den Auto-Suggest-Schritt nur, wenn der
  Empfänger noch nicht im Simple Mode ist; nach „Ja, einfach machen" wird
  `setAppMode('simple')` aufgerufen.
- [ ] Friends-Tab-Karte „Eigene Fragen formulieren" navigiert nach `#/ask`.

### End-to-End (Playwright)

- [ ] Happy Path: Landing → Anchor (Mama) → Trigger („Bevor es dich gab") →
  Composer (Seed leer → `withoutSeed`-Variante) → „Frage übernehmen" →
  Liste → „An Mama schicken" → Web-Share-Stub feuert.
- [ ] Empfänger-Seite: URL mit `?qp=…` öffnet die `PersonalPackReceiveView`,
  Auto-Suggest erscheint, „Ja, einfach machen" setzt `data-app-mode="simple"`
  und der erste Frage-Text wird gerendert.
- [ ] Friends-Tab → „Loslegen" navigiert nach `#/ask`.

### Manuelle Device-Verification

- [ ] iOS-Safari: Web-Share-Sheet öffnet, Link landet in der Vorschau.
- [ ] Android-Chrome: dito + Auto-Suggest auf dem Empfänger-Gerät.

---

## 9. Offene Fragen / Risiken

- Pack-URLs können bei vielen Fragen mit langen Texten in der Länge wachsen.
  Mitigation: Komprimierung über `CompressionStream` greift, sobald
  verfügbar; Schema-Bound im Decoder (max. 200 Fragen, max. 2000 Zeichen
  pro Frage).

---

## Future Work / Backlog

### Empfänger ohne eigenes Smartphone

Ingrid hat heute oft kein eigenes Gerät, auf dem sie den Link öffnen
könnte. Die geplante Lösung: Sandra wird zur **Proxy-Senderin** und nimmt
Ingrids Antworten auf ihrem eigenen Gerät auf – über Audio-Aufnahme +
Live-Transkript, geführt durch dieselbe One-Question-at-a-Time-Sequenz.

Designtagebuch (TBD-Diskussion):

- **Authentizität:** Antworten im Archiv werden mit `authoredBy: 'proxy'`
  markiert, damit später erkennbar bleibt, dass nicht Ingrid selbst
  geschrieben hat. Optional: ein Audio-Snippet pro Frage als
  Authentizitäts-Beleg.
- **UX:** Im Proxy-Modus läuft der Flow nicht auf Ingrids URL-Empfangs-
  Geräte, sondern als zusätzliche Aktion an einem fertigen Pack auf Sandras
  Gerät („Mit Mama gemeinsam beantworten").
- **Audio-Aufnahme in Proxy-Kontext:** Re-Use von REQ-009; offen ist die
  Speicher-Strategie für viele Audios (Proxy-Sessions können lang sein).
- **Print-Fallback:** für Familien ohne Smartphone überhaupt – ein
  einfacher PDF-Druck der Fragenliste als Papier-Ausdruck.

Diese Punkte sind **bewusst nicht** Teil von v2.7.0 und werden erst nach
Nutzer-Feedback aus dem Sandra-First-Flow priorisiert.

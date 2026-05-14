# ADR-002: CustomQuestionsView und SandraFlow als zwei distinkte Wege

**Status:** ✅ ACCEPTED
**Datum:** 2026-05-13
**Autor:** Storyhold-Team (Persona-Programm Iteration 1)
**Betroffene Bereiche:** `src/views/CustomQuestionsView.tsx`, `src/components/sandraFlow/*`, `src/views/SandraFlowView.tsx`, `src/views/PersonalPackReceiveView.tsx`
**Referenz-Issue:** [#178](https://github.com/saturas89/storyhold/issues/178) — „CustomQuestions vs. SandraComposerStep: zwei parallele Wege ohne Guidance, welcher kanonisch ist"

---

## 1. Kontext

Das Persona-Programm hat eine Architektur-Frage geöffnet: Aus Sicht der Sandra-Käufer-Persona sehen `CustomQuestionsView` und `SandraComposerStep` aus wie **zwei Wege für dasselbe Ziel** (eigene Fragen für jemanden anderen erstellen). Die Persona hat das zu Recht als „Orientierungslos-Architektur" markiert:

> „Es gibt zwei parallele Wege, Fragen für Mama zu erstellen: CustomQuestionsView (plain text-Input, Pack-Code-Import) und SandraComposerStep (Template-Engine, Trigger-Chips, Seed-Textarea, Inspirationsschublade). Ich als Userin sehe beide, aber nirgendwo steht, welchen ich nehmen soll und warum." — Sandra (42)

Bei genauer Code-Lektüre stellt sich heraus: Die beiden Flows nutzen zwar **dasselbe Datenmodell** (`CustomQuestion[]`), bedienen aber **zwei semantisch verschiedene Use-Cases**:

| | CustomQuestionsView | SandraFlow (`#/ask`) |
|---|---|---|
| **Use-Case** | Eigene Erinnerungen festhalten | Fragen-Geschenk für jemand anderen |
| **Subjekt** | Ich erinnere mich | Ich frage dich |
| **Output** | Lokales Archiv (eigene Erinnerung) | Sharable Pack-URL für eine andere Person |
| **Einstieg** | Home-Kategorie „Eigene Erinnerung" + ggf. Pack-Code-Import | `#/ask`-Route + Sandra-Entry-Card im Friends-Tab |
| **UI-Schwerpunkt** | Titel + Antwort-Editor + MediaCapture | Geführte Komposition: Anrede → Trigger → Seed → Vorschläge → Frage |
| **Lokale Speicherung** | Persistiert in eigenem `customQuestions[]` + zugehörige Antworten | Nur sessionStorage-Draft, bis das Pack versendet ist |
| **Empfänger** | Es gibt keinen — die Erinnerung gehört dem Nutzer | `PersonalPackReceiveView` mit weichem „Ingrid"-Receiver-Layout |

Das Datenmodell-Sharing ist eine Implementierungs-Konvenienz (beide produzieren `CustomQuestion`-Items, beide nutzen denselben Pack-Code-Mechanismus für Share/Receive). Es ist **keine Aussage darüber, dass die Use-Cases identisch wären**.

---

## 2. Betrachtete Optionen

### Option A — SandraComposerStep zum kanonischen Pfad erklären, CustomQuestionsView verschmelzen

CustomQuestionsView wird in den SandraComposer-Stack integriert; das „eigene Erinnerung festhalten" passiert dann als Sub-Modus desselben Flows. Pack-Code-Import wandert in einen optionalen Sub-Schritt der SandraFlow-Landing.

- ✔️ Eine einzige Code-Stelle für „Frage zu CustomQuestion → Pack".
- ❌ Bricht den emotionalen Anker der „Eigene Erinnerung"-Home-Karte (Ingrid: „Hier sind *meine* Geschichten").
- ❌ Sandra-Flow ist explizit auf Geschenk-Modus optimiert (Trigger-Chips, Anrede, Inspirations-Drawer). Diese UX wäre für „eigene Erinnerung festhalten" wuchtig und ablenkend.
- ❌ E2E-Coverage von `e2e/custom-questions.spec.ts` und der Pack-Code-Import-Pfad müssten neu verkabelt werden.
- ❌ Das Datenmodell-Sharing löst sich auf: SandraDraft persistiert in sessionStorage, CustomQuestion in localStorage — eine Verschmelzung würde mindestens eines der beiden Modelle aufgeben.

### Option B — CustomQuestionsView zum kanonischen Pfad erklären, SandraFlow als Marketing-Pfad

SandraFlow wird auf eine reine Landing-/Trichter-Funktion reduziert; nach der Anrede landet der Nutzer in CustomQuestionsView mit vorausgefüllten Werten.

- ✔️ Macht das Datenmodell zur kanonischen Wahrheit.
- ❌ Bricht die Persona-Studie: Sandra hat den Composer als „intelligenteren Weg" beschrieben und SandraFlow ist genau für sie konzipiert (Trigger-Karten lenken sie zum „Welche Frage stelle ich Mama?"-Moment).
- ❌ Verliert den `#/ask`-Deep-Link-Wert für gezielte Marketing-Kampagnen.
- ❌ Das Plain-Text-Eingabefeld in CustomQuestionsView ist *zu offen* für jemanden, die in der „Geschenk-Suche-Modus"-Mindset ist.

### Option C — Beide Pfade behalten, Use-Cases explizit benennen, Cross-Hints einbauen (gewählt)

Anerkennung, dass die beiden Pfade verschiedene Probleme lösen. Persona-Verwirrung wird mit zwei kleinen Anpassungen behoben:
1. **Inline-Hint in CustomQuestionsView:** „Möchtest du Fragen für jemand anderen vorbereiten? → Sandra-Flow nutzen" mit Link zu `#/ask`.
2. **Inline-Hint im Sandra-Flow-Entry-Card (FriendsView) und auf der Landing:** „Möchtest du eigene Erinnerungen festhalten? → Eigene-Erinnerung-Karte auf dem Lebensweg-Tab".

- ✔️ Respektiert beide Use-Cases.
- ✔️ Senior-Persona-konform: Ingrid bleibt in „Eigene Erinnerung", Sandra bleibt in `#/ask`.
- ✔️ Kein Migrationsaufwand, kein Test-Refactor.
- ✔️ Die Persona-Beschwerde ist eine **Orientierungs-Beschwerde**, keine Funktionalitäts-Beschwerde — Cross-Hints lösen das.
- ❌ Zwei Code-Pfade bleiben, leichte Wartungs-Mehrkosten bei Wording-Änderungen im CustomQuestion-Datenmodell.

---

## 3. Entscheidung

**Option C — Beide Pfade behalten, Use-Cases explizit benennen.**

`CustomQuestionsView` und `SandraFlow` sind **keine Duplikate**, sondern lösen zwei verschiedene User-Intents auf einem gemeinsamen Datenmodell:

| Use-Case | Kanonischer Pfad | Einstieg |
|---|---|---|
| **„Ich will *meine* Erinnerung festhalten oder mit jemandem teilen, damit sie ihre Gedanken ergänzen können"** | `CustomQuestionsView` | Home → „Eigene Erinnerung"-Karte (Voll-Modus) |
| **„Ich will *jemand anderem* Fragen schicken, die *sie* beantworten soll"** | `SandraFlow` (`#/ask`) | Friends-Tab → „Eigene Fragen für jemanden formulieren" oder direkter Deep-Link |
| **„Ich habe ein Pack von jemandem bekommen und will ihre Fragen importieren"** | `CustomQuestionsView` Pack-Code-Import | Home → „Eigene Erinnerung" → Sektion „Erinnerungen importieren" |

Die geteilte `CustomQuestion[]`-Datenstruktur und der `QuestionPack`-Share-Mechanismus sind eine **Implementierungs-Konvenienz**, kein Architektur-Versprechen. Beide Pfade dürfen sich unabhängig weiterentwickeln, solange das Pack-Format bidirektional bleibt.

---

## 4. Konsequenzen

### Sofort umzusetzen (in dieser ADR-PR)

- Inline-Hint-Sektion in `CustomQuestionsView` zwischen `addHeading` und `listHeading`, die auf den Sandra-Flow zeigt für „Fragen für jemand anderen vorbereiten".
- Inline-Hint im `SandraLanding` (Screen 1 des Sandra-Flows) für den umgekehrten Pfad: „Eigene Erinnerungen festhalten → Eigene-Erinnerung-Karte auf dem Lebensweg-Tab".
- Locale-Strings DE + EN für beide Hints.

### Bewusst nicht umgesetzt

- **Keine Daten-Migration** — die `CustomQuestion[]`-Persistenz bleibt unverändert.
- **Keine Sandra-Composer-Integration in CustomQuestionsView** — würde den Senior-Persona-Modus brechen.
- **Keine Profil-Settings-Konsolidierung** — bewusst getrennte Surface Areas.

### Zukünftige Änderungen

- Wenn `CustomQuestion[]`-Schema sich weiterentwickelt (z. B. Reihenfolge, Tags), MUSS die Veränderung in **beiden** Pfaden synchron geprüft werden. Ein gemeinsamer Test-Helper in `src/test-helpers/customQuestionFixtures.ts` ist die Stelle, an der die Synchronizität nachvollziehbar bleibt.
- Falls eine dritte Surface (z. B. ein KI-Biografie-Mode aus REQ-008) ebenfalls `CustomQuestion`-Items produziert, MUSS sie sich an dieser ADR orientieren: eigener Use-Case → eigener kanonischer Pfad → Cross-Hint zu den Geschwistern.

### Auswirkungen auf andere REQs

- **REQ-019 (Vereinfachter Bedienmodus)**: SandraFlow bleibt im Vereinfachten Modus weiterhin **ausgeblendet** (per `HIDDEN_IN_SIMPLE` in `App.tsx`). Die Senior-Persona Ingrid sieht nur den CustomQuestion-Pfad — konsistent mit ihrem „eigene Erinnerung"-Mindset.
- **REQ-020 (Sandra-Flow)**: Diese ADR formalisiert die Co-Existenz mit REQ-002 (Frage-Engine). Beide bleiben unabhängig.

---

## 5. Persona-Statement zur Validierung

Diese Entscheidung antwortet direkt auf Sandras Beschwerde aus dem Initial-Review:

> „Der Composer ist der intelligentere Weg [für Geschenke], aber er ist unsichtbar hinter einem Trigger-Auswahlschritt vergraben — das ist Orientierungslos-Architektur."

Mit den Cross-Hints aus Konsequenz §4.1 sieht Sandra im CustomQuestion-Pfad einen klaren Verweis: „Wenn du Fragen *für jemanden anderen* vorbereitest, ist das hier nicht der schnellste Weg → Sandra-Flow." Sie landet beim ersten Versuch im richtigen Werkzeug.

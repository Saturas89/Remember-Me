# REQ-018 – Sync Key Loss Reset

> Single source of truth für **Implementation Agent** und **Test Agent**.
> Abschnitte 1–8 sind gemeinsam; 9–11 richten sich an den Implementation Agent;
> 12–15 an den Test Agent.

**Status:** 🟢 DRAFT
**ID:** REQ-018
**Version:** -
**Letzte Aktualisierung:** 2026-05-09
**Modul:** Sync
**Priorität:** Medium
**Verwandt:** REQ-017 (Privater Sync) – baut darauf auf.

---

## 1. Product Overview

Wer auf dem Sync-Login-Screen `enter-code` (siehe REQ-017 §6) seinen
24-stelligen Sicherheitsschlüssel verloren hat, sitzt heute fest. Es gibt im
UI keinen Ausweg, obwohl Zero-Knowledge bedeutet, dass die Cloud-Daten ohne
Schlüssel ohnehin unwiederbringlich sind.

REQ-018 ergänzt einen dezenten **„Schlüssel verloren?"-Link** unter dem
Entschlüsseln-Button. Klick öffnet ein Erklär-Modal; Bestätigung erzeugt einen
neuen Recovery-Code und springt in den bestehenden `recovery-code`-Schritt.
Der erste Push verschlüsselt den lokalen `AppState` mit dem neuen Vault-Key
und überschreibt damit den alten Cloud-Ciphertext. Lokale Daten bleiben
erhalten; alte Cloud-Daten werden beim ersten Push ersetzt — kein expliziter
Cloud-Löschvorgang.

---

## 2. User Stories

### US-001 · Recovery-Link sichtbar
**Als Nutzer mit verlorenem Schlüssel** möchte ich auf dem `enter-code`-Screen
einen sichtbaren Ausweg haben, **damit** ich nicht im Sync-Login feststecke.

Akzeptanzkriterien:
- AC-001-1: Auf dem `enter-code`-Schritt erscheint unter dem Entschlüsseln-
  Button ein Text-Button mit dem Übersetzungs-Key `lostKeyLink`.
- AC-001-2: Der Link ist immer sichtbar (nicht erst nach Fehlversuchen).

### US-002 · Erklär-Modal vor Reset
**Als Nutzer** möchte ich vor dem Reset klar erklärt bekommen, was passiert,
**damit** ich nicht versehentlich Cloud-Daten zerstöre.

Akzeptanzkriterien:
- AC-002-1: Klick auf den Lost-Key-Link öffnet ein modales Overlay mit Titel
  `lostKeyTitle`, Body `lostKeyBody`.
- AC-002-2: Modal hat zwei Buttons: `lostKeyConfirm` (danger-Style) und
  `lostKeyCancel` (ghost-Style).
- AC-002-3: `lostKeyCancel` schließt das Modal; Step bleibt `enter-code`,
  `enteredCode` und `codeError` bleiben unverändert.

### US-003 · Reset führt zurück in Setup
**Als Nutzer** möchte ich nach Bestätigung einen frischen Recovery-Code
erhalten und den Sync neu aufsetzen, **damit** ich auf demselben Gerät
weiterarbeiten kann.

Akzeptanzkriterien:
- AC-003-1: Klick auf `lostKeyConfirm` ruft `clearCachedVaultKey(userId)`
  (best-effort, Fehler werden geschluckt).
- AC-003-2: `enteredCode` wird auf `''` gesetzt, `codeError` auf `null`,
  `showLostKeyDialog` auf `false`.
- AC-003-3: `generateRecoveryCode()` wird aufgerufen, das Resultat in
  `recoveryCode` gespeichert.
- AC-003-4: Step wechselt auf `recovery-code`; auf dem Screen erscheint der
  formatierte Code in der Code-Box.
- AC-003-5: Der bestehende `handleRecoveryCodeConfirm`-Pfad ist unverändert
  (kein Behaviour-Change in REQ-017).

### US-004 · Cloud-Daten werden überschrieben
**Als Nutzer** erwarte ich, dass nach dem Reset der erste automatische Push
die alten Cloud-Daten ersetzt, **damit** kein orphaner Ciphertext zurückbleibt.

Akzeptanzkriterien:
- AC-004-1: Kein expliziter Cloud-DELETE-Call beim Reset (Strategie
  „Beim ersten Push überschreiben").
- AC-004-2: Da Supabase-Upsert auf `user_id` arbeitet und Drive/OneDrive die
  Datei mit gleicher syncId überschreiben, ist nach dem ersten erfolgreichen
  `syncNow()` der alte Ciphertext weg. (Kein neuer Code dafür nötig — bereits
  in REQ-017 vorhanden.)

---

## 3. Shared Types & Contracts

### Neue Translation-Keys (`src/locales/types.ts` → `Translations.privateSync`)

```ts
lostKeyLink: string
lostKeyTitle: string
lostKeyBody: string
lostKeyConfirm: string
lostKeyCancel: string
```

Reihenfolge: direkt unter den bestehenden `enterCode*`-Keys einfügen.

### Locale-Werte

| Key                | DE                                                                                                                                                                                                                              | EN                                                                                                                                                                                       |
|--------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `lostKeyLink`      | `Schlüssel verloren?`                                                                                                                                                                                                           | `Lost your key?`                                                                                                                                                                         |
| `lostKeyTitle`     | `Sicherheitsschlüssel verloren`                                                                                                                                                                                                 | `Security key lost`                                                                                                                                                                      |
| `lostKeyBody`      | `Ohne Schlüssel sind deine in der Cloud verschlüsselten Daten nicht mehr wiederherstellbar. Lokale Daten auf diesem Gerät bleiben erhalten und werden mit einem neuen Sicherheitsschlüssel neu verschlüsselt – die alten Cloud-Daten werden dabei überschrieben.` | `Without your key, your encrypted cloud data cannot be recovered. Local data on this device is preserved and will be re-encrypted with a new security key — the old cloud data will be overwritten.` |
| `lostKeyConfirm`   | `Neu starten`                                                                                                                                                                                                                   | `Start fresh`                                                                                                                                                                            |
| `lostKeyCancel`    | `Abbrechen`                                                                                                                                                                                                                     | `Cancel`                                                                                                                                                                                 |

### Komponente: keine neue Komponente

Inkrementelle Erweiterung von `PrivateSyncSetupView` (Schritt `enter-code`).
Keine neuen exportierten Symbole, kein neuer Hook.

### Wiederverwendete Bausteine
- `clearCachedVaultKey()` — `src/utils/recoveryCode.ts:133-143`
- `generateRecoveryCode()` — `src/utils/recoveryCode.ts:12-23`
- Modal-Markup-Pattern — `src/views/PrivateSyncHubView.tsx:124-154`
- `handleRecoveryCodeConfirm()` + `onComplete`-Pfad in `App.tsx` (unverändert)

---

## 4. Verhaltensbeschreibung (Sequenz)

1. Nutzer ist auf `enter-code`-Schritt von `PrivateSyncSetupView`
   (Provider gesetzt, `userId` gesetzt — nach Login).
2. Klick auf `s.lostKeyLink` → `setShowLostKeyDialog(true)`.
3. Modal mit `s.lostKeyTitle` / `s.lostKeyBody` und zwei Buttons rendert.
4. Pfad A — `s.lostKeyCancel`: `setShowLostKeyDialog(false)`, sonst nichts.
5. Pfad B — `s.lostKeyConfirm`: ruft `handleLostKeyReset()`:
   - `await clearCachedVaultKey(userId)` (try/catch, best-effort)
   - `setEnteredCode('')`, `setCodeError(null)`, `setShowLostKeyDialog(false)`
   - `setRecoveryCode(generateRecoveryCode())`
   - `setStep('recovery-code')`
6. Standard-Pfad ab `recovery-code` → Bestätigung → `onComplete` → `App.tsx`
   ruft `savePrivateSync(...)` + `privateSync.syncNow()`. Erster Push
   überschreibt alten Ciphertext mit neuem Vault-Key.

---

## 5. Navigation / UX

- Kein neuer Tab, kein neuer Screen.
- Lost-Key-Link sitzt **unter** dem Entschlüsseln-Button im selben
  `private-sync-view__content`-Wrapper.
- Modal benutzt bestehendes `modal-overlay` / `modal-box`-Markup.

---

## 6. Setup-Wizard UX

Erweiterung von REQ-017 §6, Schritt 5 (`enter-code`):

```
┌────────────────────────────────────────┐
│ Sicherheitsschlüssel eingeben          │
│                                        │
│ Gib deinen gespeicherten Sicherheits-  │
│ schlüssel ein, um deine verschlüssel-  │
│ ten Daten zu entschlüsseln.            │
│                                        │
│ Sicherheitsschlüssel                   │
│ [XXXX-XXXX-XXXX-XXXX-XXXX-XXXX]        │
│                                        │
│ [    Entschlüsseln    ]                │
│ [  Schlüssel verloren?  ]   ← NEU      │
└────────────────────────────────────────┘
```

Modal nach Klick auf den neuen Link:

```
┌────────────────────────────────────────┐
│ Sicherheitsschlüssel verloren          │
│                                        │
│ Ohne Schlüssel sind deine in der       │
│ Cloud verschlüsselten Daten nicht      │
│ mehr wiederherstellbar. …              │
│                                        │
│ [   Neu starten   ]   (danger)         │
│ [   Abbrechen     ]   (ghost)          │
└────────────────────────────────────────┘
```

---

## 7. Sync-Hub UX

Keine Änderung am bestehenden `PrivateSyncHubView`. Nach erfolgreichem Reset
landet der Nutzer wie gewohnt im Hub mit dem neuen Schlüssel.

---

## 7a. API-Vertrag (verbindlich für Impl + Tests)

### Komponente `PrivateSyncSetupView` – neue interne Symbole

Keine neuen Props, keine neuen Exports. Interne Erweiterungen:

```ts
// neuer State (innerhalb der Komponente)
const [showLostKeyDialog, setShowLostKeyDialog] = useState<boolean>(false)

// neue Handler-Funktion (innerhalb der Komponente)
async function handleLostKeyReset(): Promise<void>
```

### DOM-Contract (für Test Agent)

- Lost-Key-Trigger ist ein `<button type="button">` mit dem Text aus
  `s.lostKeyLink` (DE: `Schlüssel verloren?`, EN: `Lost your key?`).
- Modal ist erreichbar via `getByRole('dialog')`.
- Modal-Buttons sind `<button type="button">` mit den Texten aus
  `s.lostKeyConfirm` und `s.lostKeyCancel`.
- Auf dem `recovery-code`-Screen erscheint der formatierte Code als
  Text-Knoten (`<code class="private-sync-view__code">`).

---

## 8. Akzeptanztests (Definition of Done)

> Pflicht laut [docs/testing-conventions.md](../testing-conventions.md).

### Unit / Component
- [ ] Component-Test rendert `<PrivateSyncSetupView>` mit echten
      Locale-Strings (Translation-Provider real, nicht gemockt).
- [ ] Mindestens ein Test ruft `fireEvent.click` auf jedem zentralen
      Interaktionselement (Lost-Key-Link, Confirm-Button, Cancel-Button)
      und assertet den Folgezustand.
- [ ] Edge-Case: `clearCachedVaultKey` darf werfen, ohne den Reset zu blocken.

### End-to-End (Playwright)
- Nicht im Scope dieses REQs (manuelle Verifikation in §15 reicht; die
  Playwright-Matrix in CI deckt den Setup-Wizard implizit über REQ-017 ab).

### Manuelle Device-Verification
- Nicht erforderlich (rein UI-Kombination aus existierenden Bausteinen,
  kein neues System-API).

---

# ── IMPLEMENTATION AGENT BRIEF ──

## 9. Edits

### §9.1 — `src/locales/types.ts`
Im `privateSync`-Block des `Translations`-Interface (~Zeile 582–644) die fünf
Keys aus §3 ergänzen, direkt unter den `enterCode*`-Keys.

### §9.2 — `src/locales/de/ui.ts`
Im `privateSync`-Block (~544–606) die fünf DE-Werte aus der Tabelle in §3
einfügen, in derselben Reihenfolge wie in §9.1.

### §9.3 — `src/locales/en/ui.ts`
Analog mit den EN-Werten.

### §9.4 — `src/views/PrivateSyncSetupView.tsx`
- Imports erweitern: `clearCachedVaultKey` zur bestehenden Import-Zeile aus
  `'../utils/recoveryCode'` hinzufügen (kein neuer Import-Statement).
- Neuer State direkt nach den anderen Code-States (~Zeile 36):
  ```tsx
  const [showLostKeyDialog, setShowLostKeyDialog] = useState(false)
  ```
- Neue Handler-Funktion direkt nach `handleEnterCode`, vor `// ── Screens ──`:
  ```tsx
  async function handleLostKeyReset() {
    try { await clearCachedVaultKey(userId) } catch { /* best-effort */ }
    setEnteredCode('')
    setCodeError(null)
    setShowLostKeyDialog(false)
    setRecoveryCode(generateRecoveryCode())
    setStep('recovery-code')
  }
  ```
- Im `enter-code`-Block (Zeile 418–448), direkt nach dem Entschlüsseln-Button
  und vor dem schließenden `</div>` des `private-sync-view__content`-Wrappers:
  ```tsx
  <button
    type="button"
    className="btn btn--ghost btn--full"
    onClick={() => setShowLostKeyDialog(true)}
  >
    {s.lostKeyLink}
  </button>
  ```
- Modal-Overlay analog zu `PrivateSyncHubView.tsx:124-154`, gated durch
  `showLostKeyDialog`, **innerhalb** des `<div className="private-sync-view">`-
  Wrappers, nach dem Content-Wrapper:
  ```tsx
  {showLostKeyDialog && (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-box">
        <h3 className="modal-box__title">{s.lostKeyTitle}</h3>
        <p className="modal-box__body">{s.lostKeyBody}</p>
        <div className="modal-box__actions">
          <button
            className="btn btn--danger btn--full"
            onClick={handleLostKeyReset}
            type="button"
          >
            {s.lostKeyConfirm}
          </button>
          <button
            className="btn btn--ghost btn--full"
            onClick={() => setShowLostKeyDialog(false)}
            type="button"
          >
            {s.lostKeyCancel}
          </button>
        </div>
      </div>
    </div>
  )}
  ```

### §9.5 — Changelog & Versions-Bump
Funktionales Feature → CLAUDE.md-Pflicht:
- `package.json#version`: minor bump (lies aktuelle Version, setze
  `x.(y+1).0`).
- `docs/CHANGELOG.md`: neuer `## [<neue-version>] – 2026-05-09`-Abschnitt
  am **Anfang der Liste** mit Sektion `### Hinzugefügt`:
  > Sync-Login: Option „Schlüssel verloren?" – ermöglicht einen Neustart
  > mit frischem Sicherheitsschlüssel; lokale Daten bleiben erhalten,
  > alte Cloud-Daten werden beim ersten Push überschrieben.
  Außerdem in der „Versionsübersicht"-Tabelle neue Zeile ganz oben.
- `src/data/releaseNotes.ts`: neuer Eintrag am **Anfang** des Arrays:
  ```ts
  {
    version: '<neue-version>',
    date: '2026-05-09',
    highlights: [
      '🔑 Neue Option „Schlüssel verloren?" im Sync-Login – starte mit einem frischen Sicherheitsschlüssel neu, ohne lokale Daten zu verlieren.',
    ],
  }
  ```
  (Falls das `ReleaseNote`-Interface andere Felder erwartet, an das bestehende
  Format halten — vor dem Edit den ersten existierenden Eintrag im Array
  lesen und nachbilden.)

## 10. npm-Abhängigkeiten

Keine. Alles mit existierenden Bausteinen lösbar.

## 11. Selbst-Validierung & Rückgabe

- `npm run check:changelog` → grün.
- `npx tsc --noEmit` (oder das im Repo definierte Type-Check-Script) → grün.
- `npm run lint` falls vorhanden → grün.

Rückgabe (<200 Wörter):
- Welche Dateien angefasst.
- Welche Version gewählt.
- Ob alle Self-Checks grün waren.
- Etwaige Abweichungen vom Brief und Begründung.

**Verboten:** Tests schreiben/ändern; Crypto-Logik (`recoveryCode.ts`,
`syncEncryption.ts`) berühren; `usePrivateSync.ts` ändern; commit/push.

---

# ── TEST AGENT BRIEF ──

## 12. Unit-Tests

### §12.1 — Neue Test-Datei
`src/views/PrivateSyncSetupView.test.tsx` (existiert noch nicht).

Stack: Vitest + Testing Library + jsdom (Standard im Repo). Imports:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PrivateSyncSetupView } from './PrivateSyncSetupView'
```

### §12.2 — Mocks
Damit die Komponente in den `enter-code`-Step gelangt, mocke:

1. **`../utils/recoveryCode`** — komplett:
   ```ts
   vi.mock('../utils/recoveryCode', () => ({
     generateRecoveryCode: vi.fn(() => 'AAAABBBBCCCCDDDDEEEEFFFF'),
     formatRecoveryCode: vi.fn((c: string) =>
       c.match(/.{1,4}/g)?.join('-') ?? c,
     ),
     deriveVaultKey: vi.fn(async () => ({} as CryptoKey)),
     cacheVaultKey: vi.fn(async () => {}),
     clearCachedVaultKey: vi.fn(async () => {}),
     decryptText: vi.fn(async () => '{}'),
   }))
   ```
2. **`../utils/privateSyncClient`** — Supabase-Stub:
   ```ts
   vi.mock('../utils/privateSyncClient', () => ({
     getSyncSupabaseClient: () => ({
       auth: {
         signInWithPassword: vi.fn(async () => ({
           data: { user: { id: 'test-user-id' } },
           error: null,
         })),
         signUp: vi.fn(),
       },
       from: () => ({
         select: () => ({
           eq: () => ({ single: vi.fn(async () => ({ data: null })) }),
         }),
       }),
     }),
   }))
   ```
3. **i18n** — `useTranslation` aus `'../locales'` darf real benutzt werden;
   die Strings aus §3 sind dann live im DOM. Vor dem Schreiben des Tests
   einmal `src/locales/index.ts` überfliegen und die Default-Locale prüfen
   (DE oder EN). Assertions auf die passende Sprache eichen oder Regex-OR.

### §12.3 — Helper: in den `enter-code`-Step kommen
Pfad über Supabase:
1. Render `<PrivateSyncSetupView onComplete={vi.fn()} />`.
2. Klick auf `setupButton` (Intro → provider-choice).
3. Klick auf `supabaseTitle`-Provider-Card.
4. Klick auf `continueButton` (provider-choice → login).
5. Email + Passwort eintippen, Klick auf `signInButton`.
6. `signInWithPassword`-Mock resolved erfolgreich → Komponente springt nach
   `enter-code`.

Pack diesen Pfad in eine `async function gotoEnterCode()`-Helper am Anfang
des `describe`-Blocks. Verwende `findByText`/`findByRole` mit `waitFor`
wegen lazy Provider-Imports.

### §12.4 — Test-Cases (alle unabhängig grün)

#### L-01 — Link sichtbar
Nach `gotoEnterCode()` ist ein Button mit Text aus `lostKeyLink` vorhanden:
```ts
expect(await screen.findByRole('button', { name: /Schlüssel verloren\?|Lost your key\?/ }))
  .toBeInTheDocument()
```

#### L-02 — Cancel schließt Modal
- `gotoEnterCode()`
- Klick auf Lost-Key-Link → Dialog mit Titel `lostKeyTitle` erscheint
  (`findByRole('dialog')`).
- Klick auf Button mit Text `lostKeyCancel` → Dialog verschwindet
  (`queryByRole('dialog')` ist `null`).
- Eingabefeld ist weiterhin im Dokument.

#### L-03 — „Neu starten" wechselt zu recovery-code
- `gotoEnterCode()`
- Klick auf Lost-Key-Link, dann auf Button mit Text `lostKeyConfirm`.
- Erwartungen:
  - `clearCachedVaultKey` wurde mit `'test-user-id'` aufgerufen.
  - Auf dem neuen Screen ist der formatierte Code im DOM:
    `await screen.findByText('AAAA-BBBB-CCCC-DDDD-EEEE-FFFF')`.
  - Lost-Key-Link ist nicht mehr sichtbar
    (`queryByRole('button', { name: /Schlüssel verloren\?|Lost your key\?/ })`
    ist `null`).

## 13. E2E-Tests (Playwright)

Nicht im Scope dieses REQs (siehe §8 — Setup-Wizard wird durch REQ-017-
Suite abgedeckt; manuelle Verifikation in §15 reicht).

## 14. Implementierungsnotizen für den Test Agent

- **Verboten:** `PrivateSyncSetupView.tsx`, Locale-Dateien, `package.json`,
  Changelog, ReleaseNotes anfassen; Crypto-Code mocken über das in §12.2
  Genannte hinaus; commit/push.
- Solange der Implementation-Agent noch läuft, können die Tests rot sein.
  Du kannst sie trotzdem schreiben, einmal lokal laufen lassen, und im
  Bericht den Status festhalten („grün" / „rot wegen X — erwartet, weil
  Implementation noch nicht eingecheckt").

## 15. Manuelle Verifikation (post-merge)

1. `npm run dev`, Sync-Tab öffnen.
2. Setup mit Supabase + Test-Account, ausloggen, neu einloggen → `enter-code`.
3. Falschen Code eingeben → Fehlertext + sichtbarer Lost-Key-Link.
4. Klick → Modal sichtbar; Abbrechen schließt nur.
5. Neu starten → recovery-code-Screen mit neuem 24-stelligen Code.
6. Bestätigen → Hub erscheint, lokale Daten weiter da, Cloud-Push
   überschreibt alten Ciphertext (in Supabase Dashboard prüfbar).

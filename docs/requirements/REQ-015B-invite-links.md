# REQ-015-B – Kurze Einladungslinks & automatisch bidirektionaler Handshake

**Status:** ✔️ COMPLETED  
**ID:** REQ-015-B  
**Version:** 1.0.0  
**Letzte Aktualisierung:** 2026-05-24  
**Modul:** Sharing / Sync  
**Priorität:** High  
**Implementiert seit:** v2.14.0  
**PR:** #332  
**Hängt an:** [REQ-015 – Familienmodus](./REQ-015-familienmodus.md), [REQ-020 – Sandra-Flow](./REQ-020-sandra-flow.md)

---

## 1. Problem & Motivation

Der Sandra-Flow erzeugte bis v2.13.0 selbst-enthaltende URLs, die den kompletten Pack-Payload und den `ContactHandshake` Base64-kodiert im URL-Fragment trugen:

| Alt-Format | Beispiellänge |
|---|---|
| `/?contact={base64(handshake)}` | 400–600 Zeichen |
| `/?qp={pack}&contact={handshake}` | 400–2 000+ Zeichen |

Diese URLs sind für die Zielgruppe (Sandra, 42; Ingrid, 67) unbrauchbar:
- Zu lang für eine SMS
- Sehen nicht wie ein vertrauenswürdiges Produkt aus
- WhatsApp-Vorschau und iMessage kürzen ab → Link funktioniert nicht

Außerdem war die Einladung **einseitig**: Ingrid musste manuell einen eigenen `#contact/…`-Link zurückschicken, um sich bei Sandra einzutragen. Dieser Schritt wurde in der Praxis häufig vergessen.

---

## 2. Lösung

Jede Sandra-Einladung bekommt einen **6-Zeichen-Code**, der in Supabase gespeichert wird:

```
https://storyhold.app/join/A3KX7P
```

→ 35 Zeichen. Passt in eine SMS. Klingt nach einem Produkt.

Nach dem Öffnen des Links und Beantworten der Fragen schreibt Ingrids App ihren öffentlichen Schlüssel automatisch in die Supabase-Zeile zurück. Sandras App pollt alle 5 Minuten und fügt Ingrid **ohne manuellen Schritt** als Freundin hinzu.

### 2.1 Was wurde entfernt

- `generateContactUrl()` / `generateSandraInviteUrlSync()` – kein Sync-Fallback mehr
- `parseContactFromHash()` / `isContactHash()` – alter `?contact=`-Parser
- `isSandraInviteHash()` / `isQuestionPackHash()` / `parseQuestionPackFromHash()`
- Manueller „Link zurückschicken"-Button in `ContactHandshakeView`
- Separater Contact-only-Einladungslink (nur noch Sandra-Flow)
- Kein Fallback auf lange URLs – Supabase-Fehler → sichtbare Fehlermeldung

### 2.2 Entscheidungen (Design Constraints)

| Thema | Entscheidung |
|---|---|
| Short-Code-Backend | Supabase (kein externer Dienst) |
| Code-Länge | 6 Zeichen |
| Code-Alphabet | `ACDEFGHJKMNPQRTVWXYZ234679` – ohne `O/0/I/1/8/B/L` (Senior-Lesbarkeit, telefonierbar) |
| Kollisionsraum | 26⁶ = 308 Mio. Kombinationen |
| Gültigkeit | 30 Tage, mehrfach verwendbar (kein One-Time-Use) |
| Kein Fallback | Wenn Supabase nicht erreichbar → Fehlermeldung, kein langer URL |
| Nur Sandra-Flow | Kein separater Contact-only-Link |
| Bidirektional | Automatisch – kein zweiter Link-Austausch nötig |

---

## 3. Architektur

### 3.1 Datenfluss (Sandra erstellt Einladung)

```
SandraFlowView (Share-Schritt)
  ↓ onShare()
SandraShareStep → createInviteAndGetUrl(pack, handshake)
  ↓
inviteService.ts
  ├─ generateInviteCode()        → zufälliger 6-Zeichen-Code
  ├─ supabase.from('invites')
  │    .insert({ code, payload: { pack, contact } })
  └─ return `${origin}/join/${code}`
  ↓
storePendingInvite(code)         → IndexedDB rm-invite-log
  ↓
URL wird dem Nutzer angezeigt / per Web-Share-API geteilt
```

### 3.2 Datenfluss (Ingrid öffnet Link)

```
Browser: GET /join/A3KX7P
  ↓ vercel.json Rewrite → /index.html
App.tsx (startup)
  ├─ pathname.match(/^\/join\/([A-Z0-9]{6})$/i)
  ├─ resolveInviteCode(code)
  │    → supabase.from('invites').select('payload').eq('code', code).single()
  ├─ history.replaceState({}, '', '/')    ← URL bereinigen
  ├─ setIncomingPack(pack)
  └─ setActiveInviteCode(code)
  ↓
PersonalPackReceiveView       ← Ingrid beantwortet die Fragen
  ↓
ContactHandshakeView
  ├─ Auto-Accept (wenn Online-Sharing aktiv)
  └─ submitInviteResponse(code, myContact)
       → supabase.from('invites').update({ response: responder }).eq('code', code)
```

### 3.3 Datenfluss (Sandra pollt Antwort)

```
usePendingInviteResponses (alle 5 min + beim Mount)
  ├─ getPendingInvites()          → IndexedDB, nur ohne respondedAt
  ├─ pollInviteResponse(code)    → supabase SELECT response WHERE code = …
  │    response ≠ null →
  │      addFriend(displayName, undefined, { deviceId, publicKey, linkedAt, shareAll: true })
  └─ markInviteResponded(code)   → IndexedDB respondedAt setzen
```

### 3.4 URL-Routing

`vercel.json` enthält den Rewrite an erster Stelle der `rewrites`-Liste:

```json
{ "source": "/join/:code", "destination": "/index.html" }
```

`App.tsx` parst synchron beim Start:

```typescript
const joinMatch = window.location.pathname.match(/^\/join\/([A-Z0-9]{6})$/i)
```

Danach asynchroner Resolve-Effect → URL wird auf `/` gesetzt, bevor der erste Paint erfolgt.

---

## 4. Datenbankschema

### 4.1 Tabelle `invites`

```sql
CREATE TABLE public.invites (
  code        TEXT PRIMARY KEY,          -- 6-stelliger Code (Großbuchstaben)
  payload     JSONB NOT NULL,            -- { pack: QuestionPack, contact: ContactHandshake }
  response    JSONB,                     -- ContactHandshake der antwortenden Person (null bis Accept)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days')
);
```

#### `payload`-Struktur (JSONB)

```typescript
interface InvitePayload {
  pack: QuestionPack       // Sandra's Fragenliste
  contact: ContactHandshake // Sandra's DeviceId + PublicKey + DisplayName
}
```

#### `response`-Struktur (JSONB, null bis Ingrid accepted)

```typescript
// ContactHandshake
{
  $type: 'remember-me-contact',
  version: 1,
  deviceId: string,    // Ingrids Supabase auth.uid()
  publicKey: string,   // ECDH P-256 SPKI base64url
  displayName: string
}
```

### 4.2 Row-Level Security

| Policy | Operation | Bedingung |
|---|---|---|
| `create_invite` | INSERT | `TO authenticated` – immer erlaubt |
| `read_invite` | SELECT | `TO authenticated` + `expires_at > now()` |
| `respond_invite` | UPDATE | `TO authenticated` + `expires_at > now() AND response IS NULL` → `response IS NOT NULL` |

Alle drei Policies gelten für die `authenticated`-Rolle. Die App ruft immer `ensureAnonymousSession()` vor jedem Supabase-Zugriff auf, sodass auch Ingrid (ohne Online-Sharing-Opt-in) einen anonymen JWT bekommt.

**Wichtig:** Es gibt keine `DELETE`-Policy. Ablauf erfolgt passiv (Rows bleiben nach `expires_at` in der DB, bis ein Cleanup-Job sie entfernt – aktuell manuell via Supabase Scheduled Functions).

### 4.3 Migration

`supabase/migrations/20260523000000_invite_codes.sql`

---

## 5. Module & Dateien

### 5.1 `src/utils/inviteService.ts` _(neu)_

Alle Supabase-Operationen auf der `invites`-Tabelle. Wird **ausschließlich dynamisch** importiert (`await import()`), nie statisch – bleibt damit außerhalb des Offline-Bundles.

| Funktion | Aufruf durch |
|---|---|
| `createInviteAndGetUrl(pack, contact)` | `SandraFlowView.onShare` |
| `resolveInviteCode(code)` | `App.tsx` (Startup-Effect) |
| `submitInviteResponse(code, responder)` | `ContactHandshakeView` (nach Accept) |
| `pollInviteResponse(code)` | `usePendingInviteResponses` |

Alle Funktionen rufen `ensureAnonymousSession()` auf, bevor sie die Supabase-Client-Instanz verwenden.

### 5.2 `src/utils/inviteLogStore.ts` _(neu)_

IndexedDB-Log für Sandras pending Invite-Codes.

- **DB:** `rm-invite-log`, **Store:** `pending-invites`, **Key:** `code`
- **Record:** `{ code: string, createdAt: string, respondedAt?: string }`

| Funktion | Zweck |
|---|---|
| `storePendingInvite(code)` | Nach erfolgreichem Supabase-Insert |
| `getPendingInvites()` | Nur Codes ohne `respondedAt` |
| `markInviteResponded(code)` | Nach erfolgreichem `addFriend()` |
| `cleanupExpiredInvites()` | Codes älter als 30 Tage löschen (beim Poll-Zyklus) |

### 5.3 `src/hooks/usePendingInviteResponses.ts` _(neu)_

Kein Re-Render, reiner Seiteneffekt. Läuft im `App`-Kontext nach dem Online-Sharing-Init-Block.

```typescript
usePendingInviteResponses(
  onlineSharingEnabled,  // Polling nur wenn aktiv
  addFriend,             // App-Callback
)
```

Poll-Intervall: 5 Minuten + sofort beim Mount. `inviteService` wird lazy importiert (bleibt außerhalb des Offline-Bundles).

### 5.4 `src/views/ContactHandshakeView.tsx` _(geändert)_

Neues optionales Prop `inviteCode?: string`.

- Kein „Link zurückschicken"-Button mehr (entfernt)
- Nach Auto-Accept: `submitInviteResponse(inviteCode, myContact)` wird automatisch aufgerufen (silently, kein re-try nötig – Sandra pollt bei nächstem Zyklus erneut)

### 5.5 `src/views/SandraFlowView.tsx` _(geändert)_

- `useMemo` für `onShare` muss **vor** den step-basierten Early-Returns stehen (React Rules of Hooks)
- Kein Sync-Fallback (`onShareSync`) mehr
- `onShare` = `async () => string` – gibt den fertigen Short-URL zurück

### 5.6 `src/App.tsx` _(geändert)_

- Synchrone Startup-Erkennung: `joinMatch = pathname.match(/^\/join\/([A-Z0-9]{6})$/i)`
- Asynchroner Resolve-Effect on mount
- `pathToView()`: `case 'join': return { name: 'home' }` (SPA bleibt auf Home während Resolve läuft)
- State: `activeInviteCode`, `embeddedContact`
- `usePendingInviteResponses` eingehängt

### 5.7 `vercel.json` _(geändert)_

Erster Eintrag in `rewrites`:
```json
{ "source": "/join/:code", "destination": "/index.html" }
```

---

## 6. Funktionale Anforderungen

- [x] **FR-15B.1:** Sandra-Flow Share-Schritt erzeugt immer einen Short-URL (`/join/CODE`); kein langer Inline-URL mehr
- [x] **FR-15B.2:** Der Code besteht aus 6 Zeichen des Alphabets `ACDEFGHJKMNPQRTVWXYZ234679` (kein O/0/I/1/8/B/L)
- [x] **FR-15B.3:** Der Code ist 30 Tage gültig und mehrfach verwendbar
- [x] **FR-15B.4:** Wenn Supabase nicht erreichbar: Fehlermeldung „Link konnte nicht erstellt werden – bitte Internetverbindung prüfen" + „Erneut versuchen"-Button; kein Fallback auf langen URL
- [x] **FR-15B.5:** Der erstellte Code wird in IndexedDB (`rm-invite-log`) gespeichert
- [x] **FR-15B.6:** Beim Öffnen von `/join/CODE` wird der Payload aus Supabase geladen und der URL auf `/` bereinigt (kein Code in der Browser-History)
- [x] **FR-15B.7:** Unbekannter oder abgelaufener Code: App landet auf Home ohne Crash; kein `invite-not-found`-Text im Body sichtbar
- [x] **FR-15B.8:** Nach dem Beantworten der Fragen schreibt `ContactHandshakeView` Ingrids Kontaktdaten automatisch in `invites.response` (kein manueller Schritt für Ingrid)
- [x] **FR-15B.9:** `usePendingInviteResponses` pollt alle 5 Minuten; sobald `response ≠ null`: `addFriend()` aufrufen, Code als responded markieren
- [x] **FR-15B.10:** Ingrid erscheint als Freundin in Sandras Hub ohne manuellen Schritt (automatisch bidirektional)
- [x] **FR-15B.11:** `Großschrift-Modus für Heidi voreinstellen`-Checkbox im Share-Screen (bereits in REQ-019/REQ-020 definiert) bleibt erhalten
- [x] **FR-15B.12:** Privacy-Hint im Share-Schritt: „Nur die Fragen liegen 30 Tage verschlüsselt auf unseren Servern – keine Antworten, kein Zugriff für uns."
- [x] **FR-15B.13:** FAQ-Text im Familienmodus-Abschnitt beschreibt den 30-Tage-Speicher für Fragen korrekt

---

## 7. Datenschutz & Serverseite

| Was liegt auf dem Server | Wie lange | Wer kann lesen |
|---|---|---|
| Fragentexte (Klartext) | 30 Tage | Supabase (Betreiber) + jeder mit gültigem JWT |
| Absendername (`displayName`) | 30 Tage | wie oben |
| Öffentlicher ECDH-Schlüssel | 30 Tage | wie oben |
| **Antworten** | **nie** | – |
| **Privater Schlüssel** | **nie** | – |

Der öffentliche Schlüssel ist kein Geheimnis (ECDH-Semantik). Die Fragentexte und der Anzeigename werden bewusst im Klartext gespeichert – sie sind nötig damit Ingrid die Einladung ohne Sandras Anwesenheit öffnen kann. Dies ist in der Datenschutzerklärung und im FAQ dokumentiert.

**Was der Betreiber nicht sieht:** Antworten, Erinnerungsinhalte, Bilder, private Schlüssel.

---

## 8. Nicht-funktionale Anforderungen

| Anforderung | Wert |
|---|---|
| Bundle-Impact (Offline) | 0 KB – `inviteService.ts` wird nur per `await import()` geladen |
| Netzwerk-Timeout | 20 s (geerbt von `fetchWithTimeout` in `supabaseClient.ts`) |
| Offline-Verhalten | Fehlermeldung + Retry; App bleibt stabil |
| Rückwärtskompatibilität | Alte `?contact=` / `?qp=` URLs werden nicht mehr verarbeitet |

---

## 9. Akzeptanzkriterien

- [x] Generierter Link ist ≤ 36 Zeichen (`storyhold.app/join/XXXXXX`)
- [x] Link in neuem Browserfenster öffnen → `PersonalPackReceiveView` erscheint mit Absendername
- [x] Ingrid beantwortet Fragen + Accept → `invites.response` in Supabase gesetzt
- [x] Sandra's Hub: Ingrid erscheint automatisch als Freundin (ohne zweiten Link-Austausch)
- [x] Kein Klartext der Antworten in `invites.payload` oder `invites.response`
- [x] Abgelaufener/unbekannter Code → Home ohne Crash, kein `invite-not-found` im DOM
- [x] Supabase nicht erreichbar → Fehlermeldung + Retry-Button, kein langer URL
- [x] Offline-Nutzer ohne Online-Sharing: `inviteService.ts` wird nie geladen

---

## 10. Tests

### Unit-Tests

| Datei | Abgedeckte Aspekte |
|---|---|
| `src/utils/inviteService.test.ts` | createInviteAndGetUrl, resolveInviteCode, submitInviteResponse, pollInviteResponse; Mocked Supabase |
| `src/utils/inviteLogStore.test.ts` | storePendingInvite, getPendingInvites (nur pending), markInviteResponded, cleanupExpiredInvites |
| `src/hooks/usePendingInviteResponses.test.ts` | Poll-Zyklus, addFriend-Aufruf, markInviteResponded, Fehlerresilienz |
| `src/views/SandraShareStep.test.tsx` | async URL-Generierung mit `waitFor`; Fehler-State |
| `src/utils/familyModeHandshake.test.ts` | ContactHandshakeView mit `inviteCode`-Prop; submitInviteResponse nach Accept |
| `src/utils/optin.test.ts` | `inviteService.ts` whitelisted; Guard enforced für alle anderen Module |

### E2E-Tests

| Datei | Abgedeckte Szenarien |
|---|---|
| `e2e/family-mode-handshake.spec.ts` | `/join/CODE` öffnen → PersonalPackReceiveView; unbekannter Code → kein Crash; Bidirektionale Verknüpfung Bob→Alice |
| `e2e/family-mode-end-to-end.spec.ts` | Vollständige Kette: Einladung → Handshake → Auto-Share → Feed → Ergänzung |
| `e2e/sandra-flow.spec.ts` | Share-Schritt erzeugt `/join/`-URL; Receiver Path über `/join/CODE` |
| `e2e/sharing-optin.spec.ts` | `inviteService` nicht geladen ohne Opt-in |

### E2E-Helpers

| Helper | Zweck |
|---|---|
| `seedInvite(state, sender)` | Fügt direkt eine Zeile in `state.invites` ein (Supabase-Mock); gibt Code zurück |
| `invitePath(code)` | Gibt `/join/${code}` zurück |
| `installSupabaseMock(context, state)` | Intercepts HTTP auf `http://supabase.e2e.local/**`; behandelt `invites`-Tabelle (INSERT/SELECT/PATCH) |

---

## 11. Änderungshistorie

| Version | Datum | Autor | Änderung |
|---|---|---|---|
| 1.0.0 | 2026-05-24 | Claude | Initiales Dokument (Implementierung v2.14.0, PR #332) |

# Anforderung: Vereinfachtes Erinnerungs-Teilen (binär pro Kontakt)

**Status:** 🟢 DRAFT
**ID:** REQ-022
**Version:** 1.0.0
**Letzte Aktualisierung:** 2026-05-20
**Modul:** Sharing / UX
**Priorität:** High
**Implementiert ab:** v2.13.0

---

## 1. Zusammenfassung

Das Erinnerungs-Teilen aus REQ-015 (Familienmodus) wird radikal vereinfacht: Statt pro Versand eine Erinnerung und mehrere Empfänger zu wählen, gilt **pro verbundener Person eine einzige binäre Entscheidung** — alle eigenen Antworten automatisch teilen, oder gar nicht. Beim Verbinden ist „teilen" vorausgewählt. Der „Teilen"-Tab im Familienmodus-Hub entfällt. Auto-Share läuft sobald `sync.ready=true` ist und ist idempotent über einen lokalen Share-Log.

Ziel ist es, das Sharing-Modell für die zwei Personas tragfähig zu machen:

- **Sandra (42, tech-affin):** verschiebt ihre kognitive Last weg vom Klicken pro Versand hin zur einmaligen Beziehungspflege.
- **Ingrid (67, Vereinfachter Bedienmodus):** muss nichts entscheiden — eine eingeladene Person bekommt standardmäßig alles, eine einzige Checkbox erklärt das.

---

## 2. Kernidee & User Stories

> „Als Ingrid (67) möchte ich beim Verbinden mit meiner Tochter nicht entscheiden müssen, welche einzelne Erinnerung sie sieht — sie soll standardmäßig alles bekommen."

> „Als Sandra (42) möchte ich pro Kontakt einmal festlegen, ob sie alles oder nichts sieht — nicht für jede Erinnerung neu klicken."

> „Als Sandra möchte ich das Teilen mit einer Person jederzeit pausieren können und sicher sein, dass dabei alle bereits geteilten Erinnerungen verschwinden."

Die mentale Last verschiebt sich von **Memory-zentrisch** („Welche Erinnerung schicke ich heute an wen?") zu **Friend-zentrisch** („Wer aus meiner Familie sieht überhaupt etwas?"). Das ist die Form, die für Ingrid funktioniert, weil sie kein Inventar pflegen muss.

---

## 3. Nicht-funktionale Anforderungen

- **Privacy:** Auto-Share verlässt das Gerät nur in der bereits etablierten E2EE-Form (REQ-015 §3). Server sieht weiterhin nur Chiffretext, IV, Empfänger-IDs. Kein neues Telemetrie-Event.
- **Offline:** Antworten werden lokal gespeichert (REQ-003). `useAutoShare` wartet auf `sync.ready=true`; bei Offline-Wechsel pausiert die Queue automatisch und nimmt nach Reconnect die ausstehenden Memories wieder auf.
- **Performance:** Sequenzielle Share-Queue mit maximal 1 concurrent. Backfill > 5 Memories zeigt einen dezenten Progress-Indikator im Hub-Header. Encryption (`encryptShare`) bleibt < 50 ms pro Memory.
- **Race-Sicherheit:** 3-Sekunden-Debounce zwischen Friend-Anlage und erstem Auto-Share, damit Ingrid die Checkbox abhaken kann, bevor Memories rausgehen.
- **Rückwärtskompatibilität:** `friend.online.shareAll` ist konzeptionell verbindlich, technisch aber optional im Storage — fehlt das Feld, wird beim Laden auf `true` migriert (siehe FR-22.10).

---

## 4. Funktionale Anforderungen

### 4.1 Friend-Level-Flag

- **FR-22.1** `Friend.online` wird um das Feld `shareAll: boolean` erweitert.
- **FR-22.2** Beim Anlegen eines neuen Online-Friends (`addFriend(name, undefined, { deviceId, publicKey, linkedAt, shareAll })`) wird der Wert verbindlich aus der UI übergeben — kein Fallback auf einen anderen Default ausserhalb der Migration.

### 4.2 Opt-in beim Handshake

- **FR-22.3** `ContactHandshakeView` zeigt unterhalb des Verbindungs-Status eine Checkbox **„Meine Erinnerungen automatisch mit {name} teilen"** mit Hint-Text **„Alle Antworten – auch bestehende – gehen direkt an {name}. Du kannst das jederzeit in den Kontakten umstellen."** Default: **angehakt** (`true`).
- **FR-22.4** Der Checkbox-Wert wird über die erweiterte Signatur `onAcceptContact(handshake, shareAll)` durchgereicht und in `friend.online.shareAll` gespeichert.
- **FR-22.5** Auto-Accept (REQ-015 §4.2 + Bidirektionaler Handshake): falls die Annahme bereits beim ersten Render läuft (Online-Sharing schon aktiv), wird der aktuelle Checkbox-State zum Zeitpunkt des `onAcceptContact`-Calls verwendet. Eine spätere Änderung muss via `setFriendShareAll(friendId, shareAll)` nachgezogen werden.
- **FR-22.6** `PersonalPackReceiveView` (Sandra-Quiz-Empfang aus REQ-020) zeigt **keine eigene Checkbox**, um Doppelfragen zu vermeiden. Die Entscheidung fällt erst in `ContactHandshakeView` direkt nach dem Quiz.

### 4.3 Auto-Share-Mechanik

- **FR-22.7** Bei `friend.online.shareAll === true` wird jede gespeicherte Antwort mit nicht-leerem `value` automatisch via `shareMemoryToAllFriends()` verschlüsselt verschickt — kein manueller Klick.
- **FR-22.8** Auto-Share läuft auch beim App-Start (`sync.ready=true`) als **Backfill** aller bisherigen Answers an alle aktiven Friends mit `shareAll=true`. Das schließt Antworten ein, die **vor** dem Verbinden erstellt wurden – es gibt keinen `linkedAt`-Filter. Idempotenz via Share-Log (FR-22.10) verhindert Mehrfach-Shares.
- **FR-22.9** Beim Toggle `false → true` für einen einzelnen Friend wird ein Backfill aller bestehenden Answers an genau diesen Friend ausgelöst.
- **FR-22.10** **Idempotenz**: Ein IndexedDB-Store `rm-share-log` (Store-Name `share-log`, Key `${answerId}-${friendDeviceId}` → `lastSharedAt: string`) verhindert Mehrfach-Shares. Eine Memory wird nur dann (erneut) geteilt, wenn `lastSharedAt < answer.updatedAt` oder noch kein Log-Eintrag existiert.
- **FR-22.11** Die Queue läuft mit maximal 1 concurrent. Bei Fehler (Netzwerk, Quota) wird mit exponential backoff (2 s / 4 s / 8 s / 16 s) retry'd; nach 4 erfolglosen Versuchen pro Memory wartet die Queue auf den nächsten Mount.

### 4.4 Pause / Off-Toggle

- **FR-22.12** In `OnlineSharingHubView` → Kontakte (vormals „Einladen"-Tab) erscheint pro `ContactItem` ein Switch **„Erinnerungen teilen"**, der den aktuellen `shareAll`-Wert reflektiert.
- **FR-22.13** Klick auf den Switch von `on → off` öffnet einen Bestätigungs-Dialog:
  - Titel: „Erinnerungen mit {name} nicht mehr teilen?"
  - Body: „{name} sieht ab sofort nichts Neues mehr von dir. Deine bisher geteilten Erinnerungen werden gelöscht. Du kannst das später wieder einschalten."
  - Buttons: „Ja, nicht mehr teilen" (primärer CTA) / „Abbrechen" (`.btn.btn--ghost`).
- **FR-22.14** Bei Bestätigung wird `unshareAllWithFriend(friendDeviceId)` aufgerufen:
  - Server: alle `share_recipients`-Einträge dieser Person löschen (Cascade-Effekt — die `shares`-Zeile bleibt, wenn andere Recipients existieren).
  - Lokal: alle `rm-share-log`-Einträge für diesen `friendDeviceId` löschen.
  - State: `friend.online.shareAll = false`.
- **FR-22.15** Empfänger sieht beim nächsten Sync (`fetchIncomingShares()`) einen leeren Feed — die `share_recipients`-Einträge sind weg, sein Device-ID kommt im SELECT nicht mehr vor.

### 4.5 Tab-Reduktion im OnlineSharingHub

- **FR-22.16** Die Tab-Union des `OnlineSharingHubView` wird von `'feed' | 'share' | 'contacts' | 'settings'` auf `'feed' | 'contacts' | 'settings'` reduziert. Die `ShareTab`-Funktion wird komplett entfernt.
- **FR-22.17** Der `ContactsTab` erhält neben dem Switch (FR-22.12) einen primären CTA **„Neue Person verbinden"**, der zum Sandra-Flow (`#/ask`) weiterleitet.
- **FR-22.18** Der `FeedTab` Empty-State hat zwei Varianten:
  - mindestens ein Friend mit `shareAll=true` aktiv: „Sobald deine Kontakte etwas Neues schreiben, erscheint es hier."
  - alle Friends `shareAll=false`: „Du teilst aktuell mit niemandem. Schalte das Teilen in den Kontakten wieder ein."
- **FR-22.19** Der `OnboardingScreen` (0-Kontakte-Pfad in `OnlineSharingHubView`) bekommt einen neuen CTA **„Jemanden einladen"**, der zum Sandra-Flow weiterleitet. Der alte Direct-Contact-Link-Pfad entfällt.

### 4.6 Migration bestehender Nutzer (v2.12 → v2.13)

- **FR-22.20** Beim Laden des Storage-State (`loadStateAsync` UND `mergeRemoteState`) wird jeder `friend.online` ohne `shareAll`-Feld idempotent auf `shareAll: true` gesetzt.
- **FR-22.21** Beim ersten App-Start nach Update auf v2.13.0 (Marker `rm-share-migration-v213` im LocalStorage geprüft) erscheint ein einmaliger Migrations-Toast:
  - Titel: „Teilen ist jetzt einfacher"
  - Body: „Alle deine bisherigen Kontakte erhalten ab jetzt automatisch neue Antworten. Schau in „Familie" → „Kontakte", wer was bekommen soll."
  - Buttons: „Kontakte öffnen" (Navigation zu `OnlineSharingHubView` Tab `contacts`) / „Verstanden".
- **FR-22.22** Der Migrations-Toast wird nur **einmal** gezeigt; nach Bestätigung oder Dismiss wird der Marker gesetzt.

### 4.7 Sandra-Flow als einziger Connection-Entry

- **FR-22.23** Neue Online-Sharing-Verbindungen werden ausschließlich über den Sandra-Flow (REQ-020) initiiert. Der separate „Verbindungslink generieren"-Pfad aus dem alten `useContactShare` in `OnlineSharingHubView.OnboardingScreen` wird zugunsten des Sandra-Flow-CTAs entfernt.

---

## 5. Datenmodell

### 5.1 TypeScript

```ts
// src/types.ts — erweitert
export interface FriendOnline {
  deviceId: string
  publicKey: string
  linkedAt: string
  shareAll: boolean        // NEU – verbindlich
}

export interface Friend {
  id: string
  name: string
  addedAt: string
  online?: FriendOnline    // bisher inline, jetzt benanntes Interface
}
```

### 5.2 IndexedDB — Share-Log

```
Database:  rm-share-log
Store:     share-log
KeyPath:   string ("${answerId}-${friendDeviceId}")
Value:     { lastSharedAt: string }   // ISO 8601
```

### 5.3 Supabase-Schema

**Keine Änderung.** Die binäre Friend-Level-Entscheidung lebt rein clientseitig. Das `share_recipients`-ACL-Modell bleibt das gleiche; der Client multicastet bei Speichern + Backfill und löscht ACL-Einträge beim Pausieren.

---

## 7a. API-Vertrag (verbindlich)

### Typen

```ts
// src/types.ts — Friend.online.shareAll: boolean (verbindlich)

// LocalStorage / IndexedDB unverändert (kein Backup-Format-Bump nötig,
//   weil das Feld optional im Storage ist und beim Laden migriert wird).
```

### Hook `useAutoShare`

```ts
// src/hooks/useAutoShare.ts

export interface UseAutoShareOptions {
  answers: Record<string, Answer>
  friends: Friend[]
  sync: OnlineSyncAPI
  ownerName: string
  enabled: boolean                   // false ⇒ Hook ist no-op
}

export interface UseAutoShareReturn {
  pending: number                    // Anzahl Memories in Queue
  backfillInProgress: boolean
  lastError: string | null
}

export function useAutoShare(opts: UseAutoShareOptions): UseAutoShareReturn
```

### Service-Funktionen

```ts
// src/utils/sharingService.ts — neue Exporte

export interface ShareMulticastResult {
  shareIds: string[]                 // pro Recipient ein Share
  errors: Array<{ recipientDeviceId: string; message: string }>
}

export async function shareMemoryToAllFriends(
  answer: Answer,
  friends: Friend[],
  ownerName: string,
): Promise<ShareMulticastResult>

export async function unshareAllWithFriend(
  friendDeviceId: string,
): Promise<void>
```

### IndexedDB-Adapter

```ts
// src/utils/shareLogStore.ts — NEU

export async function getShareLogEntry(
  answerId: string,
  friendDeviceId: string,
): Promise<string | null>             // lastSharedAt (ISO) oder null

export async function setShareLogEntry(
  answerId: string,
  friendDeviceId: string,
  lastSharedAt: string,
): Promise<void>

export async function deleteShareLogForFriend(
  friendDeviceId: string,
): Promise<void>
```

### State-Aktionen

```ts
// src/hooks/useAnswers.ts — neue / erweiterte Aktionen

// Signatur erweitert
export function addFriend(
  name: string,
  oneTimeAnswers?: FriendAnswer[],
  online?: {
    deviceId: string
    publicKey: string
    linkedAt: string
    shareAll: boolean              // NEU – verbindlich, wenn online gesetzt
  },
): Friend

// NEU
export function setFriendShareAll(
  friendId: string,
  shareAll: boolean,
): void
```

### Komponente `<ContactHandshakeView>`

```ts
export interface ContactHandshakeViewProps {
  // bestehende Props ...
  onAcceptContact: (
    handshake: ContactHandshake,
    shareAll: boolean,             // NEU – aus interner Checkbox
  ) => void
}
```

### Komponente `<OnlineSharingHubView>`

```ts
export interface OnlineSharingHubViewProps {
  // bestehende Props ...
  onOpenSandraFlow: () => void     // NEU – ersetzt Direkt-Link-Pfad
  onSetFriendShareAll: (friendId: string, shareAll: boolean) => void  // NEU
}

// internal Tab-Union — reduziert
type Tab = 'feed' | 'contacts' | 'settings'
```

### i18n-Keys

**Entfernen** im Block `onlineSharingHub`:
- `tabs.share`
- gesamter `share.*`-Block
- `feedEmpty.shareCta`

**Neu** im Block `onlineSharingHub`:
- `contacts.shareToggleLabel`
- `contacts.shareTogglePauseConfirmTitle`
- `contacts.shareTogglePauseConfirmBody`
- `contacts.shareTogglePauseConfirmYes`
- `contacts.shareTogglePauseConfirmNo`
- `contacts.newConnectionCta`
- `feedEmpty.allPausedHint`

**Neu** im Block `contactHandshake`:
- `shareAllOptInLabel`
- `shareAllOptInHint`

**Neu** im Block `migration` (oder `global.migration`):
- `v213Title`
- `v213Body`
- `v213CtaOpen`
- `v213CtaDismiss`

`src/locales/types.ts` muss synchron erweitert/reduziert werden (TypeScript-Build erzwingt Vollständigkeit).

---

## 8. Akzeptanztests (Definition of Done)

### Unit / Component

- [ ] `src/hooks/useAutoShare.test.ts`: Watch triggert Share, wenn `shareLog[key] < answer.updatedAt`; idempotent bei Re-Render; Backfill auf Toggle-on funktioniert; 3 s Debounce nach Friend-Anlage; Mock-Service mit echtem Hook (kein `vi.mock` des Hooks selbst).
- [ ] `src/utils/sharingService.test.ts`: `unshareAllWithFriend()` ruft die Mock-Supabase-Delete-Kette korrekt auf (`share_recipients` filter by `recipient_id`).
- [ ] `src/utils/shareLogStore.test.ts`: get/set/deleteForFriend, IndexedDB-Fake oder fake-indexeddb.
- [ ] `src/hooks/useAnswers.test.ts` (erweitert): Migration setzt fehlendes `shareAll` auf `true` in `loadStateAsync`; gleiches in `mergeRemoteState`; `addFriend({ online: { ..., shareAll: false } })` respektiert den übergebenen Wert; `setFriendShareAll` ändert genau den richtigen Friend.
- [ ] `src/views/ContactHandshakeView.test.tsx`: Checkbox sichtbar mit default `true`; Abhaken übergibt `false` an `onAcceptContact`; Beschriftung enthält den `displayName` aus der Handshake-Payload.
- [ ] `src/views/OnlineSharingHubView.test.tsx`: Tab-Liste enthält nur Feed/Kontakte/Einstellungen; Switch im ContactItem toggelt; Pause-Dialog erscheint nur beim `on → off`, nicht beim `off → on`; Bestätigung ruft `onSetFriendShareAll(id, false)` und `unshareAllWithFriend`.

### End-to-End (Playwright)

- [ ] `e2e/family-mode-auto-share.spec.ts` (NEU): Alice und Bob via Sandra-Flow verbunden, Default-Checkbox `true`. Alice speichert Antwort → Bob sieht sie ohne weiteren Klick im Feed (≤ 10 s). Toggle in Bobs Kontakten → Pause-Dialog → bestätigen → Alice refresht → Feed leer. Toggle wieder on → Backfill macht Memory wieder sichtbar.
- [ ] `e2e/family-mode-handshake.spec.ts` (erweitert): Checkbox-Default sichtbar; mit abgehakter Checkbox akzeptierter Handshake führt zu `friend.online.shareAll === false`.
- [ ] Bestehende ShareTab-Specs umgeschrieben (kein `getByRole('tab', { name: 'Teilen' })` mehr): `family-mode-share.spec.ts`, `family-mode-end-to-end.spec.ts`, `interaction/android-ux.spec.ts`, `nightly/two-device-real.spec.ts`, `nightly/android-ux-real.spec.ts`, `nightly/multi-recipient-real.spec.ts`. Alle nutzen `seedAnswer` + Auto-Share-Wait statt Memory-Picker.
- [ ] Migrations-Smoke-Test: LocalStorage mit altem Friend-Format laden, App starten, Toast erscheint einmal, `rm-share-migration-v213` ist gesetzt.

### Manuelle Device-Verification

- [ ] iOS-Safari (PWA installiert): Sandra-Flow → Handshake-Annahme → Checkbox sichtbar und tap-bar (≥ 44 px); Auto-Share funktioniert nach Reload.
- [ ] Android-Chrome: Pause-Dialog erscheint, Bestätigung löscht Empfänger-Feed nach Reload.
- [ ] Vereinfachter Bedienmodus (Ingrid): Checkbox bleibt verständlich auch bei großer Schrift; Pause-Dialog passt in den Viewport.

---

## 9. Offene Fragen / Risiken

- **Migrations-Risiko (User-akzeptiert):** Bestehende Kontakte erhalten `shareAll=true` per Migration → bisher private Memories gehen automatisch raus. Mitigation: Migrations-Toast (FR-22.21) mit Direkt-CTA in die Kontakte-Verwaltung.
- **Multi-Device-Duplikate:** Sandra schreibt auf Handy und Laptop quasi gleichzeitig → beide multicasten dieselbe Memory → Bob sieht Duplikate. MVP-Akzeptanz, Folge-PR mit serverseitiger Deduplizierung möglich.
- **Bilder / Audio / Video noch nicht im Auto-Share:** `ShareBody` (REQ-15.11) enthält heute nur `value` + `imageCount`, keine Image-IDs oder Audio-/Video-Referenzen. Auto-Share überträgt entsprechend nur Text. Erweiterung um Multimedia ist eigenständiger Folge-Refactor.
- **Keine Privatsphäre pro Memory:** Wer „intime Antwort, aber nur lokal" will, hat keine UI-Option mehr — bewusste Akzeptanz, in Folge-PR ggf. via „Private Antwort"-Flag pro Memory lösbar.
- **Race nach Handshake:** 3-s-Debounce in `useAutoShare` schützt vor Backfill, bevor Ingrid die Checkbox sieht. Wenn das Debounce zu kurz ist, kann ein Backfill rausgehen, bevor Ingrid abhakt. Mitigation in V2: Debounce dynamisch nach Mount-Sichtbarkeit.

---

## 10. Abhängigkeiten

| Abhängigkeit | Grund |
|--------------|-------|
| REQ-015 (Familienmodus) | Verschlüsselungs-Basis (E2EE, ECDH, AES-GCM), `shareMemory()`, `share_recipients`-Tabelle |
| REQ-020 (Sandra-Flow) | Einziger Connection-Entry für neue Online-Sharing-Beziehungen |
| REQ-019 (Einfach-Modus) | Checkbox und Pause-Dialog müssen in Vereinfachtem Bedienmodus lesbar bleiben |
| `idb-keyval` oder Web IndexedDB API | Für `rm-share-log`-Store |

---

## 11. Änderungshistorie

| Version | Datum | Autor | Änderung |
|---------|-------|-------|---------|
| 1.0.0 | 2026-05-20 | Claude | Initiale Spec: binäres Friend-Level-Sharing, Auto-Share, Pause, Migration v2.13.0 |

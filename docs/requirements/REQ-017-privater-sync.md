# REQ-017 – Privater Sync

> Single source of truth für **Implementation Agent** und **Test Agent**.
> Abschnitte 1–8 sind gemeinsam; 9–11 richten sich an den Implementation Agent; 12–15 an den Test Agent.

---

## 1. Product Overview

Storyhold speichert alle Daten lokal. Der Privater-Sync gibt Nutzern die
Möglichkeit, ihre Daten geräteübergreifend zu synchronisieren, ohne dass
Storyhold die Kontrolle über die Daten übernimmt.

**Drei gleichwertige Optionen** (kein "Fallback", keine versteckte Tier-Logik):

| # | Option | Speicherort | Media? | Verschlüsselung |
|---|--------|-------------|--------|-----------------|
| 1 | **Google Drive** | Nutzers eigene Google Drive | ✅ Ja | Provider-seitig (Google) |
| 2 | **Microsoft OneDrive** | Nutzers eigener OneDrive App-Folder | ✅ Ja | Provider-seitig (Microsoft) |
| 3 | **Storyhold Server** | Unser Supabase | ❌ Nur Text | AES-256-GCM, zero-knowledge (wir können nicht lesen) |

Kernprinzipien:
- **Opt-in**, standardmäßig deaktiviert
- **Kein Passphrase** – OAuth-Login als Zugangskontrolle für Drive/OneDrive;
  Recovery Code für die Serverspeicherung
- **Push**: automatisch, debounced 5 s nach jeder Änderung
- **Pull**: bei App-Start, Visibility-Change (`visibilitychange` Event), manuellem Klick
- **Konflikte**: Last-Write-Wins auf Antwort-Ebene (Feld `updatedAt`)

---

## 2. User Stories

### US-001 · Setup-Wizard
**Als Nutzer** möchte ich einmalig einen Sync-Provider wählen und mich
einloggen, **damit** meine Daten ab sofort automatisch synchronisiert werden.

Akzeptanzkriterien:
- AC-001-1: Wizard startet direkt beim Öffnen des „Sync"-Tabs (4. Tab in der BottomNav),
  wenn noch kein Sync eingerichtet ist
- AC-001-2: Schritt 1 zeigt Intro-Text + „Einrichten"-Button
- AC-001-3: Schritt 2 zeigt drei Provider-Karten; Auswahl aktiviert „Weiter"
- AC-001-4: Schritt 3 startet OAuth-Flow (Drive/OneDrive) bzw. E-Mail-Login
  (Storyhold Server)
- AC-001-5 (nur Server): Nach Login erscheint Recovery-Code-Anzeige mit
  Bestätigungs-Checkbox. „Weiter" ist deaktiviert, bis Checkbox aktiviert.
- AC-001-6: Letzter Schritt: Erfolgs-Screen mit Provider-Icon + „Sync aktiv"
- AC-001-7: Bei Abbruch auf jeder Stufe bleibt kein halbfertiger Sync-State zurück

### US-002 · Automatischer Push
**Als Nutzer** möchte ich, dass meine Änderungen automatisch in meine
Cloud synchronisiert werden, **damit** ich nicht manuell exportieren muss.

Akzeptanzkriterien:
- AC-002-1: 5 Sekunden nach einer Änderung an `AppState` wird ein Push gestartet
- AC-002-2: Mehrere Änderungen innerhalb der 5-s-Frist werden zu einem Push zusammengefasst
- AC-002-3: Schlägt ein Push fehl, wird nach 30 s erneut versucht (max. 3 Versuche)
- AC-002-4: Läuft kein Push, wenn keine Netzwerkverbindung (`navigator.onLine === false`)

### US-003 · Pull bei App-Start
**Als Nutzer** möchte ich beim Öffnen der App automatisch den neuesten
Remote-Stand erhalten, **damit** ich auf dem zweiten Gerät sofort up-to-date bin.

Akzeptanzkriterien:
- AC-003-1: Pull wird beim Start (nach erstem `onMount`) ausgelöst
- AC-003-2: Pull wird ausgelöst, wenn Tab wieder sichtbar wird (`visibilitychange`)
- AC-003-3: Nach erfolgreichem Pull wird der lokale State mit LWW gemergt
- AC-003-4: Während des Pulls wird ein Lade-Indikator angezeigt

### US-004 · Manueller Sync
**Als Nutzer** möchte ich einen Sync manuell auslösen können,
**damit** ich sofort sicherstellen kann, dass meine Daten übertragen wurden.

Akzeptanzkriterien:
- AC-004-1: Im Sync-Hub gibt es einen „Jetzt synchronisieren"-Button
- AC-004-2: Während des Syncs ist der Button disabled + zeigt Spinner
- AC-004-3: Nach Abschluss: „Zuletzt synchronisiert: HH:MM" sichtbar

### US-005 · Status-Anzeige
**Als Nutzer** möchte ich immer sehen, ob der Sync funktioniert,
**damit** ich Probleme früh bemerke.

Akzeptanzkriterien:
- AC-005-1: `SyncStatusBadge` zeigt: `idle` / `syncing` / `error` / `success`
- AC-005-2: Bei `error`: Fehlermeldung im Sync-Hub lesbar
- AC-005-3: `success` wechselt nach 3 s zurück zu `idle`

### US-006 · Sync deaktivieren
**Als Nutzer** möchte ich den Sync jederzeit deaktivieren können,
**damit** meine Daten wieder nur lokal sind.

Akzeptanzkriterien:
- AC-006-1: Im Sync-Hub gibt es „Sync deaktivieren"-Button mit Bestätigungs-Dialog
- AC-006-2: Dialog fragt: „Remote-Daten löschen?" (Ja / Nein / Abbrechen)
- AC-006-3: Nach Deaktivierung wird OAuth-Token aus IndexedDB gelöscht
- AC-006-4: `AppState.privateSync` wird auf `undefined` gesetzt

### US-007 · Neues Gerät einrichten (Drive/OneDrive)
**Als Nutzer** möchte ich auf einem neuen Gerät einfach den Sync
wieder einrichten, **damit** ich sofort meinen Stand habe.

Akzeptanzkriterien:
- AC-007-1: Nach OAuth-Login auf neuem Gerät: Pull lädt remote State
- AC-007-2: LWW-Merge: Remote-Antworten mit neuerem `updatedAt` überschreiben lokale
- AC-007-3: Media-Dateien werden lazy nachgeladen (nur fehlende IDs)

### US-008 · Neues Gerät einrichten (Storyhold Server)
**Als Nutzer** möchte ich auf einem neuen Gerät meinen Recovery Code
eingeben, **damit** meine verschlüsselten Daten entschlüsselt werden.

Akzeptanzkriterien:
- AC-008-1: Nach E-Mail-Login erscheint „Recovery Code eingeben"-Screen
- AC-008-2: Falsch eingegebener Code zeigt Fehler (Entschlüsselung schlägt fehl)
- AC-008-3: Korrekter Code: Vault-Key wird in IndexedDB gecacht, State gemergt

---

## 3. Shared Types & Contracts

### 3.1 AppState-Erweiterung

```ts
// src/types.ts

export type SyncProviderType = 'google-drive' | 'onedrive' | 'supabase'
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'success'

export interface PrivateSyncState {
  providerType: SyncProviderType
  userId: string            // Google sub / MS oid / Supabase UUID
  lastSyncAt: string | null // ISO-8601 oder null
  status: SyncStatus
  errorMessage: string | null
  // Nur für Supabase-Provider:
  encryption?: 'recovery-code'
}

// AppState.privateSync?: PrivateSyncState
```

### 3.2 SyncProvider Interface

```ts
// src/utils/privateSyncProvider.ts

export interface SyncProvider {
  readonly type: SyncProviderType
  isAuthenticated(): boolean
  signIn(): Promise<void>
  signOut(): Promise<void>
  push(state: AppState, media: MediaStoreAccessor): Promise<void>
  pull(localState: AppState, media: MediaStoreAccessor): Promise<PullResult | null>
  deactivate(deleteRemote: boolean): Promise<void>
}

export interface PullResult {
  merged: AppState
  downloadedMediaIds: string[]
}

export class SyncError extends Error {
  constructor(
    message: string,
    public readonly code: 'auth' | 'network' | 'quota' | 'decrypt' | 'unknown'
  ) { ... }
}
```

### 3.3 MediaStoreAccessor Interface

```ts
// src/utils/privateSyncProvider.ts

export interface MediaStoreAccessor {
  getImageBlob(id: string): Promise<Blob | null>
  getAudioBlob(id: string): Promise<Blob | null>
  getVideoBlob(id: string): Promise<Blob | null>
  putImage(id: string, blob: Blob): Promise<void>
  putAudio(id: string, blob: Blob): Promise<void>
  putVideo(id: string, blob: Blob): Promise<void>
  listLocalMediaIds(): Promise<{ images: string[]; audio: string[]; videos: string[] }>
}
```

### 3.4 usePrivateSync Hook

```ts
// src/hooks/usePrivateSync.ts

export interface UsePrivateSyncReturn {
  isEnabled: boolean
  providerType: SyncProviderType | null
  status: SyncStatus
  lastSyncAt: string | null
  errorMessage: string | null
  syncNow(): Promise<void>
  setup(provider: SyncProviderType): Promise<void>
  deactivate(deleteRemote?: boolean): Promise<void>
}

export function usePrivateSync(
  appState: AppState,
  mediaStore: MediaStoreAccessor,
  onStateMerged: (merged: AppState) => void
): UsePrivateSyncReturn
```

### 3.5 Recovery Code (Supabase-Provider)

```ts
// src/utils/recoveryCode.ts

/** Generiert 24-Zeichen Base62-String (~143 Bit Entropie) */
export function generateRecoveryCode(): string

/** Formatiert für Anzeige: "ABCD-EFGH-IJKL-MNOP-QRST-UVWX" */
export function formatRecoveryCode(raw: string): string

/** Normalisiert Nutzereingabe: Bindestriche entfernen, trimmen */
export function normalizeRecoveryCode(input: string): string

/** PBKDF2-SHA-256, 200.000 Iterationen, salt = UTF-8(userId) */
export function deriveVaultKey(recoveryCode: string, userId: string): Promise<CryptoKey>

/** AES-256-GCM Verschlüsselung → { ct: base64, iv: base64 } */
export function encryptText(plaintext: string, key: CryptoKey): Promise<{ ct: string; iv: string }>

/** Entschlüsselt. Wirft SyncError('decrypt') bei falschem Key. */
export function decryptText(ct: string, iv: string, key: CryptoKey): Promise<string>
```

### 3.6 LWW-Merge

```ts
// src/utils/privateSyncMerge.ts

/**
 * Last-Write-Wins Merge auf Antwort-Ebene.
 * Tie-breaking: remote gewinnt bei gleichem Timestamp.
 * Profile: Vergleich via updatedAt ?? createdAt (Fallback für ältere Profile).
 * Gibt immer neuen AppState zurück (keine Mutation).
 */
export function mergeStates(local: AppState, remote: AppState): AppState
```

---

## 4. Provider-Verhalten

### 4.1 Google Drive Provider

**Auth**: Google Identity Services (GIS), Implicit Token Flow
- npm: `@react-oauth/google`
- Scope: `https://www.googleapis.com/auth/drive.file`
- Token-Speicher: IndexedDB `rm-sync-gdrive-token`

**Dateistruktur:**
```
remember-me-sync.json
remember-me-media/{id}.bin
```

**Sync-JSON Format:**
```json
{
  "schemaVersion": 1,
  "syncedAt": "<ISO-8601>",
  "appVersion": "<semver>",
  "state": { "...AppState ohne Blob-Data..." },
  "mediaManifest": { "<id>": { "type": "image|audio|video", "syncedAt": "<ISO>" } }
}
```

### 4.2 OneDrive Provider

**Auth**: MSAL.js v3 (`@azure/msal-browser`)
- Scope: `Files.ReadWrite.AppFolder`
- Token-Speicher: MSAL sessionStorage + IndexedDB `rm-sync-onedrive-token`

**API**: Microsoft Graph `/me/drive/special/approot:/{path}:/content`

### 4.3 Storyhold Server Provider (Supabase, zero-knowledge)

**Auth**: Supabase Auth, `storageKey: 'rm-sync-session'` (getrennt von Family-Mode)

**Verschlüsselung:**
1. `generateRecoveryCode()` → 24-Zeichen-String
2. `deriveVaultKey(code, userId)` → CryptoKey (PBKDF2, 200k Iterationen)
3. `encryptText(JSON.stringify(appState), key)` → `{ ct, iv }`
4. Upsert `{ state_ct, state_iv, encryption: 'recovery-code' }` in Supabase

**Datenbank-Schema:**
```sql
CREATE TABLE private_sync_state (
  user_id    uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  state_ct   text NOT NULL,
  state_iv   text NOT NULL,
  encryption text NOT NULL DEFAULT 'recovery-code'
               CHECK (encryption = 'recovery-code'),
  version    bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private_sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rows only" ON private_sync_state
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

## 5. Navigation – Bottom Nav

| Position | ID | Label | View |
|----------|----|-------|------|
| 1 | `home` | Lebensweg | HomeView |
| 2 | `friends` | Freunde | FriendsView |
| 3 | `archive` | Vermächtnis | ArchiveView |
| **4** | **`sync`** | **Sync** | PrivateSyncSetupView / PrivateSyncHubView |
| 5 | `profile` | Profil | ProfileView (+ zusammenklappbare Features-Sektion) |

Icon: `/menu-icons/features.jpeg` (unverändert). `FeatureView.tsx` wurde gelöscht.

---

## 6. Setup-Wizard UX

Screens (kein Modal, Tab-Inhalt):
- **S1 – Intro**: Überschrift „Privater Sync", Erklärtext, „Einrichten"-Button
- **S2 – Provider-Wahl**: Drei Karten (Google Drive / OneDrive / Storyhold Server)
- **S3 – Login**: OAuth-Button (Drive/OneDrive) oder E-Mail-Formular (Server)
- **S4 (Server, erstes Gerät) – Recovery Code**: Monospace-Code, Checkbox, Warnung
- **S5 (Server, neues Gerät) – Code eingeben**: Eingabefeld für Recovery Code
- **Sletzt – Erfolg**: „Sync ist aktiv"

---

## 7. Sync-Hub UX

Angezeigt wenn `appState.privateSync` gesetzt. Enthält:
- Provider-Label + Status-Badge (`idle` / `syncing` / `error` / `success`)
- Speicherort-Info (Google Drive / OneDrive / Storyhold Server verschlüsselt)
- Was gespeichert wird (Texte + Medien vs. nur Texte)
- Zuletzt synchronisiert Zeitstempel
- „Jetzt synchronisieren"-Button
- Fehlermeldung (nur bei `error`)
- „Sync deaktivieren"-Button → Confirmation Dialog

---

## 8. Datei-Manifest

### Neue Dateien
```
src/utils/privateSyncProvider.ts
src/utils/privateSyncMerge.ts
src/utils/recoveryCode.ts
src/utils/googleDriveProvider.ts
src/utils/oneDriveProvider.ts
src/utils/supabaseSyncProvider.ts
src/utils/privateSyncClient.ts
src/utils/privateSyncMediaAdapter.ts
src/hooks/usePrivateSync.ts
src/views/PrivateSyncSetupView.tsx
src/views/PrivateSyncHubView.tsx
src/components/SyncStatusBadge.tsx
supabase/migrations/20260502000000_private_sync.sql
e2e/private-sync/helpers.ts
e2e/private-sync/setup-server.spec.ts
e2e/private-sync/setup-google-drive.spec.ts
e2e/private-sync/manual-sync.spec.ts
e2e/private-sync/deactivate.spec.ts
e2e/private-sync/new-device-server.spec.ts
e2e/mocks/googleDriveMock.ts
e2e/mocks/oneDriveMock.ts
src/utils/privateSyncMerge.test.ts
src/utils/recoveryCode.test.ts
src/utils/supabaseSyncProvider.test.ts
src/hooks/usePrivateSync.test.ts
```

### Geänderte Dateien
```
src/types.ts                 # PrivateSyncState, SyncProviderType, SyncStatus, Profile.updatedAt
src/hooks/useAnswers.ts      # savePrivateSync, mergeRemoteState, privateSync in loadStateAsync
src/App.tsx                  # Tab 'feature'→'sync'; usePrivateSync verdrahten; visibility Pull
src/components/BottomNav.tsx # Tab-ID/Label 'feature'→'sync'
src/views/ProfileView.tsx    # Geplante-Features-Sektion (aus FeatureView)
e2e/onboarding.spec.ts       # Nav-Label 'Features'→'Sync'
package.json                 # version: "2.0.0"
docs/CHANGELOG.md
src/data/releaseNotes.ts
```

### Gelöschte Dateien
```
src/views/FeatureView.tsx
src/views/FeatureView.test.tsx
```

---

## 9. npm-Abhängigkeiten

```
@react-oauth/google    # Google Identity Services (GIS)
@azure/msal-browser    # Microsoft Authentication Library v3
```

---

## 10. Non-Functional Requirements

- `npm run build` und `npm test` müssen grün bleiben
- Kein `console.log` in Production-Pfaden
- Media-Uploads: max. 5 MB Chunk-Größe
- PBKDF2 blockiert Main Thread ~2 s → in `requestIdleCallback` / `setTimeout(0)` auslagern
- Token nie in `localStorage` (iOS löscht es); immer IndexedDB
- `SyncError.code` immer setzen

---

## 11. Offene Voraussetzungen (Projektowner)

1. **Google Cloud Console**: OAuth 2.0 Client-ID, Redirect `https://remember-me.app/sync-callback`
2. **Azure App Registration**: `Files.ReadWrite.AppFolder`, Redirect eintragen
3. **Supabase**: E-Mail-Auth aktivieren, `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in Vercel
4. **Vercel Env Vars**: `VITE_GOOGLE_CLIENT_ID`, `VITE_MS_CLIENT_ID`

---

## 12. Unit-Tests

### 12.1 `privateSyncMerge.test.ts`

| # | Beschreibung | Erwartung |
|---|---|---|
| M-01 | Remote neuer | merged hat remote-Wert |
| M-02 | Local neuer | merged hat local-Wert |
| M-03 | Gleicher Timestamp | tie → remote gewinnt |
| M-04 | Remote hat zusätzliche Antwort | merged enthält beide |
| M-05 | Local hat zusätzliche Antwort | merged enthält beide |
| M-06 | Profile remote neuer (updatedAt) | merged nutzt remote.profile |
| M-07 | Profile local neuer | merged behält local.profile |
| M-08 | Keine Mutation | Inputs unverändert nach merge |
| M-09 | Leerer remote State | merged = local |
| M-10 | Leerer local State | merged = remote |
| M-11 | Profile ohne updatedAt | Fallback auf createdAt |

### 12.2 `recoveryCode.test.ts`

| # | Beschreibung |
|---|---|
| R-01 | generateRecoveryCode → 24 Zeichen |
| R-02 | Nur [A-Za-z0-9] |
| R-03 | 1000 Aufrufe → 1000 verschiedene Werte |
| R-04 | formatRecoveryCode → XXXX-XXXX-XXXX-XXXX-XXXX-XXXX |
| R-05 | normalizeRecoveryCode entfernt Bindestriche |
| R-06 | deriveVaultKey → CryptoKey mit AES-GCM |
| R-07 | encrypt → decrypt Roundtrip |
| R-08 | Falscher Key → SyncError code=decrypt |
| R-09 | deriveVaultKey deterministic |
| R-10 | Verschiedene userId → verschiedene Keys |

### 12.3 `supabaseSyncProvider.test.ts`

| # | Beschreibung |
|---|---|
| SP-01 | push → state_ct verschlüsselt, encryption=recovery-code |
| SP-02 | pull → decrypt korrekt, merge korrekt |
| SP-03 | pull leere DB → null |
| SP-04 | pull falscher Key → SyncError decrypt |
| SP-05 | push Auth-Fehler → SyncError auth |

### 12.4 `usePrivateSync.test.ts`

| # | Beschreibung |
|---|---|
| H-01 | Initial: isEnabled=false, providerType=null |
| H-02 | Debounce: 2 Änderungen in 3 s → push 1× nach 5 s |
| H-03 | syncNow während Sync läuft → kein paralleler Start |
| H-04 | Push schlägt 3× fehl → status=error |
| H-05 | Offline → push nicht aufgerufen |
| H-06 | onStateMerged nach erfolgreichem Pull aufgerufen |

---

## 13. E2E-Tests (Playwright)

Alle Dateien in `e2e/private-sync/`. OAuth-Flows komplett gemockt.

| ID | Datei | Szenario |
|----|-------|---------|
| E2E-01 | `setup-server.spec.ts` | Setup-Wizard → Server → Recovery-Code → Hub |
| E2E-02 | `setup-google-drive.spec.ts` | Setup-Wizard → Google Drive → OAuth-Mock |
| E2E-03 | `manual-sync.spec.ts` | Hub mit seedActiveSync, Sync-Button sichtbar |
| E2E-04 | `deactivate.spec.ts` | Deaktivierungs-Dialog, Setup-Wizard erscheint wieder |
| E2E-05 | `new-device-server.spec.ts` | Recovery-Code-Screen sichtbar |

---

## 14. Implementierungsnotizen

- `Profile.updatedAt` (optional, für Rückwärtskompatibilität) wird in `saveProfile` automatisch gesetzt; `mergeStates` fällt auf `createdAt` zurück wenn `updatedAt` fehlt.
- `loadStateAsync` in `useAnswers.ts` muss `privateSync` aus localStorage lesen – ursprünglich vergessen, führte zu E2E-03/04-Fehlern.
- `PrivateSyncHubView` benötigt `onDeactivated` Callback → `savePrivateSync(undefined)` in App.tsx, damit der Hub nach Deaktivierung verschwindet.
- `e2e/onboarding.spec.ts` Nav-Label-Test musste von `'Features'` auf `'Sync'` aktualisiert werden.

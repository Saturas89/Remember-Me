# Anforderung: Familienmodus (Ende-zu-Ende-verschlüsseltes Online-Teilen)

**Status:** ✔️ COMPLETED  
**ID:** REQ-015  
**Version:** 1.0.0  
**Letzte Aktualisierung:** 2026-04-26  
**Modul:** Sharing / Sync  
**Priorität:** Medium  
**Implementiert seit:** v1.7.0  

---

## 1. Zusammenfassung

Der **Familienmodus** ist ein opt-in-Kanal, über den Benutzer einzelne Erinnerungen verschlüsselt mit vertrauten Personen (Familie, Freunde) teilen können. Alle Inhalte werden **clientseitig Ende-zu-Ende-verschlüsselt** bevor sie den Server erreichen. Der Server (Supabase, EU) sieht ausschließlich Chiffretexte und Metadaten (Zeitstempel, Empfänger-IDs) – niemals Klartextantworten, Namen oder Bilder.

Das Feature ist vollständig optional: Wer den Familienmodus nicht aktiviert, erzeugt keinen Netzwerkverkehr und lädt das Supabase-Paket nie in den Browser. Eigene Antworten verbleiben zu jeder Zeit lokal.

---

## 2. Kernidee & User Stories

> „Als Benutzer möchte ich eine bestimmte Erinnerung mit meiner Tochter teilen, ohne dass ein Dritter – auch nicht der App-Betreiber – mitlesen kann."

> „Als Empfänger möchte ich auf die geteilte Erinnerung antworten und eine Ergänzung hinzufügen, die nur der ursprüngliche Autor und ich sehen."

> „Als Benutzer möchte ich den Familienmodus jederzeit vollständig deaktivieren und sicherstellen, dass dabei alle meine Daten vom Server gelöscht werden."

---

## 3. Kryptografisches Sicherheitsmodell

### 3.1 Geräteidentität

| Aspekt | Umsetzung |
|--------|-----------|
| Schlüsselpaar | ECDH P-256 pro Gerät, generiert beim ersten Aktivieren |
| Privater Schlüssel | Non-extractable in `crypto.subtle`; verlässt niemals den Crypto-Subsystem |
| Öffentlicher Schlüssel | SPKI base64url; wird auf dem Server in `devices.public_key` (bytea) gespeichert |
| Persistenz | IndexedDB (`rm-device-key`, Store `keys`) |
| Geräte-ID | Stabiles UUID via anonymer Supabase-Auth (`auth.uid()`) |

### 3.2 Ende-zu-Ende-Verschlüsselung einer Erinnerung

```
Sender                          Server                  Empfänger
------                          ------                  ---------
Payload (ShareBody JSON)
  → deflate-raw compress
  → AES-GCM-256 mit zufälligem
    ContentKey verschlüsseln
  → ContentKey per ECDH-Wrapping
    für jeden Empfänger einpacken
    (ECDH P-256, AES-GCM wrapping)
  → ciphertext + iv +
    encrypted_keys{} hochladen   → nur Chiffretext sehen
                                                         ← fetch encrypted_keys[meineID]
                                                         ← ECDH unwrap → ContentKey
                                                         ← AES-GCM decrypt
                                                         ← inflate → Klartext
```

### 3.3 Bilddaten

Bilder werden separat mit dem gleichen ContentKey des zugehörigen Shares verschlüsselt und im Supabase Storage-Bucket `share-media` als Binary gespeichert. Metadaten (IV, `share_id`, `storage_path`) liegen in `share_media`. Der Server sieht keine Bildklartexte.

### 3.4 Server-Sicht (Zero-Knowledge-Garantie)

| Server speichert | Server speichert NICHT |
|-----------------|----------------------|
| Chiffretext, IV | Klartextantworten |
| Wrapped keys pro Empfänger | Entschlüsselten ContentKey |
| Timestamps, Geräteuuids | Benutzernamen, E-Mail |
| Empfänger-ACL | Profilinhalte |

---

## 4. Funktionale Anforderungen

### 4.1 Aktivierung & Consent

- [x] **FR-15.1:** Einstieg über den Freunde-Bereich; Abschnitt „Familienmodus" mit Erklärung und „Einrichten"-Button
- [x] **FR-15.2:** Vorgeschalteter Consent-Screen (`OnlineSharingIntroView`) mit:
  - Klarer Erklärung des Zwecks
  - Datenschutz-Tabelle (Verschlüsselung, Serverstandort, anonyme IDs)
  - Pflicht-Checkbox vor Aktivierung
- [x] **FR-15.3:** Aktivierung erzeugt ECDH-Schlüsselpaar, legt anonyme Supabase-Session an und speichert `onlineSharing.enabled = true` in localStorage
- [x] **FR-15.4:** Wenn `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` nicht konfiguriert sind, wird der Familienmodus-Abschnitt nicht angezeigt

### 4.2 Kontaktverwaltung (bidirektionaler Handshake)

- [x] **FR-15.5:** Benutzer generiert einen `#contact/...`-URL, der `deviceId`, öffentlichen Schlüssel und Anzeigename enthält (AES-GCM-verschlüsselt + deflate-raw)
- [x] **FR-15.6:** Empfänger öffnet den URL; `ContactHandshakeView` zeigt Absender und „Verbinden"-Button
- [x] **FR-15.7:** Nach Verbindung wird dem Empfänger der eigene Kontakt-URL angezeigt, um ihn zurückzusenden (Gegenseitigkeit)
- [x] **FR-15.8:** Kontakt wird lokal als `Friend` mit `.online`-Block gespeichert (`deviceId`, `publicKey`, `linkedAt`)
- [x] **FR-15.9:** Kontakt-Handshake funktioniert auch für Benutzer, die den Familienmodus noch nicht aktiviert haben (Aktivierung wird im Handshake-Screen angeboten)

### 4.3 Erinnerungen teilen

- [x] **FR-15.10:** Im Familienmodus-Hub (Tab „Teilen") wählt der Benutzer eine gespeicherte Erinnerung und einen oder mehrere Online-Kontakte als Empfänger
- [x] **FR-15.11:** Payload (`ShareBody`) enthält: Frage-ID (optional), Fragetext, Antworttext, Bildanzahl, Erstellungsdatum, Absendername
- [x] **FR-15.12:** Geteilte Erinnerungen werden für jeden Empfänger einzeln per ECDH-Wrapping verschlüsselt (Gruppen-Key-Wrapping)
- [x] **FR-15.13:** Bilder werden separat verschlüsselt hochgeladen; Metadaten in `share_media`
- [x] **FR-15.14:** Ladeanimation während des Uploads; Fehler (Rate Limit, Timeout, kein Netz) werden verständlich angezeigt

### 4.4 Eingehende Erinnerungen (Feed)

- [x] **FR-15.15:** Tab „Feed" listet alle empfangenen Erinnerungen chronologisch
- [x] **FR-15.16:** Beim Öffnen des Hubs werden Shares automatisch abgerufen und clientseitig entschlüsselt (`fetchIncomingShares`)
- [x] **FR-15.17:** Manueller „Aktualisieren"-Button für erneuten Abruf
- [x] **FR-15.18:** Empfangene Bilder werden entschlüsselt und inline dargestellt

### 4.5 Ergänzungen (Annotations)

- [x] **FR-15.19:** Empfänger kann unter einer geteilten Erinnerung eine „Ergänzung" hinzufügen (Text + optional Bild)
- [x] **FR-15.20:** Ergänzungen werden genauso E2E-verschlüsselt wie Shares (eigenes Ciphertext + IV + wrapped keys)
- [x] **FR-15.21:** Ergänzungen sind nur für den Share-Besitzer und alle Empfänger sichtbar

### 4.6 Deaktivierung

- [x] **FR-15.22:** Tab „Einstellungen" bietet „Familienmodus deaktivieren"-Button mit Warnhinweis
- [x] **FR-15.23:** Deaktivierung löscht auf dem Server kaskadierend: Geräteeintrag → Shares → Ergänzungen → Mediaobjekte (via Supabase RLS-Kaskade)
- [x] **FR-15.24:** Lokal: IndexedDB-Schlüssel wird gelöscht, `onlineSharing`-Block aus localStorage entfernt, Online-Kontakte (`friends[].online`) bereinigt
- [x] **FR-15.25:** Eigene (lokal gespeicherte) Antworten bleiben vollständig erhalten

### 4.7 Performance & Offline-Verhalten

- [x] **FR-15.26:** Supabase-Modul wird nur geladen (`dynamic import`), wenn `onlineSharing.enabled === true`; Offline-Nutzer laden `@supabase/supabase-js` nie
- [x] **FR-15.27:** Netzwerkanfragen haben ein 20-Sekunden-Timeout (mobile Verbindungen)
- [x] **FR-15.28:** Bei fehlender Verbindung bleibt die App voll funktionsfähig; Familienmodus zeigt Fehlermeldung statt zu hängen

---

## 5. Datenbankschema (Supabase)

### 5.1 Tabellen

```sql
devices (
  id          uuid PRIMARY KEY,   -- Supabase auth.uid()
  public_key  bytea NOT NULL,      -- ECDH SPKI-kodierter öffentlicher Schlüssel
  created_at  timestamptz
)

shares (
  id              uuid PRIMARY KEY,
  owner_id        uuid REFERENCES devices,
  ciphertext      bytea NOT NULL,
  iv              bytea NOT NULL,
  encrypted_keys  jsonb NOT NULL,  -- { "<deviceId>": "<wrappedKey_b64>" }
  created_at      timestamptz,
  updated_at      timestamptz
)

share_recipients (
  share_id      uuid REFERENCES shares,
  recipient_id  uuid REFERENCES devices,
  PRIMARY KEY (share_id, recipient_id)
)

annotations (
  id              uuid PRIMARY KEY,
  share_id        uuid REFERENCES shares,
  author_id       uuid REFERENCES devices,
  ciphertext      bytea NOT NULL,
  iv              bytea NOT NULL,
  encrypted_keys  jsonb NOT NULL,
  created_at      timestamptz
)

share_media (
  id            uuid PRIMARY KEY,
  share_id      uuid REFERENCES shares,
  storage_path  text NOT NULL,    -- Pfad in share-media-Bucket
  iv            bytea NOT NULL,
  created_at    timestamptz
)
```

### 5.2 Row-Level Security

| Tabelle | Policy |
|---------|--------|
| `devices` | Jeder kann public keys lesen; nur Eigentümer kann schreiben/löschen |
| `shares` | Nur Eigentümer kann anlegen/ändern/löschen; Empfänger können lesen wenn in `share_recipients` |
| `annotations` | Autor kann schreiben; Eigentümer + Empfänger können lesen; Autor kann löschen |
| `share_media` | Lese-Zugriff für Share-Eigentümer und -Empfänger; Schreiben nur für Eigentümer |

---

## 6. Architektur

### 6.1 Relevante Dateien

```
src/
├── utils/
│   ├── crypto.ts              # ECDH P-256, AES-GCM Primitiven
│   ├── shareEncryption.ts     # High-Level E2EE: encryptShare, decryptShare,
│   │                          #   encryptAnnotation, encryptImage, …
│   ├── deviceKeyStore.ts      # IndexedDB-Persistenz des Schlüsselpaars
│   ├── supabaseClient.ts      # Lazy-Init + anonyme Session + Feature-Flag
│   ├── sharingService.ts      # bootstrapSession, shareMemory, fetchIncomingShares,
│   │                          #   addAnnotation, deactivateOnlineSharing
│   ├── secureLink.ts          # #contact/-URL-Generierung & -Parsing
│   └── payloadGuards.ts       # Runtime-Validierung aller URL-Payloads
├── hooks/
│   ├── useOnlineSync.ts       # Session-State, memories[], annotations[], refresh()
│   └── useAnswers.ts          # Globaler State inkl. enableOnlineSharing/disable…
└── views/
    ├── OnlineSharingIntroView.tsx   # Consent-Screen
    ├── OnlineSharingHubView.tsx     # Hub: Feed / Teilen / Kontakte / Einstellungen
    ├── ContactHandshakeView.tsx     # Kontakt-Einladung annehmen
    └── SharedMemoryView.tsx         # Erinnerung via #ms/-URL anzeigen

supabase/
└── migrations/
    └── 20260421000000_sharing.sql   # Vollständiges Schema + RLS-Policies
```

### 6.2 Datenfluss (Teilen)

```
useAnswers (Erinnerung auswählen + Empfänger)
    ↓
sharingService.shareMemory()
    ↓
shareEncryption.encryptShare()
  → Zufälligen ContentKey generieren
  → JSON-Payload komprimieren (deflate-raw)
  → AES-GCM-256 verschlüsseln
  → ContentKey für jeden Empfänger per ECDH wrappen
    ↓
supabaseClient → shares + share_recipients + share_media eintragen
```

### 6.3 Datenfluss (Empfangen)

```
useOnlineSync.refresh()
    ↓
sharingService.fetchIncomingShares()
    ↓
Supabase SELECT shares WHERE id IN (SELECT share_id FROM share_recipients WHERE recipient_id = meinID)
    ↓
shareEncryption.decryptShare()
  → encrypted_keys[meineDeviceId] per ECDH unwrappen → ContentKey
  → AES-GCM entschlüsseln → inflate → ShareBody
    ↓
useOnlineSync.memories[] → OnlineSharingHubView Feed-Tab
```

---

## 7. Datenmodell (TypeScript)

```typescript
interface OnlineSharingState {
  enabled: boolean
  activatedAt?: string
  deviceId?: string      // Supabase auth.uid()
  publicKey?: string     // ECDH SPKI base64url
}

interface Friend {
  id: string
  name: string
  addedAt: string
  online?: {
    deviceId: string
    publicKey: string    // ECDH P-256 SPKI base64url
    linkedAt: string
  }
}

interface ShareBody {
  $type: 'remember-me-share'
  version: 1
  questionId?: string
  questionText: string
  value: string
  imageCount: number
  createdAt: string
  ownerName: string
}

interface SharedMemory {
  shareId: string
  ownerDeviceId: string
  ownerName: string
  questionText: string
  value: string
  imageIds: string[]
  createdAt: string
  updatedAt: string
}

interface ContactHandshake {
  $type: 'remember-me-contact'
  version: 1
  deviceId: string
  publicKey: string      // SPKI base64url
  displayName: string
}
```

---

## 8. Nicht-funktionale Anforderungen

| Anforderung | Wert |
|-------------|------|
| **Verschlüsselung** | AES-GCM-256 für Inhalt; ECDH P-256 für Key-Wrapping |
| **Privater Schlüssel** | Non-extractable, verlässt niemals `crypto.subtle` |
| **Serverstandort** | EU (Supabase-Projekt in EU-Region) |
| **Auth** | Anonym (kein Account, keine E-Mail) |
| **Bundle-Impact** | 0 KB für Offline-Nutzer (dynamic import) |
| **Netzwerk-Timeout** | 20 s pro Request |
| **Offline-Verhalten** | App bleibt voll funktionsfähig; Familienmodus-Fehler angezeigt |
| **Deaktivierung** | Kaskadierendes Server-Delete + lokale Bereinigung |
| **Rückwärtskompatibilität** | `onlineSharing`-Block in localStorage ist optional; Fehlen = deaktiviert |

---

## 9. Akzeptanzkriterien

- [x] Aktivierung ohne bestehenden Account möglich (anonym)
- [x] Consent-Screen mit Pflicht-Checkbox vor erster Aktivierung
- [x] Kontakt-Handshake funktioniert mit einem einmaligen URL-Austausch
- [x] Geteilte Erinnerung erscheint verschlüsselt in der Datenbank (kein Klartext sichtbar)
- [x] Empfänger kann die Erinnerung nach Empfang vollständig entschlüsseln und lesen
- [x] Bilder werden zusammen mit der Erinnerung verschlüsselt übertragen
- [x] Ergänzungen (Annotations) sind nur für Autor und Share-Teilnehmer sichtbar
- [x] Deaktivierung entfernt alle Serverdaten und den lokalen Schlüssel
- [x] Offline-Nutzer sehen keinerlei Netzwerkaktivität zu Supabase
- [x] E2E-Tests: Kein Netzwerkverkehr zu `*.supabase.co` ohne Opt-in (`sharing-optin.spec.ts`)

---

## 10. Tests

### Unit-Tests (`src/**/*.test.ts`)

| Datei | Abgedeckte Aspekte |
|-------|--------------------|
| `shareEncryption.test.ts` | Encrypt/Decrypt für Besitzer, Empfänger, Nicht-Empfänger |
| `sharingService.test.ts` | Mocked Supabase: share, annotate, fetch, deactivate |
| `useOnlineSync.test.ts` | Bootstrap, Fetch, Fehlerbehandlung, Refresh |
| `secureLink.contact.test.ts` | Kontakt-URL generieren und parsen |
| `payloadGuards.test.ts` | Validierung malformatierter / zu langer Payloads |

### E2E-Tests (`e2e/`)

| Datei | Abgedeckte Szenarien |
|-------|--------------------|
| `sharing-optin.spec.ts` | Kein Supabase-Traffic ohne Opt-in; Feature versteckt wenn nicht konfiguriert; Supabase-Chunk wird nicht geladen |

---

## 11. Abhängigkeiten

| Abhängigkeit | Grund |
|--------------|-------|
| `@supabase/supabase-js` | Datenbank-Client (lazy-loaded) |
| Web Crypto API (`crypto.subtle`) | ECDH, AES-GCM – kein externes Krypto-Paket |
| Supabase-Projekt (EU) | Datenspeicherung + Storage-Bucket + anonyme Auth |
| REQ-003 (Story Storage) | Lokale Erinnerungen als Quelle der zu teilenden Inhalte |
| REQ-004 (Export & Sharing) | Offline-Einladungslinks (Basis-Infrastruktur) |

---

## 12. Änderungshistorie

| Version | Datum | Autor | Änderung |
|---------|-------|-------|---------|
| 1.0.0 | 2026-04-26 | Claude | Initiale Dokumentation (Reverse Engineering der Implementierung) |

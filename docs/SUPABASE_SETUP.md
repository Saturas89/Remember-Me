# Supabase-Setup für Online-Teilen (optional)

Dieses Dokument richtet sich an Self-Hoster und Betreiber. Endnutzer können
es ignorieren – sie sehen das Online-Teilen-Feature erst, wenn die
Umgebungsvariablen gesetzt sind.

## Voraussetzungen

- Supabase-Projekt (EU-Region empfohlen) – entweder [supabase.com](https://supabase.com/)
  oder self-hosted (`supabase start`).
- Zugriff auf das SQL-Editor-Dashboard oder Supabase CLI.

## 1. Schema + RLS

Wende die Migration aus `supabase/migrations/20260421000000_sharing.sql` an:

```bash
supabase db push
# oder (manuell, in Supabase Studio → SQL Editor):
# Inhalt der Migration einfügen + Run
```

Die Migration legt folgendes an:

| Tabelle              | Zweck                                                    |
|----------------------|----------------------------------------------------------|
| `devices`            | Public Keys + anonyme Geräte-IDs                         |
| `shares`             | Verschlüsselte Erinnerungen (Ciphertext + IV + Wraps)    |
| `share_recipients`   | ACL + Subscription-Filter                                |
| `annotations`        | Ergänzungen anderer User (Ciphertext + IV + Wraps)       |
| `share_media`        | Verweise auf verschlüsselte Storage-Objekte              |
| Storage-Bucket `share-media` | Bytes der verschlüsselten Bilder (privat)        |

RLS-Policies stellen sicher, dass:

- `devices`: jeder anonyme User darf nur seine eigene Zeile schreiben und alle
  Public Keys lesen (für ECDH-Wrap).
- `shares` / `annotations` / `share_media`: SELECT nur für Owner oder
  `share_recipients.recipient_id = auth.uid()`.
- INSERT/UPDATE/DELETE nur durch Owner (shares/media) bzw. Autor (annotations).

## 2. Anonymous Auth aktivieren

In Supabase Studio → *Authentication → Providers → Anonymous* einschalten.
Das Feature nutzt anonyme Sessions, **keine** E-Mail- oder OAuth-Logins.

## 3. Storage-Bucket

Die Migration erzeugt `share-media` privat. Bitte in der Bucket-Konfiguration
sicherstellen:

- Public Access: **off**
- Upload-Größenlimit: z. B. 10 MB/Datei (an euren Use-Case anpassen)

## 4. ENV-Variablen setzen

In der Anwendung (Vercel-Dashboard oder `.env.local`):

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi…   # „anon/public" Key aus Supabase-Dashboard
```

Ohne diese Variablen blendet die App den Online-Teilen-Einstieg automatisch
aus – der Offline-Flow funktioniert davon völlig unabhängig.

## 5. Verifizieren

```bash
npm run build
npm run preview
```

- Starte das Frontend, klicke auf *Freunde → Online-Teilen einrichten*.
- Bestätige die Datentransparenz, klicke *Aktivieren*.
- In Supabase-Studio solltest du einen Eintrag in `devices` mit deinem
  anonymen User-ID sehen.
- `select ciphertext from shares;` zeigt ausschließlich Bytea-Binärdaten, kein
  Klartext der Antwort.

## Datenschutz-Hinweise

- Die App speichert am Server nie den Anzeigenamen eines Nutzers – er ist
  Teil des verschlüsselten Payloads.
- Zeitstempel (`created_at`, `updated_at`) sind Metadaten in Klartext;
  das ist eine bewusste Abwägung für Sortierung & Realtime-Filter.
- Beim Deaktivieren werden alle Server-Zeilen mit `owner_id = self` und alle
  Annotations mit `author_id = self` per Cascade gelöscht. Zugehörige
  Storage-Objekte werden ebenfalls entfernt (Storage-Policy).

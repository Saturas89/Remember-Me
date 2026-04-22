# Wo liegen meine Daten?

Remember Me ist eine Offline-first-App. Dieses Dokument erklärt in einfacher
Sprache, welche Daten **wo** gespeichert werden und **warum**.

## Kurzfassung

- **Standard (alle Nutzer):** Alle deine Antworten, Bilder, Audio- und
  Videodateien liegen ausschließlich lokal auf deinem Gerät. Es geht
  **nichts** an einen Server.
- **Optional, nur nach ausdrücklicher Aktivierung:** Wenn du im Bereich
  *Freunde → Online teilen* auf *Aktivieren* klickst, werden einzelne
  Erinnerungen, die du selbst mit bestimmten Kontakten teilst, **Ende-zu-Ende-
  verschlüsselt** auf einem Server (Supabase, EU) zwischengespeichert. Nur die
  Empfänger-Geräte können den Inhalt lesen – der Server sieht lediglich
  Ciphertext.

## Detaillierte Datenlandkarte

| Was                                              | Wo                        | Form                              |
|--------------------------------------------------|---------------------------|-----------------------------------|
| Profilname, Antworten, Medien (Foto/Audio/Video) | Dein Gerät                | Klartext in localStorage + IndexedDB |
| Freundesliste (Namen + Avatar)                   | Dein Gerät                | Klartext in localStorage          |
| `#mi/`-Invite-Links, `#ma/`-Answer-Imports       | Deine Zwischenablage / per Messenger übertragen | Verschlüsseltes Hash-Fragment (AES-GCM) |
| ZIP-Export                                       | Datei deiner Wahl         | Binär, unverschlüsselt (lokal)    |
| **Online-Teilen (opt-in):**                      |                           |                                   |
| Geteilte Erinnerungen (Text + Bilder)            | Supabase                  | Ciphertext (AES-256-GCM)          |
| Empfänger-Liste einer Erinnerung                 | Supabase                  | Opake Geräte-UUIDs, keine Namen   |
| Zeitstempel                                      | Supabase                  | Klartext-Metadaten                |
| Dein Public Key + anonyme Geräte-ID              | Supabase                  | Klartext (nötig für ECDH)         |
| Dein **Private Key**                             | Dein Gerät                | IndexedDB, nicht exportierbar     |

## Was bedeutet „Ende-zu-Ende-verschlüsselt"?

- Vor dem Upload erzeugt dein Gerät einen zufälligen Inhaltsschlüssel
  (AES-256-GCM) pro Erinnerung.
- Dieser Schlüssel wird für jeden Empfänger einzeln mit dessen Public Key
  „verpackt" (ECDH P-256 + HKDF → AES-GCM-Wrap).
- Nur der Empfänger kann den Schlüssel mit seinem **privaten** Schlüssel
  wieder auspacken und die Erinnerung entschlüsseln.
- Der Server (Supabase) sieht nur Ciphertext und kann den Inhalt nicht lesen.
- Es gibt keinen „Admin-Zugang" zu verschlüsselten Inhalten.

## Deaktivieren & Löschen

- Im Bereich *Online teilen → Einstellungen* gibt es den Button
  **„Online-Teilen deaktivieren"**. Er löscht:
  - alle deine geteilten Erinnerungen vom Server,
  - alle Ergänzungen, die du zu Erinnerungen anderer geschrieben hast,
  - zugehörige verschlüsselte Medien aus Supabase Storage,
  - deinen Private Key auf deinem Gerät,
  - die Anmeldung an Supabase.
- Deine **lokalen Offline-Antworten** bleiben unberührt. Das Feature lässt
  sich jederzeit wieder neu aktivieren (dann mit frischem Schlüsselpaar und
  als neuer Kontakt für alle).

## Keine PII am Server

- Keine E-Mail-Adresse, kein Passwort, kein Login.
- Der Server kennt dich nur als anonyme UUID.
- Der Anzeigename erscheint nur in der verschlüsselten Payload und ist für
  den Server nicht lesbar.

## Wer sieht was?

| Rolle              | Sieht                                                        |
|--------------------|--------------------------------------------------------------|
| Du                 | Alle eigenen Daten, alle Erinnerungen, die mit dir geteilt wurden |
| Empfänger          | Nur die Erinnerungen, für die du sie explizit ausgewählt hast |
| Unbeteiligte Dritte| Nichts – RLS-Policies verhindern den Zugriff                 |
| Server-Administration | Ciphertext + Metadaten (Zeitstempel, UUIDs), keine Klartext-Inhalte |

## Verlust deines Private Keys

Dein Private Key liegt nicht exportierbar in IndexedDB. Wenn alle deine
Geräte verloren gehen oder du die App-Daten komplett löschst, kannst du
zuvor geteilte Erinnerungen nicht mehr entschlüsseln. Kontakte müssen dich
dann als neuen Kontakt aufnehmen. (Eine Recovery-Phrase ist für V2 geplant.)

## Transparenz

- Open Source: der komplette Quellcode ist einsehbar.
- CI-Pflicht: Playwright-Tests prüfen, dass ohne Aktivierung kein Request an
  `supabase.co` rausgeht (`e2e/sharing-optin.spec.ts`).
- Statische Tests (`src/utils/optin.test.ts`) stellen sicher, dass der
  Supabase-Client-Code niemals statisch importiert wird – der Offline-Code-
  Pfad zieht das Modul nicht ins Bundle.

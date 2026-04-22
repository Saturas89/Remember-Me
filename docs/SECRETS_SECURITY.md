# Secrets & Security – Remember Me

---

## Grundregel

**Niemals Secrets committen.** `.env`-Dateien gehören in `.gitignore`, Secrets nur in Vercel Dashboard.

## Was ist geheim?

| Geheim (Secret) | Öffentlich (OK im Code) |
|-----------------|------------------------|
| API Keys, Passwörter, Tokens | API-Endpoints (URLs) |
| Private SSH Keys | Public API Keys |
| Environment-spezifische Configs | Feature Flags, Konstanten |

## .gitignore

```gitignore
.env
.env.local
.env.*.local
*.pem
*.key
```

## Secrets verwalten

- **Lokal:** `.env.local` (nicht committed)
- **Production:** Vercel Dashboard → Settings → Environment Variables

## Notfall: Secret committed?

1. Secret sofort auf Vercel/Provider revoken
2. Neues Secret erstellen
3. Git-History bereinigen: `git filter-branch --tree-filter 'rm -f .env' HEAD`

## Optionales Online-Teilen (E2E-verschlüsselt)

Remember Me enthält ein optionales, standardmäßig deaktiviertes Feature, das
Erinnerungen Ende-zu-Ende-verschlüsselt mit ausgewählten Kontakten teilt.
Details zur Datenarchitektur: [`docs/DATA_STORAGE.md`](./DATA_STORAGE.md).

- **Private Key:** Liegt ausschließlich auf dem Gerät, in IndexedDB
  (`rm-device-key`), als `non-extractable` CryptoKey (P-256). Wird nie
  serialisiert, nie exportiert, nie an einen Server übertragen.
- **Inhalte:** AES-256-GCM pro Erinnerung, Inhaltsschlüssel wird pro
  Empfänger via ECDH + HKDF → AES-GCM-Wrap im `encrypted_keys`-JSONB der
  Share-Zeile abgelegt.
- **Zero-Knowledge-Server:** Supabase sieht nur Ciphertext + opake
  Geräte-UUIDs. Es gibt keinen Admin-Override.
- **Opt-in-Garantie:** `src/utils/optin.test.ts` prüft statisch, dass
  `@supabase/supabase-js` nirgends außerhalb des Lazy-Chunks importiert
  wird. `e2e/sharing-optin.spec.ts` verifiziert in CI, dass ohne
  Aktivierung kein Request an Supabase rausgeht.
- **Recovery-Verhalten:** Key-Verlust = Datenverlust der betroffenen
  Ciphertexte. Eine Recovery-Phrase ist nicht Teil des MVP (V2). Nutzer
  werden im Intro-Screen darauf hingewiesen.
- **Key-Rotation / Revocation:** nicht im MVP. Kontakte zu entfernen
  genügt für den Schreib-Schutz künftiger Shares; bereits geteilte
  Erinnerungen bleiben bei den jeweiligen Empfängern lesbar, solange sie
  diese nicht selbst löschen.

Setup-Anleitung für Betreiber: [`docs/SUPABASE_SETUP.md`](./SUPABASE_SETUP.md).

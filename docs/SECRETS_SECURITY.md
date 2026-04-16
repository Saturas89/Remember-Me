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

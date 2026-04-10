# Secrets & Security Management

**Status:** 🔴 CRITICAL  
**Version:** 1.0.0  
**Letzte Aktualisierung:** 2026-04-03

---

## ⚠️ KRITISCH: Niemals Passwörter committen!

```
🔴 FALSCH - NIEMALS MACHEN:
git add .env
git commit -m "Add environment variables"
git push

✅ RICHTIG - IMMER MACHEN:
echo ".env" >> .gitignore
git add .gitignore
# Secrets nur in GitHub/Vercel dashboard!
```

---

## 1. Was sind Secrets?

Sensible Daten die **NICHT** im Code/Repository gehören:

```
❌ GEHEIM (Secret):
- API Keys
- Database Passwords
- Auth Tokens (JWT, OAuth)
- Private SSH Keys
- Environment-spezifische Configs
- Credit Card Info
- Any credentials

✅ ÖFFENTLICH (OK im Code):
- Database Host Name (IP okay wenn Public)
- API Endpoints (URLs)
- Public API Keys
- Configuration (Feature Flags)
- Constants
```

---

## 2. `.gitignore` - Dateien nicht committen

### Datei: `.gitignore`

```gitignore
# Environment Variables - NIEMALS committen
.env
.env.local
.env.*.local
.env.production

# OS & IDE
.DS_Store
Thumbs.db
.vscode/
.idea/

# Dependencies
node_modules/
/dist/
/build/

# Secrets & Keys
*.pem
*.key
id_rsa
id_rsa.pub

# Logs
*.log
npm-debug.log*
yarn-debug.log*

# Temp files
.tmp/
temp/
```

### Überprüfung: Was würde gerade committed?

```bash
# Sehe was geadded ist
git status

# Sehe was im Commit sein würde (aber nicht .gitignore)
git diff --cached

# Sehe .env Dateien - dürfen NICHT drin sein!
git ls-files | grep ".env"
```

---

## 3. GitHub Secrets Management

### Step 1: GitHub Secrets erstellen

```
Gehe zu: GitHub.com
  Repository → Settings → Secrets and variables → Actions

Klicke: "New repository secret"

Name:  DATABASE_PASSWORD
Value: SuperSecurePassword123!

Speichern ✓
```

### Step 2: In GitHub Actions nutzen

```yaml
# .github/workflows/deploy.yml
env:
  DATABASE_PASSWORD: ${{ secrets.DATABASE_PASSWORD }}
  API_KEY: ${{ secrets.API_KEY }}

jobs:
  build:
    steps:
      - run: npm run build
        env:
          DB_PASS: ${{ secrets.DATABASE_PASSWORD }}
```

**GitHub Actions Sicherheit:**
- ✓ Secrets werden maskiert in Logs
- ✓ Secrets sind encrypted
- ✓ Nur authorized users sehen Wert
- ✓ Passwörter nicht im Log sichtbar

### Beispiel: Was GitHub sichtbar macht

```
❌ Ohne Masking:
"Connecting to database with password: SuperSecurePassword123!"

✓ Mit Masking (GitHub macht das automatisch):
"Connecting to database with password: ***"
```

---

## 4. Vercel Environment Variables

### Step 1: Vercel Dashboard öffnen

```
Gehe zu: Vercel.com
  Dashboard → Project Settings → Environment Variables
```

### Step 2: Variables hinzufügen

```
Name:     DATABASE_URL
Value:    postgresql://user:pass@localhost/db
Environments: Production, Preview, Development
```

### Step 3: In Code nutzen

```javascript
// Zur Laufzeit verfügbar
const dbUrl = process.env.DATABASE_URL

// NIEMALS:
// export const password = "SuperSecure123"  ❌ FALSCH!

// RICHTIG:
// import { dbUrl } from '@env'  ✓
```

---

## 5. Workflow: Sicheres Setup

### Phase 1: Repository Setup

```bash
# 1. Clone repository
git clone https://github.com/saturas89/remember-me.git
cd remember-me

# 2. Überprüfe .gitignore
cat .gitignore | grep ".env"
# Sollte `.env` enthalten!

# 3. Erstelle .env.example (ohne Werte!)
cat > .env.example << EOF
DATABASE_PASSWORD=
API_KEY=
JWT_SECRET=
VERCEL_TOKEN=
EOF

git add .env.example
git commit -m "Add .env.example template"
git push
```

### Phase 2: GitHub Secrets Setup

```
GitHub → Settings → Secrets → New Repository Secret

Secrets die benötigt werden:
- DATABASE_PASSWORD
- API_KEY
- JWT_SECRET
- VERCEL_TOKEN
```

### Phase 3: Vercel Secrets Setup

```
Vercel → Project Settings → Environment Variables

Production Variables:
- DATABASE_URL
- API_ENDPOINT
- NODE_ENV=production
```

### Phase 4: GitHub Actions nutzen

```yaml
# .github/workflows/deploy.yml
jobs:
  build:
    steps:
      - run: npm run build
        env:
          DATABASE_PASSWORD: ${{ secrets.DATABASE_PASSWORD }}
          API_KEY: ${{ secrets.API_KEY }}
```

---

## 6. Sicherheits-Checkliste

### Vor dem ersten Push

```
✓ .gitignore existiert
✓ .env ist in .gitignore
✓ .env.local ist in .gitignore
✓ *.pem ist in .gitignore
✓ id_rsa ist in .gitignore
```

### Vor dem ersten Commit

```bash
# Überprüfe keine .env Dateien staged sind
git status | grep ".env"
# Sollte NICHTS zeigen!

# Überprüfe .env nicht im Repository
git ls-files | grep ".env"
# Sollte NICHTS zeigen!
```

### Vor der Pipeline

```
✓ GitHub Secrets hinzugefügt
✓ Vercel Environment Variables gesetzt
✓ GitHub Actions kann auf Secrets zugreifen
✓ Workflow nutzt ${{ secrets.NAME }}
```

### Regelmäßig

```
✓ Ungenutzte Secrets löschen
✓ Passwörter regelmäßig wechseln
✓ Alte Tokens revoken
✓ Audit Trail überprüfen
```

---

## 7. Worst Case: Secret wurde committed!

### SOFORT HANDELN:

```bash
# 1. NIEMALS nochmal pushen (secret wird exponiert)
# 2. GitHub öffnen und Secret revoken

# 3. Git history bereinigen (für lokales repo)
git log --oneline | head -20
# Finde Commit mit secret

# 4. Secret aus History entfernen
git filter-branch --tree-filter 'rm -f .env' HEAD

# 5. Force push (nur wenn du es absolut sicher bist!)
git push origin main --force
```

**Besser:**
1. Secret sofort auf Vercel/Datenbank revoken
2. Neues Secret erstellen
3. Notfall-Deploy machen
4. History später bereinigen

---

## 8. Environment-spezifische Secrets

### Development (local machine)

```bash
# .env.local (nicht committed)
DATABASE_PASSWORD=dev_password_123
API_KEY=dev_key_456
NODE_ENV=development
```

### GitHub Actions (Testing)

```yaml
# .github/workflows/test.yml
env:
  NODE_ENV: test
  
steps:
  - run: npm test
    env:
      DATABASE_PASSWORD: ${{ secrets.TEST_DATABASE_PASSWORD }}
```

### Vercel (Production)

```
Dashboard → Environment Variables

Production:
  NODE_ENV: production
  DATABASE_PASSWORD: (set via Vercel UI)
  API_ENDPOINT: https://api.remember-me.com
```

---

## 9. Secrets Rotation (Regelmäßiger Wechsel)

### Monatlich überprüfen:

```
✓ Welche Secrets haben wir?
✓ Werden sie noch genutzt?
✓ Sind sie noch sicher?
✓ Sollen sie gewechselt werden?
```

### Secrets wechseln:

```
1. Neues Secret erstellen (z.B. DATABASE_PASSWORD_v2)
2. Beide Secrets parallel nutzen (Old + New)
3. Code zu neuem Secret switcheln
4. Altes Secret auf Vercel löschen
5. Altes Secret auf GitHub löschen
6. Dokumentieren (Rotation durchgeführt)
```

---

## 10. Best Practices

### ✅ DO

```
✓ Alle Secrets in GitHub/Vercel Secrets verwenden
✓ .env in .gitignore haben
✓ .env.example als Template committen (ohne Werte)
✓ Secrets regelmäßig wechseln
✓ Audit Logs überprüfen
✓ Least Privilege (nur nötige Secrets)
✓ Secrets für verschiedene Umgebungen verschieden
✓ README mit .env.example Link dokumentieren
```

### ❌ DON'T

```
❌ Passwörter im Code hardcoden
❌ .env committen
❌ Secrets im Log ausgeben
❌ Secrets in Commit-Messages schreiben
❌ Secrets in Kommentaren schreiben
❌ Secrets auf Slack/Email teilen
❌ Alte Secrets nicht löschen
❌ Alle denselben Secret-String nutzen
```

---

## 11. Beispiel: README.md

```markdown
# Remember Me

## Setup

### 1. Environment Variables

```bash
cp .env.example .env.local
```

Fülle `.env.local` mit deinen lokalen Secrets:
- `DATABASE_PASSWORD`: Local database password
- `API_KEY`: Local development API key

⚠️ `.env.local` wird NICHT committed (in .gitignore)

### 2. GitHub Secrets (für CI/CD)

Gehe zu Settings → Secrets und erstelle:
- `DATABASE_PASSWORD`
- `API_KEY`
- `VERCEL_TOKEN`

Siehe SECRETS_SECURITY.md für Details.
```

---

## 12. Änderungshistorie

| Version | Datum | Autor | Änderung |
|---------|-------|-------|---------|
| 1.0.0 | 2026-04-03 | Claude | Initiales Document |

---

## 📚 Weitere Ressourcen

- [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [OWASP: Secrets Management](https://owasp.org/www-community/controls/Secrets_Management)


# Deployment mit Vercel

**Status:** 🟢 ACTIVE  
**Version:** 1.0.0  
**Letzte Aktualisierung:** 2026-04-03

---

## 🚀 Quick Start (60 Sekunden)

```
1. ✅ Vercel Account erstellt
2. ✅ GitHub Repository connected
3. ✅ vercel.json konfiguriert
4. ✅ Tests laufen automatisch

Jetzt einfach:
  git push origin main
    ↓
  Vercel buildet + testet + deployed
    ↓
  App LIVE in 2-5 Minuten!
```

---

## 📋 Dein Setup

```
Repository: saturas89/simple-workout
├── vercel.json (Konfiguration)
├── package.json (Scripts)
└── .github/ (Optional: GitHub Actions später)

Vercel verbunden: ✅
Auto-Deploy aktiviert: ✅
Tests aktiviert: ✅ (wenn npm run test existiert)
```

---

## 🔧 Konfiguration: vercel.json

**Datei: `/vercel.json`**

```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm ci",
  "env": {
    "NODE_ENV": "production"
  },
  "functions": {
    "api/**/*.ts": {
      "memory": 1024,
      "maxDuration": 60
    }
  }
}
```

**Was das macht:**
- `buildCommand`: npm run build (Build App)
- `devCommand`: npm run dev (Lokal Development)
- `installCommand`: npm ci (Dependencies)
- `env`: Environment Variables
- `functions`: API Routes Konfiguration

---

## ✅ Tests hinzufügen

### Schritt 1: Stelle sicher, dass du Test-Scripts hast

**In package.json:**

```json
{
  "scripts": {
    "build": "vite build",
    "dev": "vite",
    "test": "vitest run",
    "test:unit": "vitest run",
    "test:e2e": "cypress run"
  }
}
```

### Schritt 2: Tests in Build einbauen (Optional)

Falls du Tests BLOCKIEREN möchtest (Build schlägt fehl wenn Test fehlschlägt):

**Update: vercel.json**

```json
{
  "buildCommand": "npm run build && npm run test",
  "devCommand": "npm run dev",
  "installCommand": "npm ci"
}
```

Das bedeutet:
```
Vercel wird:
1. npm run build
2. npm run test
3. Falls Test fehlschlägt → Deploy wird BLOCKIERT ❌
4. Falls alles OK → Deploy ✅
```

### Schritt 3: Commit & Push

```bash
git add vercel.json
git commit -m "Add Vercel CI with tests"
git push origin main
```

### Schritt 4: Deploy beobachten

```
Vercel Dashboard → Deployments
  ↓
Solltest "Building..." sehen
  ↓
Klicke auf Deployment
  ↓
Logs sollten zeigen:
  - npm ci
  - npm run build
  - npm run test (wenn aktiv)
  ↓
✅ Ready (oder ❌ Failed)
```

---

## 🔄 Workflow

### Normal Deploy (ohne Tests blockiert):

```
Du:
  git push origin main

Vercel (automatisch):
  1. npm ci
  2. npm run build
  3. Deploy
  4. ✅ Live

Zeit: 2-5 Minuten
```

### Mit Tests blockiert:

```
Du:
  git push origin main

Vercel (automatisch):
  1. npm ci
  2. npm run build
  3. npm run test ← Tests blockieren hier!
  4. (Falls OK) Deploy
  5. ✅ Live

Zeit: 3-8 Minuten
```

---

## 📊 Test Output

### Erfolgreich:

```
▶ Building...
✓ npm ci (installed)
✓ npm run build (builded)
✓ npm run test (passed)
✓ Deploy to CDN
✓ Ready

URL: https://simple-workout.vercel.app
```

### Fehlgeschlagen:

```
▶ Building...
✓ npm ci
✓ npm run build
✗ npm run test (FAILED)
✗ Deployment aborted

→ Check logs for errors
→ Fix tests locally
→ Push again
```

---

## 🌍 Environment Variables in Vercel

Falls deine App `.env` Variables braucht:

### Schritt 1: Vercel Dashboard

```
Vercel.com
  → Dashboard
  → Project: simple-workout
  → Settings
  → Environment Variables
```

### Schritt 2: Variable hinzufügen

```
Name: NEXT_PUBLIC_API_URL
Value: https://api.example.com

Name: DATABASE_URL
Value: postgresql://...
```

### Schritt 3: Neu deployen

```
Vercel Dashboard → Deployments
  → Klicke auf aktuellen Deployment
  → Klicke "Redeploy"
```

---

## 🆘 Troubleshooting

### Problem: Build fehlgeschlagen

```
Fehler: "Cannot find module 'xyz'"

Lösung:
1. Lokal: npm install
2. Lokal: npm run build
3. Falls lokal nicht funktioniert → Vercel geht auch nicht
4. Fix lokal, dann push
```

### Problem: Tests schlagen fehl auf Vercel

```
Fehler: "Tests failed"

Lösung:
1. Lokal: npm run test
2. Falls lokal pass aber Vercel fail:
   → Environment unterschiedlich
   → Check Vercel Env Variables
   → Redeploy
```

### Problem: Alte Version angezeigt

```
Fehler: "App zeigt alte Version"

Lösung:
1. Hard Refresh: Ctrl+Shift+R (Cmd+Shift+R auf Mac)
2. Private Browser Window öffnen
3. Warte 60 Sekunden (CDN Cache)
```

### Problem: "Build schlägt fehl"

```
Schritt 1: Vercel Logs lesen
  Vercel Dashboard → Deployments
  → Klicke auf fehlgeschlagenen Build
  → Scroll zu "Build & Deployment Logs"

Schritt 2: Häufige Fehler:
  - npm ci schlägt fehl → npm-Probleme
  - npm run build fehlgeschlagen → Code-Fehler
  - npm run test fehlgeschlagen → Test-Fehler

Schritt 3: Fix lokal
  npm ci && npm run build && npm run test

Schritt 4: Push wieder
  git push origin main
```

---

## 📈 Deployment Monitoring

### Vercel Dashboard Tabs

```
Deployments:
  → Alle Deployments anschauen
  → Status (Ready, Building, Failed)
  → Deploy Time & Size

Logs:
  → Build Logs
  → Function Logs
  → Runtime Logs

Analytics:
  → Performance Metrics
  → Uptime
  → Edge requests
```

---

## 🔄 Rollback (zur alten Version zurück)

Falls neue Version problematisch:

```
Vercel Dashboard → Deployments
  ↓
Klicke auf älteren, funktionierenden Deployment
  ↓
Klicke "Promote to Production"
  ↓
✅ Alte Version ist wieder live
```

---

## 🔐 Sicherheit

### ✅ Sicher:
- Secrets in Vercel Environment Variables
- HTTPS automatisch
- Vercel CDN global

### ❌ Nicht sicher:
- .env im Repository committen
- Passwörter im Code
- Secrets in vercel.json (public!)

### Best Practice:
```json
// ❌ FALSCH
{
  "env": {
    "DATABASE_PASSWORD": "superSecret123"
  }
}

// ✅ RICHTIG
{
  // Secrets nur in Vercel Dashboard!
  // Nicht in Code!
}
```

---

## 🚀 Nächste Schritte

### Sofort:
```
✅ vercel.json erstellt
✅ Tests könnten laufen
```

### Beim ersten Push:
```
1. git push origin main
2. Beobachte Vercel Dashboard
3. Logs anschauen
4. Deploy sollte funktionieren!
```

### Falls nötig später:
```
⏭️ Environment Variables hinzufügen
⏭️ API Routes konfigurieren
⏭️ Custom Domains setzen
```

---

## 📚 Weitere Ressourcen

- [Vercel Documentation](https://vercel.com/docs)
- [vercel.json Reference](https://vercel.com/docs/project-configuration)
- [Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)


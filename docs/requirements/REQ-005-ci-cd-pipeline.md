# Anforderung: CI/CD Pipeline & Automated Deployment

**Status:** 🟢 DRAFT  
**ID:** REQ-005  
**Version:** 1.0.0  
**Letzte Aktualisierung:** 2026-04-03  
**Modul:** DevOps / Deployment  
**Priorität:** High  

---

## 1. Zusammenfassung

Automatisierte Pipeline zum Bauen, Testen und Deployen der Anwendung. Bei jedem Code-Push wird die App automatisch gebaut, getestet und in Produktion deployt, sodass die aktuelle Version sofort live und nutzbar ist.

---

## 2. Funktionale Anforderungen

### 2.1 Automatisiertes Triggering

- [ ] **FR-1.1:** Pipeline startet automatisch bei Git Push
- [ ] **FR-1.2:** Pipeline kann manuell gestartet werden (Notfall-Deploy)
- [ ] **FR-1.3:** Nur bestimmte Branches triggern Deploy (main/production)
- [ ] **FR-1.4:** Feature Branches triggern nur Build + Test (kein Deploy)
- [ ] **FR-1.5:** Pull Requests zeigen Status (Pass/Fail)

### 2.2 Build Phase

- [ ] **FR-2.1:** Dependencies werden installiert
- [ ] **FR-2.2:** Code wird kompiliert/bundled
- [ ] **FR-2.3:** Build-Artifacts werden erzeugt
- [ ] **FR-2.4:** Build schlägt fehl wenn Fehler vorhanden (kein Deploy)
- [ ] **FR-2.5:** Build-Logs sind zugänglich

### 2.3 Test Phase

- [ ] **FR-3.1:** Unit Tests werden automatisch ausgeführt
- [ ] **FR-3.2:** E2E Tests werden automatisch ausgeführt
- [ ] **FR-3.3:** Tests schlagen fehl wenn Fehler vorhanden (kein Deploy)
- [ ] **FR-3.4:** Test-Reports sind einsehbar
- [ ] **FR-3.5:** Code Coverage wird gemessen und gezeigt

### 2.4 Quality Checks

- [ ] **FR-4.1:** Linting wird durchgeführt (Code Style)
- [ ] **FR-4.2:** Type Checking (TypeScript)
- [ ] **FR-4.3:** Security Scanning (Vulnerabilities)
- [ ] **FR-4.4:** Performance Testing (Lighthouse)
- [ ] **FR-4.5:** Accessibility Testing (a11y)

### 2.5 Deployment Phase

- [ ] **FR-5.1:** Build wird zu Hosting-Anbieter deployt
- [ ] **FR-5.2:** Deployment schlägt fehl bei ungültiger Konfiguration
- [ ] **FR-5.3:** Old Version ist noch erreichbar während Deployment läuft
- [ ] **FR-5.4:** Nach Deploy ist neue Version sofort live
- [ ] **FR-5.5:** Deployment-URL wird in PR/Commit gezeigt

### 2.6 Post-Deployment

- [ ] **FR-6.1:** Health Check nach Deployment
- [ ] **FR-6.2:** Automatischer Rollback bei Health Check Fehler
- [ ] **FR-6.3:** Deployment-Logs sind verfügbar
- [ ] **FR-6.4:** Monitoring wird aktiviert
- [ ] **FR-6.5:** Slack/Email Notification bei erfolgreicher Deployment

---

## 3. Nicht-funktionale Anforderungen

### 3.1 Performance & Duration

| Anforderung | Wert |
|-------------|------|
| **Build-Zeit** | < 5 Minuten |
| **Test-Zeit** | < 10 Minuten |
| **Deployment-Zeit** | < 2 Minuten |
| **Gesamt Pipeline** | < 20 Minuten |
| **E2E Test Timeout** | < 30 Sekunden pro Test |

### 3.2 Zuverlässigkeit

- [ ] **NFR-2.1:** Pipeline erfolgt zu 99%+ (nicht oft Failures)
- [ ] **NFR-2.2:** Flaky Tests werden erkannt und gefixt
- [ ] **NFR-2.3:** Retry-Mechanismus bei temporären Fehlern
- [ ] **NFR-2.4:** Cache für Dependencies (schnellerer Build)

### 3.3 Sicherheit & Secrets Management

**KRITISCH: Niemals Passwörter oder API Keys in Code committen!**

- [ ] **NFR-3.1:** ⚠️ **KEIN Passwort, API Key, Token oder Secret darf in Git-Repository sein**
- [ ] **NFR-3.2:** Alle Secrets werden in GitHub Secrets Management gespeichert (nicht im Code)
- [ ] **NFR-3.3:** `.env` Datei ist in `.gitignore` (wird nicht committed)
- [ ] **NFR-3.4:** Secrets werden nur zur Laufzeit in Pipeline injiziert
- [ ] **NFR-3.5:** Secrets nicht in Logs ausgegeben (GitHub Actions maskiert automatisch)
- [ ] **NFR-3.6:** Nur autorisierte Personen können auf GitHub Secrets zugreifen
- [ ] **NFR-3.7:** Audit Trail für alle Deployments verfügbar
- [ ] **NFR-3.8:** Secret Rotation implementiert (regelmäßiger Wechsel)

### 3.4 Monitoring & Alerting

- [ ] **NFR-4.1:** Pipeline-Fehler triggern Alert
- [ ] **NFR-4.2:** Deployment-Fehler triggern Alert
- [ ] **NFR-4.3:** Health Checks schlagen fehl → Rollback
- [ ] **NFR-4.4:** Fehler sind nachverfolgbar (Logs)

### 3.5 Skalierbarkeit

- [ ] **NFR-5.1:** Pipeline kann mehrere Branches parallel bauen
- [ ] **NFR-5.2:** Pipeline läuft unter Last (viele Pushes)
- [ ] **NFR-5.3:** Große Dateien beeinflussen nicht die Zeit

---

## 4. Framework & Technologie Anforderungen

### 4.1 CI/CD System: GitHub Actions (Vorgegeben)

**GitHub Actions wird als CI/CD System verwendet.**

- [ ] **FW-1.1:** GitHub Actions nativ mit GitHub Repository integriert
- [ ] **FW-1.2:** Workflows konfigurierbar via `.github/workflows/*.yml` (YAML)
- [ ] **FW-1.3:** Parallele Job-Ausführung möglich
- [ ] **FW-1.4:** Triggers: Push, Pull Request, Manual Dispatch
- [ ] **FW-1.5:** Gutes Logging & Debugging in GitHub UI
- [ ] **FW-1.6:** GitHub Secrets für sichere Passwort-Verwaltung
- [ ] **FW-1.7:** Status Checks in Pull Requests integriert

### 4.2 Build Anforderungen

- [ ] **FW-2.1:** Node.js/npm Support
- [ ] **FW-2.2:** Build-Cache für schnellere Builds
- [ ] **FW-2.3:** Multiple Node Versionen testbar
- [ ] **FW-2.4:** Environment Variables konfigurierbar

### 4.3 Test Framework Anforderungen

- [ ] **FW-3.1:** Unit Test Runner Support
- [ ] **FW-3.2:** E2E Test Framework Support (Cypress, Playwright, etc.)
- [ ] **FW-3.3:** Code Coverage Reporter
- [ ] **FW-3.4:** Test-Parallelisierung möglich
- [ ] **FW-3.5:** Browser-basierte Tests möglich

### 4.4 Deployment: Vercel (Vorgegeben)

**Vercel wird als Hosting-Anbieter verwendet.**

- [ ] **FW-4.1:** Vercel Integration mit GitHub Actions möglich
- [ ] **FW-4.2:** Environment-Variablen in Vercel Dashboard setzbar
- [ ] **FW-4.3:** Automatischer Deploy bei Git Push zu main
- [ ] **FW-4.4:** Preview Deployments für Pull Requests
- [ ] **FW-4.5:** Production URL wird nach Deploy angezeigt
- [ ] **FW-4.6:** Rollback zu vorherigen Version möglich
- [ ] **FW-4.7:** Health Checks/Monitoring in Vercel verfügbar
- [ ] **FW-4.8:** HTTPS automatisch (SSL Certificate)
- [ ] **FW-4.9:** Kostenlos für einfache Apps (Free Tier)

### 4.5 Monitoring & Alerting Anforderungen

- [ ] **FW-5.1:** Slack/Email Integration
- [ ] **FW-5.2:** Webhook Support
- [ ] **FW-5.3:** Uptime Monitoring
- [ ] **FW-5.4:** Error Tracking Integration (Sentry, etc.)

---

## 4.6 Secrets Management

**WICHTIG: Sicherer Umgang mit Passwörtern und API Keys**

- [ ] **FW-5.1:** GitHub Secrets werden für alle sensitive Daten verwendet
- [ ] **FW-5.2:** `.env` Datei ist niemals im Repository (in `.gitignore`)
- [ ] **FW-5.3:** Secrets werden nur zur Pipeline-Laufzeit injiziert
- [ ] **FW-5.4:** Vercel Environment Variables sind von GitHub Secrets getrennt
- [ ] **FW-5.5:** Secret Names sind sprechend (z.B. `DATABASE_PASSWORD`)
- [ ] **FW-5.6:** Keine Default/Test Passwörter in Code

---

## 5. Pipeline Stages (Workflow)

```
┌─────────────────────────────────────────┐
│  Git Push to Feature Branch             │
└────────────┬────────────────────────────┘
             │
      ┌──────▼──────┐
      │   Build     │ (< 5 min)
      │  - Install  │
      │  - Compile  │
      └──────┬──────┘
             │
      ┌──────▼──────┐
      │   Lint      │ (< 1 min)
      │  - Format   │
      │  - Quality  │
      └──────┬──────┘
             │
    ┌────────▼────────┐
    │   Tests         │ (< 10 min)
    │  - Unit Tests   │
    │  - E2E Tests    │
    │  - Coverage     │
    └────────┬────────┘
             │
    ┌────────▼────────────┐
    │  Security Scan      │ (< 2 min)
    │  - Dependencies     │
    │  - Vulnerabilities  │
    └────────┬────────────┘
             │
    ┌────────▼─────────┐
    │  Performance      │ (< 3 min)
    │  - Lighthouse     │
    │  - Bundle Size    │
    └────────┬──────────┘
             │
    ┌────────▼──────────────┐
    │  Main Branch?         │
    │  (Push to main/prod)  │
    └─┬──────────┬──────────┘
      │          │
     YES         NO
      │          │
      ▼          ▼
   Deploy    Feature Branch
   (< 2min)   Complete ✅
      │
      ▼
   Health Check
      │
   ┌──▼──┐
   │Pass?│
   └──┬──┘
    YES NO
     │  │
     ▼  ▼
    ✅ ROLLBACK
   Live
```

---

## 6. Pipeline Stages Details

### Stage 1: Build (< 5 min)

**Aufgaben:**
- Repository klonen
- Dependencies installieren (npm install)
- Code kompilieren/bundlen (npm run build)
- Build-Artifacts speichern

**Fehler:**
- Installation schlägt fehl → Pipeline stoppt
- Build schlägt fehl → Pipeline stoppt

### Stage 2: Lint & Format (< 1 min)

**Aufgaben:**
- Code Style Check (ESLint, Prettier)
- Type Checking (TypeScript)
- Format Issues finden

**Fehler:**
- Linting Fehler → Warnung anzeigen, nicht blocken (optional blockend)

### Stage 3: Tests (< 10 min)

**Unit Tests:**
- Jest/Vitest ausführen
- Code Coverage messen (mindestens 70%)
- Abort bei Fehler

**E2E Tests:**
- Cypress/Playwright ausführen
- Mehrere Szenarien testen
- Screenshots bei Fehler
- Abort bei Fehler

### Stage 4: Security Scan (< 2 min)

**Aufgaben:**
- NPM Audit (Vulnerabilities)
- Dependency Check
- Secret Scanner
- Abort bei kritischen Vulnerabilities

### Stage 5: Performance Check (< 3 min)

**Aufgaben:**
- Lighthouse Audit (Mobile & Desktop)
- Bundle Size Check
- Performance Regression Detection
- Warnung bei schlechterer Performance

### Stage 6: Deploy (< 2 min)

**Aufgaben:**
- Build-Artifacts zu Hosting uploaden
- Environment-Variablen setzen
- Database Migrations (falls nötig)
- Preview/Production URL aktivieren

**Fehler Handling:**
- Deploy schlägt fehl → Alert, alte Version bleibt
- Health Check schlägt fehl → Automatischer Rollback

### Stage 7: Post-Deploy (< 1 min)

**Aufgaben:**
- Health Check durchführen (HTTP 200)
- Monitoring aktivieren
- Notification senden (Slack, Email)
- Deployment-URL in UI zeigen

---

## 7. Abhängigkeiten

- **REQ-001 bis REQ-004:** Alle App-Anforderungen
- **Testing Framework:** Unit + E2E Test Suite vorhanden
- **Hosting Provider:** Account mit API/Token
- **Monitoring Tool:** (Optional aber empfohlen)

---

## 8. Akzeptanzkriterien

- [ ] **AC-1:** Pipeline läuft automatisch bei Git Push
- [ ] **AC-2:** Build schlägt fehl bei Kompilierungsfehlern
- [ ] **AC-3:** Tests blocken Deploy wenn Fehler
- [ ] **AC-4:** Nach erfolgreicher Pipeline ist App live
- [ ] **AC-5:** Feature Branch zeigt Test-Status in GitHub/GitLab
- [ ] **AC-6:** Production Deploy ist dokumentiert und sicher
- [ ] **AC-7:** Rollback ist möglich bei Problemen
- [ ] **AC-8:** Pipeline-Zeit < 20 Minuten

---

## 9. Nicht-umfasst (Out of Scope)

- [ ] Manual Approvals vor Deploy
- [ ] Canary Deployments oder Blue-Green
- [ ] Database Seeding/Migrations (optional)
- [ ] Multiple Environments (Staging, Production)
- [ ] Load Testing

---

## 10. Pipeline Success Criteria

```
✅ SUCCESS:
- Build: ✓
- Lint: ✓
- Unit Tests: ✓ (100% Pass)
- E2E Tests: ✓ (100% Pass)
- Security: ✓ (No Critical)
- Performance: ✓ (Score > 90)
- Deploy: ✓
- Health Check: ✓ (200 OK)
→ App is LIVE and READY TO USE

❌ FAILED (Pipeline Stops):
- Build: ✗ → STOP (Fix compilation)
- Tests: ✗ → STOP (Fix failing tests)
- Security: ✗ (Critical) → STOP (Fix vuln)
- Deploy: ✗ → STOP (Investigate issue)
- Health: ✗ → ROLLBACK (Restore old version)
```

---

## 11. Monitoring & Alerts

### Alerts sollten triggern für:

| Event | Severity | Action |
|-------|----------|--------|
| Build Failure | Critical | Slack/Email → Dev |
| Test Failure | Critical | Slack/Email → Dev |
| Security Vuln | Critical | Slack/Email → Security |
| Deploy Failure | Critical | Slack/Email → DevOps |
| Health Check Fail | Critical | Auto-Rollback + Alert |
| Performance Regression | Warning | Slack → Dev (info only) |

---

## 12. Konfiguration & Environment

### Secrets Management

Folgende sollten **nicht** im Code sein:
- API Keys
- Database Passwords
- Auth Tokens
- SSH Keys

Stattdessen: Sichere Secrets-Verwaltung nutzen

### Environment Variables

Pro Environment konfigurierbar:
- API_URL (Test vs Production)
- Database URL
- Auth Config
- Feature Flags
- Analytics Tokens

---

## 13. Rollback Strategie

```
IF Deploy Successful AND Health Check OK
  → Keep New Version LIVE
ELSE
  → Rollback to Previous Version
  → Alert Team
  → Investigate Issue
```

**Rollback sollte sein:**
- Automatisch bei Health Check Fehler
- Schnell (< 1 Minute)
- Dokumentiert (Logs)

---

## 14. Szenarien

### Szenario 1: Feature Development

```
1. Dev erstellt Feature Branch
2. Code wird gepusht
3. Pipeline: Build + Test + Lint
4. Tests PASS → PR Review möglich
5. Mergen zu main
6. Pipeline: Build + Test + Deploy
7. App ist live für Nutzer
```

### Szenario 2: Bug Fix

```
1. Dev erstellt bug-fix Branch
2. Schreibe Test für Bug
3. Pushen → Pipeline
4. Pipeline schlägt fehl (Test zeigt Bug)
5. Fix schreiben
6. Pushen → Pipeline PASS
7. Mergen → Deploy → Live
```

### Szenario 3: Emergency Hotfix

```
1. Critical Bug in Production
2. Dev erstellt hotfix Branch
3. Fix + Test
4. Pushen → Pipeline
5. Pipeline PASS
6. Mergen zu main
7. Auto-Deploy → Live (< 20 min)
```

---

## 15. Änderungshistorie

| Version | Datum | Autor | Änderung |
|---------|-------|-------|---------|
| 1.0.0 | 2026-04-03 | Claude | Initiale Version |


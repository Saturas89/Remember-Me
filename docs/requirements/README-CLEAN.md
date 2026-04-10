# Anforderungen - Neue Struktur (Clean)

**Status:** 🟢 DRAFT  
**Version:** 1.0.0  
**Letzte Aktualisierung:** 2026-04-03

---

## 📋 Übersicht: Neue Anforderungs-Struktur

Diese Anforderungen sind **losgelöst von Implementation-Details**. Sie beschreiben:
- ✅ **WAS** die App können muss
- ✅ **Framework-Anforderungen** (Technologie-Kategorien)
- ✅ **Nicht-funktionale Anforderungen** (Performance, Sicherheit, etc.)

Sie beschreiben **NICHT**:
- ❌ WIE die App es macht (Implementation-Details)
- ❌ Welches Frontend-Framework
- ❌ Welche Caching-Strategien
- ❌ Welche API-Endpoints
- ❌ Welche Datenbank

---

## 🔄 Struktur: Anforderungen vs. Implementation

### ✅ Anforderungen (Was soll passieren)

```
REQ-001-pwa-foundation-clean.md
├── Funktionale Anforderungen (FR)
│   ├─ App muss als PWA installierbar sein
│   ├─ App muss offline funktionieren
│   └─ Design muss responsive sein
├── Nicht-funktionale Anforderungen (NFR)
│   ├─ Performance: Erste Lade < 3 Sekunden
│   ├─ Browser Support: iOS 12+, Android 8+
│   └─ Accessibility: WCAG 2.1 AA
└── Framework Anforderungen (FW)
    ├─ Service Worker Unterstützung
    ├─ Client-seitiger Storage
    └─ TypeScript/Typisierung
```

### 📋 Implementation Details (Wie es gemacht wird)

```
IMPLEMENTATION_DETAILS.md
├── Technology Stack
│   ├─ Frontend: React 18+
│   ├─ Backend: Node.js
│   └─ Database: PostgreSQL
├── API Design
│   ├─ REST Endpoints
│   ├─ Datenmodelle
│   └── Error Handling
├── Caching Strategien
│   ├─ Service Worker Caching
│   ├─ IndexedDB Schema
│   └─ LocalStorage Usage
└── Folder Structure
    ├─ components/
    ├─ services/
    └─ styles/
```

---

## 📑 Verfügbare Anforderungen (CLEAN)

| ID | Titel | Fokus | Status |
|----|-------|-------|--------|
| **REQ-001** | PWA Foundation & Responsive Design | Was the app do + Framework | 🟢 DRAFT |
| **REQ-002** | Workout Management & Planning | Was the user do | 🟢 DRAFT |
| **REQ-003** | Offline Functionality & Sync | Was passiert offline | 🟢 DRAFT |
| **REQ-004** | Data Storage & Backend Integration | Was mit Daten passiert | 🟢 DRAFT |

### Dateien

- `REQ-001-pwa-foundation-clean.md` ← Neue bereinigte Version
- `REQ-002-workout-management-clean.md` ← Neue bereinigte Version
- `REQ-003-offline-functionality-clean.md` ← Neue bereinigte Version
- `REQ-004-data-storage-clean.md` ← Neue bereinigte Version

---

## 🎯 Was ist in den Clean Anforderungen drin?

### ✅ Funktionale Anforderungen (FR)

"Benutzer kann X tun"

Beispiele:
- FR-1.1: Benutzer kann neuen Workout erstellen
- FR-2.1: App funktioniert ohne Internet
- FR-3.1: Benutzer kann sich registrieren

### ✅ Nicht-funktionale Anforderungen (NFR)

"Die App muss X sein/können"

Beispiele:
- NFR-1: Performance: < 3 Sekunden Ladezeit
- NFR-2: Security: HTTPS, keine Plaintext Passwords
- NFR-3: Skalierbarkeit: 10.000 gleichzeitige Nutzer
- NFR-4: Accessibility: WCAG 2.1 AA

### ✅ Framework Anforderungen (FW)

"Die App braucht X technische Fähigkeit"

Beispiele:
- FW-1: Service Worker Unterstützung
- FW-2: Client-seitiger Datenspeicher
- FW-3: State Management Library
- FW-4: Testing Framework

### ❌ NICHT drin: Implementation Details

**Rausgelöst in `IMPLEMENTATION_DETAILS.md`:**
- ❌ Welches Frontend-Framework (React, Vue, Svelte)
- ❌ Welche Caching-Strategien genau
- ❌ Welche API-Endpoints
- ❌ Welche Datenbank
- ❌ Welche Folder-Struktur
- ❌ Welche Libraries
- ❌ Welche Deployment-Platform

---

## 💡 Beispiel: Unterschied Alt vs. Neu

### ❌ ALT (mit Implementation Details gemischt)

```markdown
# REQ-001: PWA Foundation

3. Implementierungsnotizen

- Service Worker bei Service Worker Management registriert
- IndexedDB für lokale Speicherung nutzen
- Workbox für Caching-Strategien
- React als Frontend Framework
- REST API mit Express.js
- PostgreSQL für Datenbank

7. Implementierungsdetails

### Service Worker
```javascript
self.addEventListener('install', (event) => {
  // Pre-cache critical assets
});
```

6. Design / Mockups

```typescript
const breakpoints = {
  mobile: '320px',
  tablet: '768px',
  desktop: '1024px'
}
```
```

### ✅ NEU (Clean - nur Anforderungen)

```markdown
# REQ-001: PWA Foundation & Responsive Design

2. Funktionale Anforderungen

- FR-1.1: App ist als PWA installierbar
- FR-1.2: App funktioniert offline
- FR-2.1: Layout passt sich an Bildschirmgröße an

3. Nicht-funktionale Anforderungen

- NFR-1: Performance: Erste Lade < 3 Sekunden
- NFR-2: Browser Support: iOS 12+
- NFR-3: Security: HTTPS only

4. Framework Anforderungen

- FW-1: Service Worker Unterstützung
- FW-2: Client-seitiger Datenspeicher
- FW-3: TypeScript/Typisierung
```

**Technische Details:** siehe `IMPLEMENTATION_DETAILS.md`
```

---

## 🔄 Workflow: Anforderungen ändern vs. Implementation ändern

### Szenario 1: Anforderung ändert sich

```
"App muss jetzt < 2 Sekunden laden (statt 3)"
  ↓
Update REQ-001-pwa-foundation-clean.md
  ↓
IMPLEMENTATION_DETAILS.md bleibt GLEICH
  ↓
Implementation kann beliebig angepasst werden
   (Caching, Code-Splitting, etc.)
```

### Szenario 2: Implementation ändert sich

```
"Wir wechseln von React zu Vue"
  ↓
REQ-001 bleibt GLEICH
  ↓
Update IMPLEMENTATION_DETAILS.md
   (Technology Stack: Vue statt React)
  ↓
Anforderungen sind immer noch erfüllt
```

---

## 📊 Übersicht: Anforderungs-Kategorisierung

```
                    ANFORDERUNGEN (Clean)
                    /                \
                   /                  \
        Funktional (FR)        Nicht-Funktional (NFR) + Framework (FW)
        └─ Was tut die         └─ Wie ist die App
           App?                    (Performance, Security, etc.)

                        ↓ Implementation Details
                      IMPLEMENTATION_DETAILS.md
                    (WIE es gemacht wird)
                    /    |    \     |     \
                   /     |     \    |      \
              Tech      API    Caching  Database  Folder
              Stack   Endpoints Strategies  Schema  Structure
```

---

## 🎓 Best Practice: Anforderungen schreiben

### ✅ RICHTIG

```
- FR-1.1: Benutzer kann einen Workout erstellen
- NFR-1: App muss < 3 Sekunden laden
- FW-1: Service Worker Unterstützung erforderlich
```

### ❌ FALSCH

```
- FR-1.1: Benutzer erstellt Workout mit React Form Komponente
- NFR-1: IndexedDB für Caching nutzen
- FW-1: Workbox Service Worker Library verwenden
```

---

## 🔗 Verwandte Dokumente

- **Anforderungen:** `/docs/requirements/REQ-00X-*-clean.md`
- **Implementation:** `/docs/IMPLEMENTATION_DETAILS.md`
- **Hauptdokumentation:** `/docs/README.md`
- **Module:** `/docs/modules/*/`

---

## 📝 Änderungshistorie

| Version | Datum | Autor | Änderung |
|---------|-------|-------|---------|
| 1.0.0 | 2026-04-03 | Claude | Neue Clean-Struktur |

---

## ⚠️ Wichtig

Diese neue Struktur ermöglicht:
- ✅ **Anforderungen sind stabil** - ändern sich nur wenn Geschäftslogik sich ändert
- ✅ **Implementation ist flexibel** - kann beliebig angepasst werden
- ✅ **Kommunikation klar** - Anforderungen vs. technische Details getrennt
- ✅ **App neu schreiben** - Mit nur Anforderungen möglich (Implementation kann beliebig sein)


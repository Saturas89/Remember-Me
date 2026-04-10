# Implementation Details - Tech Stack

**Status:** 🟢 DRAFT  
**Version:** 1.0.0  
**Letzte Aktualisierung:** 2026-04-03

---

## 📋 Übersicht

Technische Implementation Details - unabhängig von den Anforderungen.

**Anforderungen:** Siehe `/docs/requirements/REQ-00X-*-clean.md`

---

## 1. Technology Stack (Empfohlen)

### Frontend

```
Framework:       React 18+ oder Vue 3+ oder Svelte
Build Tool:      Vite
State Management: Zustand / Pinia / Redux Toolkit
Styling:         Tailwind CSS
Testing:         Vitest (Unit) + Cypress (E2E)
Type Safety:     TypeScript
```

### Backend (Optional, für später)

```
API:             Node.js (Express) / Python (FastAPI)
Database:        PostgreSQL / MongoDB
Authentication:  JWT / OAuth2
```

### Hosting & Deployment

```
Hosting:         Vercel
CI/CD:           Vercel CI (built-in)
Environment:     vercel.json
Monitoring:      Vercel Analytics
```

---

## 2. Vercel Setup (vercel.json)

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

**Was passiert:**
1. `npm ci` - Dependencies installieren
2. `npm run build` - App kompilieren
3. `npm run test` (optional) - Tests durchführen
4. Deploy zu Vercel CDN

---

## 3. Project Structure

```
src/
├── components/
│   ├── mobile/           # Mobile-only Components
│   ├── desktop/          # Desktop-only Components
│   └── shared/           # Shared Components
├── pages/
│   ├── index.tsx
│   ├── workouts/
│   └── [dynamic]/
├── services/
│   ├── api.ts            # API Calls
│   ├── storage.ts        # LocalStorage/IndexedDB
│   └── sync.ts           # Data Sync
├── hooks/
│   ├── useWorkouts.ts
│   ├── useOffline.ts
│   └── useSync.ts
├── styles/
│   ├── globals.css
│   ├── breakpoints.css
│   └── components.css
├── types/
│   └── models.ts
└── main.tsx
```

---

## 4. Build & Deploy Flow

```
Git Push (main)
       ↓
Vercel CI:
  1. npm ci
  2. npm run build
  3. npm run test (optional)
       ↓
  Falls OK:
  4. Deploy zu CDN
  5. Health Check
       ↓
✅ App LIVE auf https://remember-me.vercel.app
```

---

## 5. Scripts (package.json)

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint src --fix",
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "test:unit": "vitest run",
    "test:e2e": "cypress run"
  }
}
```

---

## 6. Testing Strategy

### Unit Tests (Vitest)

```typescript
import { describe, it, expect } from 'vitest'

describe('MyComponent', () => {
  it('should render', () => {
    expect(true).toBe(true)
  })
})
```

### E2E Tests (Cypress)

```typescript
describe('Workout Flow', () => {
  it('should create workout', () => {
    cy.visit('/')
    cy.get('[data-testid="create-btn"]').click()
    cy.get('[data-testid="workout-name"]').type('Chest Day')
    cy.get('[data-testid="save-btn"]').click()
    cy.contains('Chest Day').should('exist')
  })
})
```

---

## 7. Responsive Design

### CSS Breakpoints

```css
/* Mobile First */
@media (min-width: 768px) {
  /* Tablet */
}

@media (min-width: 1024px) {
  /* Desktop */
}

@media (min-width: 1440px) {
  /* Wide Desktop */
}
```

### Component Strategy

```
Shared Components:
  - Button, Card, Input (responsive by default)

Mobile Components:
  - BottomNav, MobileMenu, TouchSwipe

Desktop Components:
  - Sidebar, DesktopMenu, Keyboard Shortcuts
```

---

## 8. Data Storage

### LocalStorage (für Preferences)

```typescript
// Speichern
localStorage.setItem('theme', 'dark')

// Laden
const theme = localStorage.getItem('theme')
```

### IndexedDB (für Workouts)

```typescript
const db = await openDB('remember-me')

// Speichern
await db.put('workouts', workout)

// Laden
const workouts = await db.getAll('workouts')
```

---

## 9. API Integration

### REST API Calls

```typescript
// services/api.ts
export async function fetchWorkouts() {
  const response = await fetch('/api/workouts')
  return response.json()
}

export async function createWorkout(workout: Workout) {
  const response = await fetch('/api/workouts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workout)
  })
  return response.json()
}
```

---

## 10. Environment Variables

### Development (.env.local)

```
VITE_API_URL=http://localhost:3000
VITE_ENV=development
```

### Production (Vercel Dashboard)

```
VITE_API_URL=https://api.remember-me.com
VITE_ENV=production
```

---

## 11. Deployment Checklist

```
Vor Push zu main:
  ☐ npm run build (lokal erfolgreich)
  ☐ npm run test (alle Test pass)
  ☐ npm run lint (keine Fehler)
  ☐ .env nicht committed
  ☐ Secrets nicht im Code

Vercel wird automatisch:
  ☐ npm ci
  ☐ npm run build
  ☐ npm run test
  ☐ Deploy
  ☐ Health Check
```

---

## 12. Monitoring

### Vercel Analytics

```
Vercel Dashboard:
  → Analytics Tab
  → Performance Metrics
  → Edge requests
  → Regions
```

### Error Tracking (Optional)

```typescript
import * as Sentry from "@sentry/react"

Sentry.init({
  dsn: process.env.VITE_SENTRY_DSN,
  environment: process.env.VITE_ENV
})
```

---

## 13. Performance Optimization

### Code Splitting

```typescript
// Lazy load routes
const AdminPage = lazy(() => import('./pages/Admin'))

<Suspense fallback={<Loading />}>
  <AdminPage />
</Suspense>
```

### Image Optimization

```html
<img 
  src="image.webp" 
  alt="description"
  loading="lazy"
  width="400"
  height="300"
/>
```

---

## 14. Änderungshistorie

| Version | Datum | Autor | Änderung |
|---------|-------|-------|---------|
| 1.0.0 | 2026-04-03 | Claude | Initiale Version |

